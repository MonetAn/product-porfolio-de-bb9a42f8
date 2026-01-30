import { useState } from 'react';
import { ChevronDown, ChevronUp, Wrench, Lock, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
  // Cascading support props
  isInheritedSupport?: boolean;
  inheritedFromQuarter?: string;
  onSupportChange?: (value: boolean) => void;
}

// Get list of missing required fields
const getMissingFields = (data: AdminQuarterData): string[] => {
  const missing: string[] = [];
  if (!data.metricPlan) missing.push('План метрики');
  if (!data.metricFact) missing.push('Факт метрики');
  return missing;
};

const QuarterCell = ({ 
  quarter, 
  data, 
  onChange, 
  isModified, 
  expandedView, 
  teamEffort, 
  isExpanded, 
  onToggleExpand,
  isInheritedSupport = false,
  inheritedFromQuarter,
  onSupportChange
}: QuarterCellProps) => {
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

  const handleCellClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('input, button, [role="switch"]')) return;
    onToggleExpand();
  };

  // Determine which status icon to show (priority: support > off-track)
  const getStatusIndicator = () => {
    if (data.support) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center text-muted-foreground">
              <Wrench size={12} />
              {isInheritedSupport && <Lock size={10} className="ml-0.5" />}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">
              {isInheritedSupport 
                ? `Режим поддержки (от ${inheritedFromQuarter})`
                : 'Режим поддержки'
              }
            </p>
          </TooltipContent>
        </Tooltip>
      );
    }
    if (!data.onTrack) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertTriangle size={12} className="text-destructive" />
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Не в плане (Off-track)</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    return null;
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
              
              {/* Compact View - Simplified: only cost + status */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {/* Cost */}
                  <span className="text-sm font-medium">{formatCurrency(totalCost)} ₽</span>
                  
                  {/* Single status indicator */}
                  {getStatusIndicator()}
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
                  {effortValue > 0 && (
                    <div>
                      <span className="font-medium">Effort:</span> {effortValue}%
                    </div>
                  )}
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
                </div>
              )}

              {/* Full Expanded Content */}
              <CollapsibleContent className="space-y-3 pt-2 border-t border-border/50">
                {/* Effort Coefficient - moved from compact view */}
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
                      step={5}
                      className="w-20 h-8"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  {teamEffort && (
                    <div className={`text-[10px] ${teamEffort.isValid ? 'text-muted-foreground' : 'text-destructive'}`}>
                      Всего: {teamEffort.total}%{!teamEffort.isValid && ' ⚠'}
                    </div>
                  )}
                </div>

                {/* Support Mode Toggle */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Режим поддержки</span>
                      {isInheritedSupport && <Lock size={12} className="text-muted-foreground" />}
                    </div>
                    <Switch
                      checked={data.support}
                      onCheckedChange={(checked) => {
                        if (onSupportChange) {
                          onSupportChange(checked);
                        } else {
                          onChange('support', checked);
                        }
                      }}
                      disabled={isInheritedSupport}
                    />
                  </div>
                  {isInheritedSupport ? (
                    <div className="flex items-start gap-1 text-[10px] text-muted-foreground">
                      <Info size={10} className="mt-0.5 flex-shrink-0" />
                      <span>Унаследовано от {inheritedFromQuarter}</span>
                    </div>
                  ) : data.support ? (
                    <div className="flex items-start gap-1 text-[10px] text-destructive">
                      <AlertCircle size={10} className="mt-0.5 flex-shrink-0" />
                      <span>Все последующие кварталы будут в режиме поддержки</span>
                    </div>
                  ) : null}
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
