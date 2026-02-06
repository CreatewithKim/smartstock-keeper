import { Scale, Lock, AlertTriangle, CheckCircle } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ScaleState, WeightData } from '@/hooks/useScaleConnection';

interface LiveWeightDisplayProps {
  scaleState: ScaleState;
  currentWeight: WeightData | null;
  stableWeight: WeightData | null;
  lastError?: string | null;
  onCompleteSale?: () => void;
  completeSaleDisabled?: boolean;
  isProcessing?: boolean;
  className?: string;
}

export function LiveWeightDisplay({ 
  scaleState, 
  currentWeight, 
  stableWeight,
  lastError,
  onCompleteSale,
  completeSaleDisabled = true,
  isProcessing = false,
  className 
}: LiveWeightDisplayProps) {
  const displayWeight = stableWeight?.weight ?? currentWeight?.weight ?? 0;
  const isStable = scaleState === 'STABLE';
  const isWeighing = scaleState === 'WEIGHING';
  const isDisconnected = scaleState === 'DISCONNECTED';
  const canCompleteSale = isStable && !completeSaleDisabled && !isProcessing;

  return (
    <GlassCard 
      className={cn(
        'p-6 transition-all duration-300',
        isStable && 'border-2 border-green-500/50 bg-green-500/5',
        isWeighing && 'border-2 border-yellow-500/50',
        isDisconnected && 'opacity-60',
        lastError && 'border-2 border-destructive/50',
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={cn(
            'h-10 w-10 rounded-xl flex items-center justify-center transition-colors',
            isStable ? 'bg-green-500/20' : 'bg-primary/20'
          )}>
            {isStable ? (
              <Lock className="h-5 w-5 text-green-500" />
            ) : (
              <Scale className={cn(
                'h-5 w-5 text-primary',
                isWeighing && 'animate-pulse'
              )} />
            )}
          </div>
          <div>
            <h3 className="font-semibold">Live Weight</h3>
            <p className="text-xs text-muted-foreground">
              {isStable ? 'Weight locked - ready to sell' : 
               isWeighing ? 'Measuring...' : 
               isDisconnected ? 'Scale not connected' : 'Waiting for item'}
            </p>
          </div>
        </div>
        
        {isStable && (
          <div className="flex items-center gap-1 text-green-500 text-sm font-medium">
            <Lock className="h-4 w-4" />
            Stable
          </div>
        )}
      </div>

      <div className={cn(
        'text-center py-6 rounded-lg transition-colors',
        isStable ? 'bg-green-500/10' : 'bg-muted/30'
      )}>
        <div className={cn(
          'text-5xl md:text-6xl font-bold font-mono tracking-tight transition-all',
          isStable ? 'text-green-500' : 
          isWeighing ? 'text-yellow-500' : 
          'text-foreground'
        )}>
          {displayWeight.toFixed(3)}
        </div>
        <div className="text-lg text-muted-foreground mt-1">kg</div>
      </div>

      {/* Complete Sale Button */}
      {onCompleteSale && (
        <div className="mt-4">
          <Button
            onClick={onCompleteSale}
            disabled={!canCompleteSale}
            className={cn(
              'w-full gap-2 text-base py-5',
              canCompleteSale 
                ? 'bg-green-600 hover:bg-green-700' 
                : ''
            )}
          >
            <CheckCircle className="h-5 w-5" />
            {isProcessing ? 'Processing...' : 'Complete Sale'}
          </Button>
          {!isStable && scaleState !== 'DISCONNECTED' && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Waiting for weight to stabilize...
            </p>
          )}
        </div>
      )}

      {lastError && (
        <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{lastError}</span>
        </div>
      )}

      {isDisconnected && !lastError && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          Connect to the scale for live weighing
        </p>
      )}
    </GlassCard>
  );
}
