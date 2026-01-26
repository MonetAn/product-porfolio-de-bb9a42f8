import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AdminQuarterData } from '@/lib/adminDataManager';

interface QuarterCellProps {
  quarter: string;
  data: AdminQuarterData;
  onChange: (field: keyof AdminQuarterData, value: string | number | boolean) => void;
  isModified?: boolean;
}

const QuarterCell = ({ quarter, data, onChange, isModified }: QuarterCellProps) => {
  const [expanded, setExpanded] = useState(false);

  const formatCost = (value: number) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
    return value.toString();
  };

  const totalCost = data.cost + data.otherCosts;

  return (
    <div className={`border border-border rounded-lg p-2 min-w-[200px] ${isModified ? 'ring-2 ring-primary/30' : ''}`}>
      {/* Compact view */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{quarter}</span>
          <span className={`w-2 h-2 rounded-full ${data.onTrack ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{formatCost(totalCost)}</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Expanded view */}
      {expanded && (
        <div className="mt-3 space-y-2 pt-2 border-t border-border">
          {/* Cost (read-only) */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Стоимость</span>
            <span className="text-xs bg-muted/50 px-2 py-1 rounded">{formatCost(data.cost)}</span>
          </div>

          {/* Other Costs */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Other Costs</span>
            <Input
              type="number"
              value={data.otherCosts || ''}
              onChange={(e) => onChange('otherCosts', parseFloat(e.target.value) || 0)}
              className="h-7 w-24 text-xs"
              placeholder="0"
            />
          </div>

          {/* OnTrack */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">On-Track</span>
            <Checkbox
              checked={data.onTrack}
              onCheckedChange={(checked) => onChange('onTrack', checked === true)}
            />
          </div>

          {/* Metric Plan */}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Metric Plan</span>
            <Input
              value={data.metricPlan}
              onChange={(e) => onChange('metricPlan', e.target.value)}
              className="h-7 text-xs"
              placeholder="План метрики"
            />
          </div>

          {/* Metric Fact */}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Metric Fact</span>
            <Input
              value={data.metricFact}
              onChange={(e) => onChange('metricFact', e.target.value)}
              className="h-7 text-xs"
              placeholder="Факт метрики"
            />
          </div>

          {/* Comment */}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Comment</span>
            <Input
              value={data.comment}
              onChange={(e) => onChange('comment', e.target.value)}
              className="h-7 text-xs"
              placeholder="Комментарий"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default QuarterCell;

