import { useState, useCallback, useRef, useEffect } from 'react';
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

const STABILITY_THRESHOLD = 0.01; // kg
const STABILITY_READINGS_REQUIRED = 3;
const DUPLICATE_TIMEOUT = 2000; // ms

// ── Parser ──────────────────────────────────────────────────────────
// Supports ACLAS PS6X formats + common scale outputs.
// Kept beyond the basic checklist because raw bytes must be converted
// to a numeric weight value — the checklist's TextDecoder only gives
// us a string, we still need to extract the number.
const PATTERNS = {
  full: /P(\d{4,6})W([+-]?\d+\.?\d*)U(\d+\.?\d*)T(\d+\.?\d*)/,
  plu_weight: /P(\d{4,6})W([+-]?\d+\.?\d*)/,
  weight_only: /[Ww]([+-]?\d+\.?\d*)/,
  with_unit: /(\d+\.?\d*)\s*[kK][gG]/,
  stable_prefix: /(?:ST|GS|NT)[,\s]+[+-]?\s*(\d+\.?\d*)/i,
  bare_number: /^\s*([+-]?\d+\.\d+)\s*$/,
};

function parseScaleData(text: string): { weight: number; productId?: string } | null {
  const t = text.trim();
  if (!t) return null;

  for (const [key, rx] of Object.entries(PATTERNS)) {
    const m = rx.exec(t);
    if (!m) continue;
    if (key === 'full' || key === 'plu_weight') {
      return { productId: m[1], weight: parseFloat(m[2]) };
    }
    return { weight: parseFloat(m[1]) };
  }
  return null;
}

