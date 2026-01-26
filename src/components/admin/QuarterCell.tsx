import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AdminQuarterData } from '@/lib/adminDataManager';

interface QuarterCellProps {
  quarter: string;
  data: AdminQuarterData;
  onChange: (field: keyof AdminQuarterData, value: string | number | boolean) => void;
  isModified?: boolean;
  expandedView?: boolean;
}

// Get list of missing required fields
const getMissingFields = (data: AdminQuarterData): string[] => {
  const missing: string[] = [];
  if (!data.metricPlan) missing.push('План метрики');
  if (!data.metricFact) missing.push('Факт метрики');
  return missing;
};

const QuarterCell = ({ quarter, data, onChange, isModified, expandedView }: QuarterCellProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  };

  const totalCost = data.cost + data.otherCosts;

  // Check if required fields are missing
  const missingFields = getMissingFields(data);
  const isIncomplete = missingFields.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`rounded-md border p-2 space-y-2 ${
              isIncomplete ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20' : 'border-border'
            }`}>
              
              {/* Compact View - Always Visible */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* OnTrack indicator */}
                  <div className={`w-2 h-2 rounded-full ${data.onTrack ? 'bg-green-500' : 'bg-red-500'}`} />
            
            {/* Cost */}
            <span className="text-sm font-medium">{formatCurrency(totalCost)} ₽</span>
            
            {/* Support badge */}
            {data.support && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">S</Badge>
            )}
          </div>
          
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </CollapsibleTrigger>
        </div>

        {/* Expanded View Preview - shown when toggle is on */}
        {expandedView && !isOpen && (
          <div className="text-xs text-muted-foreground space-y-1">
            {data.metricPlan && (
              <div className="line-clamp-1">
                <span className="font-medium">План:</span> {data.metricPlan}
              </div>
            )}
            {data.metricFact && (
              <div className="line-clamp-1">
                <span className="font-medium">Факт:</span> {data.metricFact}
              </div>
            )}
            {data.comment && (
              <div className="line-clamp-1 italic">{data.comment}</div>
            )}
          </div>
        )}

        {/* Full Expanded Content */}
        <CollapsibleContent className="space-y-3 pt-2 border-t border-border/50">
          {/* OnTrack Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">On-Track</span>
            <Switch
              checked={data.onTrack}
              onCheckedChange={(checked) => onChange('onTrack', checked)}
            />
          </div>

          {/* Other Costs */}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Доп. расходы</span>
            <Input
              type="number"
              value={data.otherCosts || ''}
              onChange={(e) => onChange('otherCosts', parseFloat(e.target.value) || 0)}
              className="h-7 text-sm"
              placeholder="0"
            />
          </div>

          {/* Metric Plan */}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">План метрики</span>
            <Input
              value={data.metricPlan}
              onChange={(e) => onChange('metricPlan', e.target.value)}
              className="h-7 text-sm"
              placeholder="..."
            />
          </div>

          {/* Metric Fact */}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Факт метрики</span>
            <Input
              value={data.metricFact}
              onChange={(e) => onChange('metricFact', e.target.value)}
              className="h-7 text-sm"
              placeholder="..."
            />
          </div>

          {/* Comment */}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Комментарий</span>
            <Input
              value={data.comment}
              onChange={(e) => onChange('comment', e.target.value)}
              className="h-7 text-sm"
              placeholder="..."
            />
          </div>
        </CollapsibleContent>
            </div>
          </TooltipTrigger>
          {isIncomplete && (
            <TooltipContent side="top" className="max-w-[200px]">
              <p className="text-xs font-medium mb-1">Не заполнено:</p>
              <ul className="text-xs list-disc list-inside">
                {missingFields.map(field => (
                  <li key={field}>{field}</li>
                ))}
              </ul>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </Collapsible>
  );
};

export default QuarterCell;

