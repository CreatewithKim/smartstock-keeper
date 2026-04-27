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

// Web Serial API parity type
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

// ACLAS PS6X parser patterns
const PATTERNS = {
  full: /P(\d{4,6})W([+-]?\d+\.?\d*)U(\d+\.?\d*)T(\d+\.?\d*)/,
  plu_weight: /P(\d{4,6})W([+-]?\d+\.?\d*)/,
  weight_only: /W([+-]?\d+\.?\d*)/,
  simple: /(\d+\.?\d*)\s*[kK][gG]/,
};

function parseScaleData(text: string): { weight: number; productId?: string } | null {
  if (!text.trim()) return null;

  let match = PATTERNS.full.exec(text);
  if (match) return { productId: match[1], weight: parseFloat(match[2]) };

  match = PATTERNS.plu_weight.exec(text);
  if (match) return { productId: match[1], weight: parseFloat(match[2]) };

  match = PATTERNS.weight_only.exec(text);
  if (match) return { weight: parseFloat(match[1]) };

  match = PATTERNS.simple.exec(text);
  if (match) return { weight: parseFloat(match[1]) };

  return null;
}

export function useScaleConnection() {
  const [scaleState, setScaleState] = useState<ScaleState>('DISCONNECTED');
  const [config, setConfig] = useState<ScaleConfig>(() => {
    const saved = localStorage.getItem('scaleConfig');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Strip out legacy middlewareUrl if present
        const { middlewareUrl, ...rest } = parsed;
        return { ...DEFAULT_CONFIG, ...rest };
      } catch {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  });
  const [currentWeight, setCurrentWeight] = useState<WeightData | null>(null);
  const [stableWeight, setStableWeight] = useState<WeightData | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const portRef = useRef<any>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const runningRef = useRef(false);

  // Stability tracking
  const readingsBuffer = useRef<number[]>([]);
  const lastSentWeight = useRef<number | null>(null);
  const lastSentTime = useRef<number>(0);

  const isStableReading = useCallback((weight: number): boolean => {
    const buf = readingsBuffer.current;
    buf.push(weight);
    if (buf.length > 10) buf.shift();

    if (buf.length < STABILITY_READINGS_REQUIRED) return false;
    const recent = buf.slice(-STABILITY_READINGS_REQUIRED);
    return Math.max(...recent) - Math.min(...recent) <= STABILITY_THRESHOLD;
  }, []);

  const isDuplicate = useCallback((weight: number): boolean => {
    if (lastSentWeight.current === null) return false;
    if (Math.abs(weight - lastSentWeight.current) > STABILITY_THRESHOLD) return false;
    return Date.now() - lastSentTime.current < DUPLICATE_TIMEOUT;
  }, []);

  const readLoop = useCallback(async (port: any) => {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable!.pipeTo(textDecoder.writable);
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
          const parsed = parseScaleData(line);
          if (!parsed || parsed.weight <= 0) continue;

          const weight = parsed.weight;
          
          // Always update current weight (live display)
          setCurrentWeight({
            weight,
            stable: false,
            productId: parsed.productId,
            timestamp: new Date(),
          });
          setScaleState('WEIGHING');
          setLastError(null);

          // Check stability
          if (isStableReading(weight) && !isDuplicate(weight)) {
            const avgWeight = readingsBuffer.current
              .slice(-STABILITY_READINGS_REQUIRED)
              .reduce((a, b) => a + b, 0) / STABILITY_READINGS_REQUIRED;
            const rounded = Math.round(avgWeight * 1000) / 1000;

            const stableData: WeightData = {
              weight: rounded,
              stable: true,
              productId: parsed.productId,
              timestamp: new Date(),
            };
            setCurrentWeight(stableData);
            setStableWeight(stableData);
            setScaleState('STABLE');
            lastSentWeight.current = rounded;
            lastSentTime.current = Date.now();
          } else if (
            stableWeight &&
            Math.abs(weight - (lastSentWeight.current ?? 0)) > STABILITY_THRESHOLD
          ) {
            // Weight changed significantly — reset stable
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
      await readableStreamClosed.catch(() => {});
    }
  }, [isStableReading, isDuplicate, stableWeight]);

  const connect = useCallback(async () => {
    setLastError(null);

    if (!('serial' in navigator)) {
      const msg = 'Web Serial API not supported. Use Chrome or Edge.';
      setLastError(msg);
      toast({ title: 'Not Supported', description: msg, variant: 'destructive' });
      return;
    }

    try {
      const port = await (navigator as any).serial.requestPort();
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

      toast({ title: 'Scale Connected', description: `Serial port opened at ${config.baudRate} baud` });

      readLoop(port).then(() => {
        if (runningRef.current) {
          // Unexpected end
          setScaleState('DISCONNECTED');
          setLastError('Serial connection ended unexpectedly');
        }
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to open serial port';
      console.error('Serial connect error:', e);
      setLastError(msg);
      setScaleState('DISCONNECTED');
      toast({ title: 'Connection Failed', description: msg, variant: 'destructive' });
    }
  }, [config, readLoop]);

  const disconnect = useCallback(async () => {
    runningRef.current = false;

    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch {}
      readerRef.current = null;
    }

    if (portRef.current) {
      try {
        await portRef.current.close();
      } catch {}
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
    if (scaleState === 'STABLE') {
      setScaleState('CONNECTED');
    }
  }, [scaleState]);

  const updateConfig = useCallback((newConfig: Partial<ScaleConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    localStorage.setItem('scaleConfig', JSON.stringify(updated));
  }, [config]);

  // Auto-connect on mount using previously granted ports
  useEffect(() => {
    const autoConnect = async () => {
      if (!('serial' in navigator)) return;
      try {
        const ports = await (navigator as any).serial.getPorts();
        if (ports.length > 0) {
          const port = ports[0];
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
          toast({ title: 'Scale Auto-Connected', description: `Resumed serial at ${config.baudRate} baud` });
          readLoop(port).then(() => {
            if (runningRef.current) {
              setScaleState('DISCONNECTED');
              setLastError('Serial connection ended unexpectedly');
            }
          });
        }
      } catch (e) {
        console.log('Auto-connect skipped:', e);
      }
    };
    autoConnect();

    return () => {
      runningRef.current = false;
      if (readerRef.current) {
        readerRef.current.cancel().catch(() => {});
      }
      if (portRef.current) {
        portRef.current.close().catch(() => {});
      }
    };
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
