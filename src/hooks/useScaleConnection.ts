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

const STOP_MOVING_MS = 800; // display number unchanged for 0.8s = locked

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

  // Weight-lock tracking – locks when weight stops moving
  const lastReadingRef = useRef<number | null>(null);
  const lastChangedTime = useRef<number>(Date.now());
  const stableWeightRef = useRef<WeightData | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { stableWeightRef.current = stableWeight; }, [stableWeight]);

  // Called on each reading – if weight changed, reset the timer; otherwise let it count
  const handleWeightReading = useCallback((weight: number) => {
    // Round to 3 decimal places – this is the number shown on screen
    const displayNum = Math.round(weight * 1000) / 1000;
    const prev = lastReadingRef.current;
    lastReadingRef.current = displayNum;

    const numberChanged = prev !== null && prev !== displayNum;

    if (numberChanged) {
      // Displayed number changed – clear any pending lock, unlock if locked
      lastChangedTime.current = Date.now();
      if (lockTimerRef.current) {
        clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
      }
      if (stableWeightRef.current) {
        setStableWeight(null);
        setScaleState('WEIGHING');
      }
    }

    // If not already locked and display number > 0, schedule a lock
    if (!stableWeightRef.current && displayNum > 0 && !lockTimerRef.current) {
      lockTimerRef.current = setTimeout(() => {
        lockTimerRef.current = null;
        const current = lastReadingRef.current;
        if (current !== null && current > 0) {
          const data: WeightData = {
            weight: current,
            stable: true,
            timestamp: new Date(),
          };
          setCurrentWeight(data);
          setStableWeight(data);
          setScaleState('STABLE');
        }
      }, STOP_MOVING_MS);
    }

    // Zero on display – item removed, unlock
    if (displayNum === 0 && stableWeightRef.current) {
      setStableWeight(null);
      setScaleState('WEIGHING');
      if (lockTimerRef.current) {
        clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
      }
    }
  }, []);

  // ── Core read loop (follows checklist §3 "Read Serial Data") ─────
  const startReadLoop = useCallback(async (port: SerialPort) => {
    const textDecoder = new TextDecoderStream();
    // @ts-ignore
    const pipeClosed = port.readable!.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    let lineBuffer = '';

    try {
      while (runningRef.current) {
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

          setCurrentWeight({
            weight: displayWeight,
            stable: false,
            timestamp: new Date(),
          });
          setScaleState('WEIGHING');
          setLastError(null);

          if (!isNaN(weight)) {
            handleWeightReading(weight);
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
    lastReadingRef.current = null;
    lastChangedTime.current = Date.now();
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
    lastReadingRef.current = null;
    toast({ title: 'Scale Disconnected', description: 'Serial port closed' });
  }, []);

  const resetForNextSale = useCallback(() => {
    setStableWeight(null);
    lastReadingRef.current = null;
    lastChangedTime.current = Date.now();
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
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
