import { useState } from 'react';
import { Plus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import QuarterCell from './QuarterCell';
import { AdminDataRow, AdminQuarterData } from '@/lib/adminDataManager';

interface InitiativeTableProps {
  data: AdminDataRow[];
  quarters: string[];
  onDataChange: (id: string, field: keyof AdminDataRow, value: string) => void;
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

  const handleCellClick = (id: string, field: string) => {
    setEditingCell({ id, field });
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const isEditing = (id: string, field: string) => 
    editingCell?.id === id && editingCell?.field === field;

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
      {/* Add button */}
      <div className="p-4 border-b border-border">
        <Button onClick={onAddInitiative} size="sm" className="gap-2">
          <Plus size={16} />
          Новая инициатива
        </Button>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <div className="min-w-max">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10 min-w-[100px]">Unit</TableHead>
                <TableHead className="sticky left-[100px] bg-card z-10 min-w-[120px]">Team</TableHead>
                <TableHead className="sticky left-[220px] bg-card z-10 min-w-[200px]">Initiative</TableHead>
                <TableHead className="min-w-[250px]">Description</TableHead>
                <TableHead className="min-w-[150px]">Doc Link</TableHead>
                {quarters.map(q => (
                  <TableHead key={q} className="min-w-[220px]">{q}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id} className={row.isNew ? 'bg-primary/5' : ''}>
                  {/* Unit - read only */}
                  <TableCell className="sticky left-0 bg-card z-10">
                    <span className="px-2 py-1 bg-muted/50 rounded text-sm">{row.unit}</span>
                  </TableCell>

                  {/* Team - read only */}
                  <TableCell className="sticky left-[100px] bg-card z-10">
                    <span className="px-2 py-1 bg-muted/50 rounded text-sm">{row.team}</span>
                  </TableCell>

                  {/* Initiative - editable */}
                  <TableCell 
                    className="sticky left-[220px] bg-card z-10"
                    onClick={() => handleCellClick(row.id, 'initiative')}
                  >
                    {isEditing(row.id, 'initiative') ? (
                      <Input
                        autoFocus
                        value={row.initiative}
                        onChange={(e) => onDataChange(row.id, 'initiative', e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={(e) => e.key === 'Enter' && handleCellBlur()}
                        className="h-8"
                      />
                    ) : (
                      <span className={`cursor-pointer hover:bg-secondary px-2 py-1 rounded block ${
                        modifiedIds.has(row.id) ? 'ring-2 ring-primary/30' : ''
                      }`}>
                        {row.initiative || <span className="text-muted-foreground italic">Без названия</span>}
                      </span>
                    )}
                  </TableCell>

                  {/* Description - editable */}
                  <TableCell onClick={() => handleCellClick(row.id, 'description')}>
                    {isEditing(row.id, 'description') ? (
                      <Input
                        autoFocus
                        value={row.description}
                        onChange={(e) => onDataChange(row.id, 'description', e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={(e) => e.key === 'Enter' && handleCellBlur()}
                        className="h-8"
                      />
                    ) : (
                      <span className="cursor-pointer hover:bg-secondary px-2 py-1 rounded block text-sm line-clamp-2">
                        {row.description || <span className="text-muted-foreground italic">—</span>}
                      </span>
                    )}
                  </TableCell>

                  {/* Doc Link - editable */}
                  <TableCell onClick={() => handleCellClick(row.id, 'documentationLink')}>
                    {isEditing(row.id, 'documentationLink') ? (
                      <Input
                        autoFocus
                        value={row.documentationLink}
                        onChange={(e) => onDataChange(row.id, 'documentationLink', e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={(e) => e.key === 'Enter' && handleCellBlur()}
                        className="h-8"
                        placeholder="https://..."
                      />
                    ) : row.documentationLink ? (
                      <a 
                        href={row.documentationLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={14} />
                        <span className="truncate max-w-[120px]">Документация</span>
                      </a>
                    ) : (
                      <span className="cursor-pointer hover:bg-secondary px-2 py-1 rounded block text-sm text-muted-foreground italic">
                        Добавить ссылку
                      </span>
                    )}
                  </TableCell>

                  {/* Quarter cells */}
                  {quarters.map(q => (
                    <TableCell key={q} className="p-2">
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
    </div>
  );
};

export default InitiativeTable;
