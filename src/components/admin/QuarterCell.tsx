import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
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
  teamEffort?: { total: number; isValid: boolean };
  isExpanded: boolean;
  onToggleExpand: () => void;
}

// Get list of missing required fields
const getMissingFields = (data: AdminQuarterData): string[] => {
  const missing: string[] = [];
  if (!data.metricPlan) missing.push('План метрики');
  if (!data.metricFact) missing.push('Факт метрики');
  return missing;
};

const QuarterCell = ({ quarter, data, onChange, isModified, expandedView, teamEffort, isExpanded, onToggleExpand }: QuarterCellProps) => {
  const [isEditingEffort, setIsEditingEffort] = useState(false);
  const [effortInputValue, setEffortInputValue] = useState('');

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toString();
  };

  const totalCost = data.cost + data.otherCosts;
  const effortValue = data.effortCoefficient || 0;

  // Check if required fields are missing
  const missingFields = getMissingFields(data);
  const isIncomplete = missingFields.length > 0;

  const handleEffortSave = () => {
    const value = parseInt(effortInputValue) || 0;
    const clampedValue = Math.max(0, Math.min(100, value));
    onChange('effortCoefficient', clampedValue);
    setIsEditingEffort(false);
  };

  const handleCellClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('input, button, [role="switch"]')) return;
    onToggleExpand();
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={`rounded-md border p-2 space-y-2 cursor-pointer transition-colors hover:bg-muted/30 ${
                isIncomplete ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20' : 'border-border'
              }`}
              onClick={handleCellClick}
            >
              
              {/* Compact View - Always Visible */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* OnTrack indicator */}
                  <div className={`w-2 h-2 rounded-full ${data.onTrack ? 'bg-green-500' : 'bg-red-500'}`} />
            
                  {/* Cost */}
                  <span className="text-sm font-medium">{formatCurrency(totalCost)} ₽</span>
                  
                  {/* Effort % - Inline editable */}
                  {isEditingEffort ? (
                    <Input
                      type="number"
                      value={effortInputValue}
                      onChange={(e) => setEffortInputValue(e.target.value)}
                      onBlur={handleEffortSave}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEffortSave();
                        if (e.key === 'Escape') setIsEditingEffort(false);
                      }}
                      className="w-14 h-6 text-xs px-1.5"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      min={0}
                      max={100}
                    />
                  ) : (
                    <Badge 
                      variant={effortValue > 0 ? "default" : "outline"} 
                      className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-primary/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEffortInputValue(String(effortValue));
                        setIsEditingEffort(true);
                      }}
                    >
                      {effortValue}%
                    </Badge>
                  )}
            
                  {/* Support badge */}
                  {data.support && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">S</Badge>
                  )}
                </div>
          
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand();
                  }}
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </Button>
              </div>

              {/* Expanded View Preview - shown when toggle is on */}
              {expandedView && !isExpanded && (
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
                {/* Effort Coefficient */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Коэфф. трудозатрат</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={effortValue || ''}
                      onChange={(e) => onChange('effortCoefficient', parseInt(e.target.value) || 0)}
                      onClick={(e) => e.stopPropagation()}
                      min={0}
                      max={100}
                      className="w-20 h-8"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  {teamEffort && (
                    <div className={`text-[10px] ${teamEffort.isValid ? 'text-muted-foreground' : 'text-red-600'}`}>
                      Всего: {teamEffort.total}%{!teamEffort.isValid && ' ⚠'}
                    </div>
                  )}
                </div>

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
                    onClick={(e) => e.stopPropagation()}
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
                    onClick={(e) => e.stopPropagation()}
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
                    onClick={(e) => e.stopPropagation()}
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
                    onClick={(e) => e.stopPropagation()}
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
