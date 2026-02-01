import { Wifi, WifiOff, Activity, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScaleState } from '@/hooks/useScaleConnection';

interface ScaleStatusIndicatorProps {
  scaleState: ScaleState;
  className?: string;
}

const stateConfig: Record<ScaleState, { 
  label: string; 
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: typeof Wifi;
  color: string;
}> = {
  DISCONNECTED: {
    label: 'Scale Disconnected',
    variant: 'destructive',
    icon: WifiOff,
    color: 'text-destructive'
  },
  CONNECTED: {
    label: 'Scale Connected',
    variant: 'default',
    icon: Wifi,
    color: 'text-primary'
  },
  WEIGHING: {
    label: 'Weighing...',
    variant: 'outline',
    icon: Activity,
    color: 'text-yellow-500'
  },
  STABLE: {
    label: 'Weight Locked',
    variant: 'default',
    icon: Lock,
    color: 'text-green-500'
  }
};

export function ScaleStatusIndicator({ scaleState, className }: ScaleStatusIndicatorProps) {
  const config = stateConfig[scaleState];
  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant} 
      className={cn(
        'gap-1.5 transition-all duration-300',
        scaleState === 'WEIGHING' && 'animate-pulse',
        className
      )}
    >
      <Icon className={cn('h-3 w-3', config.color)} />
      {config.label}
    </Badge>
  );
}
