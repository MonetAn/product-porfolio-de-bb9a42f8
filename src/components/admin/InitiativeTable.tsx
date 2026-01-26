import { useState } from 'react';
import { Plus, ExternalLink, Pencil, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import QuarterCell from './QuarterCell';
import InitiativeDetailDialog from './InitiativeDetailDialog';
import { AdminDataRow, AdminQuarterData, INITIATIVE_TYPES } from '@/lib/adminDataManager';

interface InitiativeTableProps {
  data: AdminDataRow[];
  quarters: string[];
  onDataChange: (id: string, field: keyof AdminDataRow, value: string | string[]) => void;
  onQuarterDataChange: (id: string, quarter: string, field: keyof AdminQuarterData, value: string | number | boolean) => void;
  onAddInitiative: () => void;
  modifiedIds: Set<string>;
}

// Get list of missing required fields for initiative
const getMissingInitiativeFields = (row: AdminDataRow): string[] => {
  const missing: string[] = [];
  if (!row.initiativeType) missing.push('Тип инициативы');
  if (!row.stakeholdersList || row.stakeholdersList.length === 0) missing.push('Стейкхолдеры');
  if (!row.description) missing.push('Описание');
  return missing;
};

// Check if initiative has incomplete required fields
const isInitiativeIncomplete = (row: AdminDataRow): boolean => {
  return getMissingInitiativeFields(row).length > 0;
};

// Check if quarter has incomplete required fields
const isQuarterIncomplete = (data: AdminQuarterData): boolean => {
  return !data.metricPlan || !data.metricFact;
};

const InitiativeTable = ({
  data,
  quarters,
  onDataChange,
  onQuarterDataChange,
  onAddInitiative,
  modifiedIds
}: InitiativeTableProps) => {
  const [selectedInitiative, setSelectedInitiative] = useState<AdminDataRow | null>(null);
  const [expandedView, setExpandedView] = useState(false);

  const handleRowClick = (row: AdminDataRow) => {
    setSelectedInitiative(row);
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-4">Нет инициатив для отображения</p>
        <Button onClick={onAddInitiative} className="gap-2">
          <Plus size={16} />
          Добавить инициативу
        </Button>
      </div>
    );
  }

  // Count incomplete initiatives
  const incompleteCount = data.filter(row => 
    isInitiativeIncomplete(row) || 
    quarters.some(q => isQuarterIncomplete(row.quarterlyData[q] || {} as AdminQuarterData))
  ).length;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={onAddInitiative} size="sm" className="gap-2">
            <Plus size={16} />
            Новая инициатива
          </Button>
          
          {/* Legend for incomplete fields */}
          {incompleteCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-500">
              <AlertCircle size={14} />
              <span>Требуется заполнить ({incompleteCount})</span>
            </div>
          )}
        </div>
        
        {/* Expanded View Toggle */}
        <div className="flex items-center gap-2">
          {expandedView ? <Eye size={16} /> : <EyeOff size={16} />}
          <Label htmlFor="expanded-view" className="text-sm cursor-pointer">
            Развернутый вид
          </Label>
          <Switch
            id="expanded-view"
            checked={expandedView}
            onCheckedChange={setExpandedView}
          />
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <div className="min-w-max">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10 min-w-[32px] w-[32px]"></TableHead>
                <TableHead className="sticky left-[32px] bg-card z-10 min-w-[90px]">Unit</TableHead>
                <TableHead className="sticky left-[122px] bg-card z-10 min-w-[100px]">Team</TableHead>
                <TableHead className="sticky left-[222px] bg-card z-10 min-w-[160px]">Initiative</TableHead>
                <TableHead className="min-w-[100px]">Type</TableHead>
                <TableHead className="min-w-[140px]">Stakeholders</TableHead>
                <TableHead className={`${expandedView ? 'min-w-[200px]' : 'min-w-[120px]'}`}>Description</TableHead>
                <TableHead className="min-w-[100px]">Doc</TableHead>
                {quarters.map(q => (
                  <TableHead key={q} className="min-w-[220px]">{q}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => {
                const initiativeIncomplete = isInitiativeIncomplete(row);
                const hasIncompleteQuarters = quarters.some(q => 
                  isQuarterIncomplete(row.quarterlyData[q] || {} as AdminQuarterData)
                );
                const rowIncomplete = initiativeIncomplete || hasIncompleteQuarters;
                
                return (
                <TableRow 
                  key={row.id} 
                  className={`group ${row.isNew ? 'bg-primary/5' : ''} ${rowIncomplete ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''} hover:bg-muted/50 cursor-pointer`}
                >
                  {/* Row edit button */}
                  <TableCell 
                    className="sticky left-0 bg-card z-10 p-1"
                    onClick={() => handleRowClick(row)}
                  >
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="relative flex items-center justify-center w-full h-full min-h-[24px] min-w-[24px]">
                            <Pencil size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                            {initiativeIncomplete && (
                              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white dark:border-card" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[200px]">
                          {initiativeIncomplete ? (
                            <>
                              <p className="text-xs font-medium mb-1">Не заполнено:</p>
                              <ul className="text-xs list-disc list-inside">
                                {getMissingInitiativeFields(row).map(field => (
                                  <li key={field}>{field}</li>
                                ))}
                              </ul>
                            </>
                          ) : (
                            <p className="text-xs">Редактировать</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>

                  {/* Unit - clickable link style */}
                  <TableCell 
                    className="sticky left-[32px] bg-card z-10 p-2 cursor-pointer"
                    onClick={() => handleRowClick(row)}
                  >
                    <span className="text-xs text-primary hover:underline">{row.unit}</span>
                  </TableCell>

                  {/* Team - clickable link style */}
                  <TableCell 
                    className="sticky left-[122px] bg-card z-10 p-2 cursor-pointer"
                    onClick={() => handleRowClick(row)}
                  >
                    <span className="text-xs text-primary hover:underline">{row.team || '—'}</span>
                  </TableCell>

                  {/* Initiative - clickable link style */}
                  <TableCell 
                    className="sticky left-[222px] bg-card z-10 p-2 cursor-pointer"
                    onClick={() => handleRowClick(row)}
                  >
                    <span className="text-xs text-primary hover:underline truncate block max-w-[150px]">
                      {row.initiative || <span className="text-muted-foreground italic">—</span>}
                    </span>
                  </TableCell>

                  {/* Type - clickable with tooltip */}
                  <TableCell 
                    className="p-2 cursor-pointer"
                    onClick={() => handleRowClick(row)}
                  >
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-primary hover:underline">
                            {row.initiativeType ? INITIATIVE_TYPES.find(t => t.value === row.initiativeType)?.label : '—'}
                          </span>
                        </TooltipTrigger>
                        {row.initiativeType && (
                          <TooltipContent side="bottom" className="max-w-[200px]">
                            <p className="text-xs">{INITIATIVE_TYPES.find(t => t.value === row.initiativeType)?.description}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>

                  {/* Stakeholders - clickable badges */}
                  <TableCell 
                    className="p-2 cursor-pointer"
                    onClick={() => handleRowClick(row)}
                  >
                    <div className="flex flex-wrap gap-0.5 max-w-[130px]">
                      {row.stakeholdersList && row.stakeholdersList.length > 0 ? (
                        <>
                          {row.stakeholdersList.slice(0, 2).map(s => (
                            <Badge key={s} variant="secondary" className="text-[10px] px-1 py-0">
                              {s.length > 6 ? s.slice(0, 6) + '…' : s}
                            </Badge>
                          ))}
                          {row.stakeholdersList.length > 2 && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              +{row.stakeholdersList.length - 2}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-primary hover:underline">—</span>
                      )}
                    </div>
                  </TableCell>

                  {/* Description - very truncated, click to see full */}
                  <TableCell 
                    onClick={() => handleRowClick(row)}
                    className="p-2 cursor-pointer"
                  >
                    <span className="block text-xs text-primary hover:underline truncate max-w-[100px]">
                      {row.description ? row.description.slice(0, 30) + (row.description.length > 30 ? '…' : '') : '—'}
                    </span>
                  </TableCell>

                  {/* Doc Link - clickable */}
                  <TableCell 
                    className="p-2 cursor-pointer"
                    onClick={() => handleRowClick(row)}
                  >
                    {row.documentationLink ? (
                      <a 
                        href={row.documentationLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={12} />
                        Ссылка
                      </a>
                    ) : (
                      <span className="text-xs text-primary hover:underline">—</span>
                    )}
                  </TableCell>

                  {/* Quarter cells */}
                  {quarters.map(q => (
                    <TableCell key={q} className="p-2" onClick={(e) => e.stopPropagation()}>
                      <QuarterCell
                        quarter={q}
                        data={row.quarterlyData[q] || {
                          cost: 0,
                          otherCosts: 0,
                          support: false,
                          onTrack: true,
                          metricPlan: '',
                          metricFact: '',
                          comment: ''
                        }}
                        onChange={(field, value) => onQuarterDataChange(row.id, q, field, value)}
                        isModified={modifiedIds.has(row.id)}
                        expandedView={expandedView}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Initiative Detail Dialog */}
      <InitiativeDetailDialog
        initiative={selectedInitiative}
        quarters={quarters}
        open={!!selectedInitiative}
        onOpenChange={(open) => !open && setSelectedInitiative(null)}
        onDataChange={onDataChange}
        onQuarterDataChange={onQuarterDataChange}
      />
    </div>
  );
};

export default InitiativeTable;
