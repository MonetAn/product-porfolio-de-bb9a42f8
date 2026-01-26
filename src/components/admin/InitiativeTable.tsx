import { useState } from 'react';
import { Plus, ExternalLink, ChevronRight, Eye, EyeOff, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import QuarterCell from './QuarterCell';
import InitiativeDetailDialog from './InitiativeDetailDialog';
import { AdminDataRow, AdminQuarterData, INITIATIVE_TYPES, STAKEHOLDERS_LIST, InitiativeType } from '@/lib/adminDataManager';

interface InitiativeTableProps {
  data: AdminDataRow[];
  quarters: string[];
  onDataChange: (id: string, field: keyof AdminDataRow, value: string | string[]) => void;
  onQuarterDataChange: (id: string, quarter: string, field: keyof AdminQuarterData, value: string | number | boolean) => void;
  onAddInitiative: () => void;
  modifiedIds: Set<string>;
}

const InitiativeTable = ({
  data,
  quarters,
  onDataChange,
  onQuarterDataChange,
  onAddInitiative,
  modifiedIds
}: InitiativeTableProps) => {
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [selectedInitiative, setSelectedInitiative] = useState<AdminDataRow | null>(null);
  const [expandedView, setExpandedView] = useState(false);

  const handleCellClick = (id: string, field: string) => {
    setEditingCell({ id, field });
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const isEditing = (id: string, field: string) => 
    editingCell?.id === id && editingCell?.field === field;

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

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <Button onClick={onAddInitiative} size="sm" className="gap-2">
          <Plus size={16} />
          Новая инициатива
        </Button>
        
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
              {data.map((row) => (
                <TableRow 
                  key={row.id} 
                  className={`${row.isNew ? 'bg-primary/5' : ''} hover:bg-muted/50 cursor-pointer`}
                >
                  {/* Row click indicator */}
                  <TableCell 
                    className="sticky left-0 bg-card z-10 p-1"
                    onClick={() => handleRowClick(row)}
                  >
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </TableCell>

                  {/* Unit - read only */}
                  <TableCell 
                    className="sticky left-[32px] bg-card z-10 p-2"
                    onClick={() => handleRowClick(row)}
                  >
                    <span className="px-1.5 py-0.5 bg-muted/50 rounded text-xs truncate block max-w-[80px]">{row.unit}</span>
                  </TableCell>

                  {/* Team - read only */}
                  <TableCell 
                    className="sticky left-[122px] bg-card z-10 p-2"
                    onClick={() => handleRowClick(row)}
                  >
                    <span className="px-1.5 py-0.5 bg-muted/50 rounded text-xs truncate block max-w-[90px]">{row.team}</span>
                  </TableCell>

                  {/* Initiative - editable inline */}
                  <TableCell 
                    className="sticky left-[222px] bg-card z-10 p-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCellClick(row.id, 'initiative');
                    }}
                  >
                    {isEditing(row.id, 'initiative') ? (
                      <Input
                        autoFocus
                        value={row.initiative}
                        onChange={(e) => onDataChange(row.id, 'initiative', e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={(e) => e.key === 'Enter' && handleCellBlur()}
                        className="h-7 text-xs"
                      />
                    ) : (
                      <span className={`cursor-pointer hover:bg-secondary px-1.5 py-0.5 rounded block text-xs truncate max-w-[150px] ${
                        modifiedIds.has(row.id) ? 'ring-2 ring-primary/30' : ''
                      }`}>
                        {row.initiative || <span className="text-muted-foreground italic">—</span>}
                      </span>
                    )}
                  </TableCell>

                  {/* Type - dropdown with tooltips */}
                  <TableCell className="p-2" onClick={(e) => e.stopPropagation()}>
                    <TooltipProvider>
                      <Select
                        value={row.initiativeType || ''}
                        onValueChange={(value) => onDataChange(row.id, 'initiativeType', value)}
                      >
                        <SelectTrigger className="h-7 text-xs w-[90px]">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {INITIATIVE_TYPES.map(type => (
                            <Tooltip key={type.value}>
                              <TooltipTrigger asChild>
                                <SelectItem value={type.value} className="text-xs">
                                  <div className="flex items-center gap-1">
                                    {type.label}
                                    <Info size={10} className="text-muted-foreground" />
                                  </div>
                                </SelectItem>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-[200px]">
                                <p className="text-xs">{type.description}</p>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </SelectContent>
                      </Select>
                    </TooltipProvider>
                  </TableCell>

                  {/* Stakeholders - multi-select badges */}
                  <TableCell className="p-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-0.5 max-w-[130px]">
                      {row.stakeholdersList && row.stakeholdersList.length > 0 ? (
                        row.stakeholdersList.slice(0, 2).map(s => (
                          <Badge key={s} variant="secondary" className="text-[10px] px-1 py-0">
                            {s.length > 6 ? s.slice(0, 6) + '…' : s}
                          </Badge>
                        ))
                      ) : null}
                      {row.stakeholdersList && row.stakeholdersList.length > 2 && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          +{row.stakeholdersList.length - 2}
                        </Badge>
                      )}
                      {(!row.stakeholdersList || row.stakeholdersList.length === 0) && (
                        <span 
                          className="text-xs text-muted-foreground italic cursor-pointer hover:text-foreground"
                          onClick={() => handleRowClick(row)}
                        >
                          —
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Description - truncated, click to open detail */}
                  <TableCell 
                    onClick={() => handleRowClick(row)}
                    className="cursor-pointer p-2"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className={`block text-xs text-muted-foreground hover:text-foreground transition-colors ${
                          expandedView ? 'line-clamp-3' : 'line-clamp-1'
                        } max-w-[${expandedView ? '190px' : '110px'}]`}>
                          {row.description || <span className="italic">—</span>}
                        </span>
                      </TooltipTrigger>
                      {row.description && (
                        <TooltipContent side="bottom" className="max-w-[300px]">
                          <p className="text-xs">{row.description}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TableCell>

                  {/* Doc Link - editable */}
                  <TableCell className="p-2" onClick={(e) => {
                    e.stopPropagation();
                    handleCellClick(row.id, 'documentationLink');
                  }}>
                    {isEditing(row.id, 'documentationLink') ? (
                      <Input
                        autoFocus
                        value={row.documentationLink}
                        onChange={(e) => onDataChange(row.id, 'documentationLink', e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={(e) => e.key === 'Enter' && handleCellBlur()}
                        className="h-7 text-xs"
                        placeholder="https://..."
                      />
                    ) : row.documentationLink ? (
                      <a 
                        href={row.documentationLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={12} />
                        <span className="truncate max-w-[70px]">Ссылка</span>
                      </a>
                    ) : (
                      <span className="cursor-pointer hover:bg-secondary px-1 py-0.5 rounded block text-xs text-muted-foreground italic">
                        —
                      </span>
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
              ))}
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
