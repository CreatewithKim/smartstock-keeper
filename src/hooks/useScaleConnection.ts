import { useState, useCallback, useEffect, useSyncExternalStore } from 'react';
import { toast } from '@/hooks/use-toast';

export type ScaleState = 'DISCONNECTED' | 'CONNECTED' | 'WEIGHING' | 'STABLE';

export interface ScaleConfig {
  port: string;
  baudRate: number;
  parity: ParityType;
  stopBits: number;
}

export interface WeightData {
  weight: number;
  stable: boolean;
  productId?: string;
  timestamp: Date;
}

type ParityType = 'none' | 'even' | 'odd';

const DEFAULT_CONFIG: ScaleConfig = {
  port: 'COM3',
  baudRate: 9600,
  parity: 'none',
  stopBits: 1,
};

const STOP_MOVING_MS = 800; // display number unchanged for 0.8s = locked

// ── Singleton connection manager ────────────────────────────────────
// Lives at module scope so the serial port, read loop and weight state
// survive component unmounts (route/tab switches). The hook below only
// subscribes to this shared state.
interface ScaleSnapshot {
  scaleState: ScaleState;
  currentWeight: WeightData | null;
  stableWeight: WeightData | null;
  lastError: string | null;
  config: ScaleConfig;
}

function loadConfig(): ScaleConfig {
  try {
    const saved = localStorage.getItem('scaleConfig');
    if (saved) {
      const { middlewareUrl, ...rest } = JSON.parse(saved);
      return { ...DEFAULT_CONFIG, ...rest };
    }
  } catch { /* ignore */ }
  return DEFAULT_CONFIG;
}