// ── Hook ────────────────────────────────────────────────────────────
export function useScaleConnection() {
  const [scaleState, setScaleState] = useState<ScaleState>('DISCONNECTED');
  const [config, setConfig] = useState<ScaleConfig>(() => {
    try {
      const saved = localStorage.getItem('scaleConfig');
      if (saved) {
        const { middlewareUrl, ...rest } = JSON.parse(saved);
        return { ...DEFAULT_CONFIG, ...rest };
      }
    } catch { /* ignore */ }
    return DEFAULT_CONFIG;
  });
  const [currentWeight, setCurrentWeight] = useState<WeightData | null>(null);
  const [stableWeight, setStableWeight] = useState<WeightData | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const runningRef = useRef(false);

  // Stability tracking – kept beyond checklist because POS requires
  // a "locked" weight before a sale can be confirmed.
  const readingsBuffer = useRef<number[]>([]);
  const lastSentWeight = useRef<number | null>(null);
  const lastSentTime = useRef<number>(0);
  // Use a ref for stableWeight inside the read loop to avoid stale closures
  const stableWeightRef = useRef<WeightData | null>(null);
  useEffect(() => { stableWeightRef.current = stableWeight; }, [stableWeight]);

  const isStableReading = (weight: number): boolean => {
    const buf = readingsBuffer.current;
    buf.push(weight);
    if (buf.length > 10) buf.shift();
    if (buf.length < STABILITY_READINGS_REQUIRED) return false;
    const recent = buf.slice(-STABILITY_READINGS_REQUIRED);
    return Math.max(...recent) - Math.min(...recent) <= STABILITY_THRESHOLD;
  };

  const isDuplicate = (weight: number): boolean => {
    if (lastSentWeight.current === null) return false;
    if (Math.abs(weight - lastSentWeight.current) > STABILITY_THRESHOLD) return false;
    return Date.now() - lastSentTime.current < DUPLICATE_TIMEOUT;
  };

  // ── Core read loop (follows checklist §3 "Read Serial Data") ─────
  const startReadLoop = useCallback(async (port: SerialPort) => {
    // Checklist: const reader = port.readable.getReader()
    // We use TextDecoderStream so we get string chunks directly.
    const textDecoder = new TextDecoderStream();
    // @ts-ignore – WritableStream<BufferSource> vs Uint8Array mismatch in strict TS
    const pipeClosed = port.readable!.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    let lineBuffer = '';

    try {
      // Checklist: while (true) { const { value, done } = await reader.read(); ... }
      while (runningRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;

        // Accumulate and split on newlines (displayData equivalent)
        lineBuffer += value;
        const lines = lineBuffer.split(/[\r\n]+/);
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            console.log('[Scale raw]', JSON.stringify(line));
          }

          const parsed = parseScaleData(line);
          if (!parsed || parsed.weight < 0) continue;

          const weight = parsed.weight;

          // Live weight → UI (checklist §3 "Display on Screen")
          setCurrentWeight({
            weight,
            stable: false,
            productId: parsed.productId,
            timestamp: new Date(),
          });
          setScaleState('WEIGHING');
          setLastError(null);

          // Stability check
          if (isStableReading(weight) && !isDuplicate(weight)) {
            const avg = readingsBuffer.current
              .slice(-STABILITY_READINGS_REQUIRED)
              .reduce((a, b) => a + b, 0) / STABILITY_READINGS_REQUIRED;
            const rounded = Math.round(avg * 1000) / 1000;

            const data: WeightData = {
              weight: rounded,
              stable: true,
              productId: parsed.productId,
              timestamp: new Date(),
            };
            setCurrentWeight(data);
            setStableWeight(data);
            setScaleState('STABLE');
            lastSentWeight.current = rounded;
            lastSentTime.current = Date.now();
          } else if (
            stableWeightRef.current &&
            Math.abs(weight - (lastSentWeight.current ?? 0)) > STABILITY_THRESHOLD
          ) {
            setStableWeight(null);
          }
        }
      }
    } catch (e: unknown) {
      if (runningRef.current) {
        const msg = e instanceof Error ? e.message : 'Serial read error';
        console.error('Serial read error:', e);
        setLastError(msg);
      }
    } finally {
      reader.releaseLock();
      await pipeClosed.catch(() => {});
    }
  }, []);

  // ── Open a port (shared by manual connect + auto-detect) ─────────
  const openPort = useCallback(async (port: SerialPort) => {
    await port.open({
      baudRate: config.baudRate,
      parity: config.parity,
      stopBits: config.stopBits as 1 | 2,
      dataBits: 8,
    });

    portRef.current = port;
    runningRef.current = true;
    readingsBuffer.current = [];
    lastSentWeight.current = null;
    setScaleState('CONNECTED');
    setLastError(null);

    startReadLoop(port).then(() => {
      if (runningRef.current) {
        setScaleState('DISCONNECTED');
        setLastError('Serial connection ended unexpectedly');
      }
    });
  }, [config, startReadLoop]);

  // ── Checklist §3 "Request Port Access" ───────────────────────────
  const connect = useCallback(async () => {
    setLastError(null);

    // Checklist §5: Check if ('serial' in navigator)
    if (!('serial' in navigator)) {
      const msg = 'Web Serial API not supported. Use Chrome or Edge.';
      setLastError(msg);
      toast({ title: 'Not Supported', description: msg, variant: 'destructive' });
      return;
    }

    try {
      // Checklist: port = await navigator.serial.requestPort()
      const port = await navigator.serial.requestPort();
      await openPort(port);
      toast({ title: 'Scale Connected', description: `Serial port opened at ${config.baudRate} baud` });
    } catch (e: unknown) {
      // Checklist §5: Wrap port operations in try/catch
      const msg = e instanceof Error ? e.message : 'Failed to open serial port';
      console.error('Serial connect error:', e);
      setLastError(msg);
      setScaleState('DISCONNECTED');
      toast({ title: 'Connection Failed', description: msg, variant: 'destructive' });
    }
  }, [config, openPort]);

  // ── Disconnect ───────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    runningRef.current = false;

    if (readerRef.current) {
      try { await readerRef.current.cancel(); } catch { /* ignore */ }
      readerRef.current = null;
    }

    if (portRef.current) {
      try { await portRef.current.close(); } catch { /* ignore */ }
      portRef.current = null;
    }

    setScaleState('DISCONNECTED');
    setCurrentWeight(null);
    setStableWeight(null);
    readingsBuffer.current = [];
    toast({ title: 'Scale Disconnected', description: 'Serial port closed' });
  }, []);

  const resetForNextSale = useCallback(() => {
    setStableWeight(null);
    lastSentWeight.current = null;
    readingsBuffer.current = [];
    if (scaleState === 'STABLE') setScaleState('CONNECTED');
  }, [scaleState]);

  const updateConfig = useCallback((newConfig: Partial<ScaleConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    localStorage.setItem('scaleConfig', JSON.stringify(updated));
  }, [config]);

  // ── Auto-detect previously authorized port on startup ────────────
  useEffect(() => {
    if (!('serial' in navigator)) return;

    const autoConnect = async () => {
      try {
        const ports = await navigator.serial.getPorts();
        if (ports.length > 0) {
          console.log('[Scale] Auto-detecting previously authorized port…');
          await openPort(ports[0]);
          toast({ title: 'Scale Auto-Connected', description: `Resumed serial at ${config.baudRate} baud` });
        }
      } catch (e) {
        console.log('[Scale] Auto-connect skipped:', e);
      }
    };
    autoConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Checklist §6 "Cleanup" – close port on page unload ──────────
  useEffect(() => {
    const cleanup = async () => {
      runningRef.current = false;
      if (readerRef.current) {
        try { await readerRef.current.cancel(); } catch { /* ignore */ }
      }
      if (portRef.current) {
        try { await portRef.current.close(); } catch { /* ignore */ }
      }
    };

    window.addEventListener('beforeunload', cleanup);

    // Also clean up on unmount
    return () => {
      window.removeEventListener('beforeunload', cleanup);
      cleanup();
    };
  }, []);

  // ── Checklist §5 "Handle disconnect events" ─────────────────────
  useEffect(() => {
    if (!('serial' in navigator)) return;

    const onDisconnect = (e: Event) => {
      const disconnectedPort = (e as any).target;
      if (disconnectedPort === portRef.current) {
        console.log('[Scale] Port disconnected');
        runningRef.current = false;
        portRef.current = null;
        readerRef.current = null;
        setScaleState('DISCONNECTED');
        setCurrentWeight(null);
        setStableWeight(null);
        setLastError('Scale was disconnected');
        toast({ title: 'Scale Disconnected', description: 'The serial device was removed', variant: 'destructive' });
      }
    };

    navigator.serial.addEventListener('disconnect', onDisconnect);
    return () => navigator.serial.removeEventListener('disconnect', onDisconnect);
  }, []);

  return {
    scaleState,
    isConnected: scaleState !== 'DISCONNECTED',
    isStable: scaleState === 'STABLE',
    isWeighing: scaleState === 'WEIGHING',
    currentWeight,
    stableWeight,
    config,
    lastError,
    connect,
    disconnect,
    resetForNextSale,
    updateConfig,
  };
}
