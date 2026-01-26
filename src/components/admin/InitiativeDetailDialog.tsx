import { useState, useEffect } from 'react';
import { ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AdminDataRow, AdminQuarterData } from '@/lib/adminDataManager';

interface InitiativeDetailDialogProps {
  initiative: AdminDataRow | null;
  quarters: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataChange: (id: string, field: keyof AdminDataRow, value: string) => void;
  onQuarterDataChange: (id: string, quarter: string, field: keyof AdminQuarterData, value: string | number | boolean) => void;
}

const InitiativeDetailDialog = ({
  initiative,
  quarters,
  open,
  onOpenChange,
  onDataChange,
  onQuarterDataChange,
}: InitiativeDetailDialogProps) => {
  if (!initiative) return null;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M ₽`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K ₽`;
    return `${value} ₽`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{initiative.unit}</Badge>
            <span>→</span>
            <Badge variant="outline">{initiative.team}</Badge>
          </div>
          <DialogTitle className="text-xl">
            <Input
              value={initiative.initiative}
              onChange={(e) => onDataChange(initiative.id, 'initiative', e.target.value)}
              className="text-xl font-semibold border-none px-0 h-auto focus-visible:ring-0"
              placeholder="Название инициативы"
            />
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Description */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Описание</Label>
              <Textarea
                value={initiative.description}
                onChange={(e) => onDataChange(initiative.id, 'description', e.target.value)}
                placeholder="Подробное описание инициативы..."
                className="min-h-[100px] resize-y"
              />
            </div>

            {/* Documentation Link */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Ссылка на документацию</Label>
              <div className="flex gap-2">
                <Input
                  value={initiative.documentationLink}
                  onChange={(e) => onDataChange(initiative.id, 'documentationLink', e.target.value)}
                  placeholder="https://..."
                  className="flex-1"
                />
                {initiative.documentationLink && (
                  <a
                    href={initiative.documentationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-10 h-10 rounded-md border border-input bg-background hover:bg-accent"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </div>

            {/* Stakeholders */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Стейкхолдеры</Label>
              <Input
                value={initiative.stakeholders}
                onChange={(e) => onDataChange(initiative.id, 'stakeholders', e.target.value)}
                placeholder="Список стейкхолдеров..."
              />
            </div>

            <Separator />

            {/* Quarters - Vertical Timeline */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Квартальные данные</Label>
              
              <div className="space-y-4">
                {quarters.map((quarter, index) => {
                  const qData = initiative.quarterlyData[quarter] || {
                    cost: 0,
                    otherCosts: 0,
                    support: false,
                    onTrack: true,
                    metricPlan: '',
                    metricFact: '',
                    comment: ''
                  };

                  const totalCost = qData.cost + qData.otherCosts;
                  const prevQuarter = quarters[index - 1];
                  const prevCost = prevQuarter 
                    ? (initiative.quarterlyData[prevQuarter]?.cost || 0) + (initiative.quarterlyData[prevQuarter]?.otherCosts || 0)
                    : 0;
                  const costDiff = index > 0 ? totalCost - prevCost : 0;

                  return (
                    <div 
                      key={quarter} 
                      className={`rounded-lg border p-4 space-y-4 ${
                        qData.onTrack ? 'border-border' : 'border-destructive/50 bg-destructive/5'
                      }`}
                    >
                      {/* Quarter Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold text-lg">{quarter}</h4>
                          {qData.support && (
                            <Badge variant="secondary" className="text-xs">Поддержка</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          {/* Cost display */}
                          <div className="text-right">
                            <div className="font-medium">{formatCurrency(totalCost)}</div>
                            {costDiff !== 0 && (
                              <div className={`text-xs flex items-center gap-1 ${
                                costDiff > 0 ? 'text-destructive' : 'text-green-600'
                              }`}>
                                {costDiff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                {costDiff > 0 ? '+' : ''}{formatCurrency(costDiff)}
                              </div>
                            )}
                          </div>
                          
                          {/* OnTrack toggle */}
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">On-Track</Label>
                            <Switch
                              checked={qData.onTrack}
                              onCheckedChange={(checked) => 
                                onQuarterDataChange(initiative.id, quarter, 'onTrack', checked)
                              }
                            />
                          </div>
                        </div>
                      </div>

                      {/* Quarter Fields */}
                      <div className="grid grid-cols-2 gap-4">
                        {/* Cost (read-only) */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Стоимость (из CSV)</Label>
                          <Input
                            value={formatCurrency(qData.cost)}
                            disabled
                            className="bg-muted/50"
                          />
                        </div>

                        {/* Other Costs (editable) */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Доп. расходы</Label>
                          <Input
                            type="number"
                            value={qData.otherCosts || ''}
                            onChange={(e) => 
                              onQuarterDataChange(initiative.id, quarter, 'otherCosts', parseFloat(e.target.value) || 0)
                            }
                            placeholder="0"
                          />
                        </div>

                        {/* Metric Plan */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">План метрики</Label>
                          <Textarea
                            value={qData.metricPlan}
                            onChange={(e) => 
                              onQuarterDataChange(initiative.id, quarter, 'metricPlan', e.target.value)
                            }
                            placeholder="Планируемое значение метрики..."
                            className="min-h-[60px] resize-y"
                          />
                        </div>

                        {/* Metric Fact */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Факт метрики</Label>
                          <Textarea
                            value={qData.metricFact}
                            onChange={(e) => 
                              onQuarterDataChange(initiative.id, quarter, 'metricFact', e.target.value)
                            }
                            placeholder="Фактическое значение метрики..."
                            className="min-h-[60px] resize-y"
                          />
                        </div>
                      </div>

                      {/* Comment - full width */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Комментарий</Label>
                        <Textarea
                          value={qData.comment}
                          onChange={(e) => 
                            onQuarterDataChange(initiative.id, quarter, 'comment', e.target.value)
                          }
                          placeholder="Комментарии к кварталу..."
                          className="min-h-[80px] resize-y"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default InitiativeDetailDialog;
