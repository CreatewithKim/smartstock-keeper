import { Scale } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScaleConfig } from '@/hooks/useScaleConnection';

interface ScaleConfigurationProps {
  config: ScaleConfig;
  onConfigChange: (config: Partial<ScaleConfig>) => void;
  disabled?: boolean;
}

const BAUD_RATES = [4800, 9600, 19200, 38400, 57600, 115200];
const PARITY_OPTIONS = ['none', 'even', 'odd'];
const STOP_BITS_OPTIONS = [1, 2];

export function ScaleConfiguration({ config, onConfigChange, disabled = false }: ScaleConfigurationProps) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Scale className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Scale Configuration</h3>
          <p className="text-xs text-muted-foreground">ACLAS PS6X Serial Port Settings</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>COM Port</Label>
          <Input
            value={config.port}
            onChange={(e) => onConfigChange({ port: e.target.value })}
            placeholder="COM3"
            disabled={disabled}
          />
        </div>
        
        <div className="space-y-2">
          <Label>Baud Rate</Label>
          <Select
            value={config.baudRate.toString()}
            onValueChange={(v) => onConfigChange({ baudRate: parseInt(v) })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BAUD_RATES.map(rate => (
                <SelectItem key={rate} value={rate.toString()}>{rate}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label>Parity</Label>
          <Select
            value={config.parity}
            onValueChange={(v) => onConfigChange({ parity: v as 'none' | 'even' | 'odd' })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARITY_OPTIONS.map(parity => (
                <SelectItem key={parity} value={parity}>
                  {parity.charAt(0).toUpperCase() + parity.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label>Stop Bits</Label>
          <Select
            value={config.stopBits.toString()}
            onValueChange={(v) => onConfigChange({ stopBits: parseInt(v) })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STOP_BITS_OPTIONS.map(bits => (
                <SelectItem key={bits} value={bits.toString()}>{bits}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </GlassCard>
  );
}