const manager = {
  snapshot: {
    scaleState: 'DISCONNECTED',
    currentWeight: null,
    stableWeight: null,
    lastError: null,
    config: loadConfig(),
  } as ScaleSnapshot,

  listeners: new Set<() => void>(),

  port: null as SerialPort | null,
  reader: null as ReadableStreamDefaultReader<string> | null,
  running: false,

  // Weight-lock tracking
  lastReading: null as number | null,
  lockTimer: null as ReturnType<typeof setTimeout> | null,

  autoConnectAttempted: false,

  emit() {
    this.listeners.forEach((l) => l());
  },

  set(patch: Partial<ScaleSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.emit();
  },

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },

  // Called on each reading – locks when weight stops moving
  handleWeightReading(weight: number) {
    const displayNum = Math.round(weight * 1000) / 1000;
    const prev = this.lastReading;
    this.lastReading = displayNum;

    const numberChanged = prev !== null && prev !== displayNum;

    if (numberChanged) {
      if (this.lockTimer) {
        clearTimeout(this.lockTimer);
        this.lockTimer = null;
      }
      if (this.snapshot.stableWeight) {
        this.set({ stableWeight: null, scaleState: 'WEIGHING' });
      }
    }

    if (!this.snapshot.stableWeight && displayNum > 0 && !this.lockTimer) {
      this.lockTimer = setTimeout(() => {
        this.lockTimer = null;
        const current = this.lastReading;
        if (current !== null && current > 0) {
          const data: WeightData = { weight: current, stable: true, timestamp: new Date() };
          this.set({ currentWeight: data, stableWeight: data, scaleState: 'STABLE' });
        }
      }, STOP_MOVING_MS);
    }

    if (displayNum === 0 && this.snapshot.stableWeight) {
      if (this.lockTimer) {
        clearTimeout(this.lockTimer);
        this.lockTimer = null;
      }
      this.set({ stableWeight: null, scaleState: 'WEIGHING' });
    }
  },

  async startReadLoop(port: SerialPort) {
    const textDecoder = new TextDecoderStream();
    // @ts-ignore
    const pipeClosed = port.readable!.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    this.reader = reader;

    let lineBuffer = '';

    try {
      while (this.running) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        lineBuffer += value;
        const lines = lineBuffer.split(/[\r\n]+/);
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          console.log('[Scale raw]', JSON.stringify(trimmed));

          const numMatch = trimmed.match(/([+-]?\d+\.?\d*)/);
          const weight = numMatch ? parseFloat(numMatch[1]) : NaN;
          const displayWeight = isNaN(weight) ? 0 : weight;

          this.set({
            currentWeight: { weight: displayWeight, stable: false, timestamp: new Date() },
            scaleState: 'WEIGHING',
            lastError: null,
          });

          if (!isNaN(weight)) {
            this.handleWeightReading(weight);
          }
        }
      }
    } catch (e: unknown) {
      if (this.running) {
        const msg = e instanceof Error ? e.message : 'Serial read error';
        console.error('Serial read error:', e);
        this.set({ lastError: msg });
      }
    } finally {
      reader.releaseLock();
      await pipeClosed.catch(() => {});
    }
  },

  async openPort(port: SerialPort) {
    const { baudRate, parity, stopBits } = this.snapshot.config;
    // Already open on this port (e.g. remount after a route switch) – just reattach
    if (this.port === port && this.running) {
      this.emit();
      return;
    }
    await port.open({ baudRate, parity, stopBits: stopBits as 1 | 2, dataBits: 8 });

    this.port = port;
    this.running = true;
    this.lastReading = null;
    this.set({ scaleState: 'CONNECTED', lastError: null });

    this.startReadLoop(port).then(() => {
      if (this.running) {
        this.set({ scaleState: 'DISCONNECTED', lastError: 'Serial connection ended unexpectedly' });
      }
    });
  },

  async connect() {
    this.set({ lastError: null });

    if (!('serial' in navigator)) {
      const msg = 'Web Serial API not supported. Use Chrome or Edge.';
      this.set({ lastError: msg });
      toast({ title: 'Not Supported', description: msg, variant: 'destructive' });
      return;
    }

    // Already connected – nothing to do
    if (this.port && this.running) {
      this.emit();
      return;
    }

    try {
      const port = await navigator.serial.requestPort();
      await this.openPort(port);
      toast({ title: 'Scale Connected', description: `Serial port opened at ${this.snapshot.config.baudRate} baud` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to open serial port';
      console.error('Serial connect error:', e);
      this.set({ lastError: msg, scaleState: 'DISCONNECTED' });
      toast({ title: 'Connection Failed', description: msg, variant: 'destructive' });
    }
  },

  async disconnect() {
    this.running = false;

    if (this.reader) {
      try { await this.reader.cancel(); } catch { /* ignore */ }
      this.reader = null;
    }

    if (this.port) {
      try { await this.port.close(); } catch { /* ignore */ }
      this.port = null;
    }

    this.lastReading = null;
    this.set({ scaleState: 'DISCONNECTED', currentWeight: null, stableWeight: null });
    toast({ title: 'Scale Disconnected', description: 'Serial port closed' });
  },

  resetForNextSale() {
    this.lastReading = null;
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }
    this.set({
      stableWeight: null,
      scaleState: this.snapshot.scaleState === 'STABLE' ? 'CONNECTED' : this.snapshot.scaleState,
    });
  },

  updateConfig(newConfig: Partial<ScaleConfig>) {
    const updated = { ...this.snapshot.config, ...newConfig };
    localStorage.setItem('scaleConfig', JSON.stringify(updated));
    this.set({ config: updated });
  },

  // Auto-detect a previously authorized port once per app lifetime
  async autoConnect() {
    if (this.autoConnectAttempted) return;
    this.autoConnectAttempted = true;
    if (!('serial' in navigator)) return;
    if (this.port && this.running) return;

    try {
      const ports = await navigator.serial.getPorts();
      if (ports.length > 0) {
        console.log('[Scale] Auto-detecting previously authorized port…');
        await this.openPort(ports[0]);
        toast({ title: 'Scale Auto-Connected', description: `Resumed serial at ${this.snapshot.config.baudRate} baud` });
      }
    } catch (e) {
      console.log('[Scale] Auto-connect skipped:', e);
    }
  },

  setupGlobalListeners() {
    // Close port only on full page unload
    window.addEventListener('beforeunload', () => {
      this.running = false;
      if (this.reader) {
        try { this.reader.cancel(); } catch { /* ignore */ }
      }
      if (this.port) {
        try { this.port.close(); } catch { /* ignore */ }
      }
    });

    if (!('serial' in navigator)) return;
    navigator.serial.addEventListener('disconnect', (e: Event) => {
      const disconnectedPort = (e as any).target;
      if (disconnectedPort === this.port) {
        console.log('[Scale] Port disconnected');
        this.running = false;
        this.port = null;
        this.reader = null;
        this.set({
          scaleState: 'DISCONNECTED',
          currentWeight: null,
          stableWeight: null,
          lastError: 'Scale was disconnected',
        });
        toast({ title: 'Scale Disconnected', description: 'The serial device was removed', variant: 'destructive' });
      }
    });
  },
};

let globalListenersReady = false;
function ensureGlobalSetup() {
  if (globalListenersReady || typeof window === 'undefined') return;
  globalListenersReady = true;
  manager.setupGlobalListeners();
  void manager.autoConnect();
}

// ── Hook: subscribes to the shared singleton ────────────────────────
export function useScaleConnection() {
  ensureGlobalSetup();

  const snapshot = useSyncExternalStore(
    (cb) => manager.subscribe(cb),
    () => manager.snapshot,
  );

  const connect = useCallback(() => manager.connect(), []);
  const disconnect = useCallback(() => manager.disconnect(), []);
  const resetForNextSale = useCallback(() => manager.resetForNextSale(), []);
  const updateConfig = useCallback((c: Partial<ScaleConfig>) => manager.updateConfig(c), []);
  const setConfig = useCallback((c: ScaleConfig) => manager.updateConfig(c), []);

  return {
    scaleState: snapshot.scaleState,
    isConnected: snapshot.scaleState !== 'DISCONNECTED',
    isStable: snapshot.scaleState === 'STABLE',
    isWeighing: snapshot.scaleState === 'WEIGHING',
    currentWeight: snapshot.currentWeight,
    stableWeight: snapshot.stableWeight,
    config: snapshot.config,
    setConfig,
    lastError: snapshot.lastError,
    connect,
    disconnect,
    resetForNextSale,
    updateConfig,
  };
}
