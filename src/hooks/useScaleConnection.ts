import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

export type ScaleState = 'DISCONNECTED' | 'CONNECTED' | 'WEIGHING' | 'STABLE';

export interface ScaleConfig {
  port: string;
  baudRate: number;
  parity: string;
  stopBits: number;
  middlewareUrl: string;
}

export interface WeightData {
  weight: number;
  stable: boolean;
  productId?: string;
  timestamp: Date;
}

export interface PLUConfig {
  [plu: string]: number;
}

const DEFAULT_CONFIG: ScaleConfig = {
  port: 'COM3',
  baudRate: 9600,
  parity: 'none',
  stopBits: 1,
  middlewareUrl: 'ws://127.0.0.1:8765'
};

const RECONNECT_INTERVAL = 3000;
const HEARTBEAT_INTERVAL = 30000;
const WEIGHT_CHANGE_THRESHOLD = 0.01; // kg

export function useScaleConnection() {
  const [scaleState, setScaleState] = useState<ScaleState>('DISCONNECTED');
  const [config, setConfig] = useState<ScaleConfig>(() => {
    const saved = localStorage.getItem('scaleConfig');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });
  const [currentWeight, setCurrentWeight] = useState<WeightData | null>(null);
  const [stableWeight, setStableWeight] = useState<WeightData | null>(null);
  const [pluConfig, setPluConfig] = useState<PLUConfig>({});
  const [lastError, setLastError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(false);
  const lastStableWeightRef = useRef<number>(0);

  const clearTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL);
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Scale message:', data);
      setLastError(null);

      switch (data.type) {
        case 'weight_update':
          // Live weight update - weight is changing
          setScaleState('WEIGHING');
          setCurrentWeight({
            weight: data.weight ?? 0,
            stable: false,
            timestamp: new Date(data.timestamp || Date.now())
          });
          
          // Check if weight changed significantly (item removed or changed)
          if (stableWeight && Math.abs(data.weight - lastStableWeightRef.current) > WEIGHT_CHANGE_THRESHOLD) {
            setStableWeight(null);
          }
          break;

        case 'stable_weight':
          // Weight is stable - ready for sale
          setScaleState('STABLE');
          const stableData: WeightData = {
            weight: data.weight ?? 0,
            stable: true,
            productId: data.product_id,
            timestamp: new Date(data.timestamp || Date.now())
          };
          setCurrentWeight(stableData);
          setStableWeight(stableData);
          lastStableWeightRef.current = data.weight ?? 0;
          break;

        case 'plu_config':
          // PLU configuration sync from middleware
          if (data.data) {
            setPluConfig(data.data);
            console.log('PLU config received:', data.data);
          }
          break;

        case 'pong':
          // Heartbeat response - connection is alive
          console.log('Heartbeat received');
          break;

        case 'error':
          setLastError(data.message || 'Unknown scale error');
          toast({
            title: 'Scale Error',
            description: data.message || 'Unknown error from scale',
            variant: 'destructive'
          });
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (e) {
      console.error('Failed to parse scale message:', e);
    }
  }, [stableWeight]);

  const connect = useCallback(() => {
    clearTimers();
    shouldReconnectRef.current = true;
    setLastError(null);

    console.log('Connecting to scale middleware at', config.middlewareUrl);

    try {
      wsRef.current = new WebSocket(config.middlewareUrl);

      wsRef.current.onopen = () => {
        console.log('✅ Scale middleware connected');
        setScaleState('CONNECTED');
        setLastError(null);
        startHeartbeat();
        
        // Send initial config to middleware
        wsRef.current?.send(JSON.stringify({ 
          type: 'config',
          config: {
            port: config.port,
            baudRate: config.baudRate,
            parity: config.parity,
            stopBits: config.stopBits
          }
        }));

        toast({ 
          title: 'Scale Connected', 
          description: 'Real-time weighing is now active' 
        });
      };

      wsRef.current.onmessage = handleMessage;

      wsRef.current.onerror = (error) => {
        console.error('Scale connection error:', error);
        setLastError('Connection error');
        setScaleState('DISCONNECTED');
      };

      wsRef.current.onclose = () => {
        console.log('Scale disconnected');
        setScaleState('DISCONNECTED');
        clearTimers();

        if (shouldReconnectRef.current) {
          toast({ 
            title: 'Scale Disconnected', 
            description: 'Attempting to reconnect...', 
            variant: 'destructive' 
          });
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (shouldReconnectRef.current) {
              connect();
            }
          }, RECONNECT_INTERVAL);
        }
      };
    } catch (e) {
      console.error('Failed to initialize WebSocket:', e);
      setLastError('Failed to initialize connection');
      
      if (shouldReconnectRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (shouldReconnectRef.current) {
            connect();
          }
        }, RECONNECT_INTERVAL);
      }
    }
  }, [config, clearTimers, startHeartbeat, handleMessage]);

  const disconnect = useCallback(() => {
    console.log('Disconnecting from scale middleware');
    shouldReconnectRef.current = false;
    clearTimers();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setScaleState('DISCONNECTED');
    setCurrentWeight(null);
    setStableWeight(null);
    toast({ title: 'Scale Disconnected', description: 'Manual weighing mode enabled' });
  }, [clearTimers]);

  const resetForNextSale = useCallback(() => {
    // Reset to connected state after sale completion
    setStableWeight(null);
    lastStableWeightRef.current = 0;
    if (scaleState === 'STABLE') {
      setScaleState('CONNECTED');
    }
  }, [scaleState]);

  const updateConfig = useCallback((newConfig: Partial<ScaleConfig>) => {
    const updated = { ...config, ...newConfig };
    setConfig(updated);
    localStorage.setItem('scaleConfig', JSON.stringify(updated));
  }, [config]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldReconnectRef.current = false;
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [clearTimers]);

  return {
    // State
    scaleState,
    isConnected: scaleState !== 'DISCONNECTED',
    isStable: scaleState === 'STABLE',
    isWeighing: scaleState === 'WEIGHING',
    currentWeight,
    stableWeight,
    pluConfig,
    config,
    lastError,

    // Actions
    connect,
    disconnect,
    resetForNextSale,
    updateConfig
  };
}
