import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Person } from '@/lib/peopleDataManager';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface PeopleTableProps {
  people: Person[];
  quarters: string[];
  effortSums: Record<string, Record<string, number>>;
  onPersonClick: (person: Person) => void;
}

export default function PeopleTable({
  people,
  quarters,
  effortSums,
  onPersonClick,
}: PeopleTableProps) {
  // Show only last 3 quarters for compact view
  const displayQuarters = quarters.slice(-3);

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[250px]">ФИО</TableHead>
            <TableHead className="w-[150px]">Unit</TableHead>
            <TableHead className="w-[150px]">Команда</TableHead>
            {displayQuarters.map(q => (
              <TableHead key={q} className="w-[80px] text-center">
                {q.replace('20', '').replace('-', ' ')}
              </TableHead>
            ))}
            <TableHead className="w-[60px] text-center">∑</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map(person => {
            const personEfforts = effortSums[person.id] || {};
            const hasOverallocation = displayQuarters.some(q => (personEfforts[q] || 0) > 100);
            const totalEffort = displayQuarters.reduce((sum, q) => sum + (personEfforts[q] || 0), 0);
            const avgEffort = displayQuarters.length > 0 ? totalEffort / displayQuarters.length : 0;
            
            return (
              <TableRow
                key={person.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onPersonClick(person)}
              >
                <TableCell className="font-medium">
                  {person.full_name}
                  {person.terminated_at && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Уволен
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {person.unit || '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {person.team || '—'}
                </TableCell>
                {displayQuarters.map(q => {
                  const effort = personEfforts[q] || 0;
                  const isOver = effort > 100;
                  
                  return (
                    <TableCell key={q} className="text-center">
                      {effort > 0 ? (
                        <span className={isOver ? 'text-destructive font-medium' : ''}>
                          {effort}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="text-center">
                  {hasOverallocation ? (
                    <AlertTriangle className="h-4 w-4 text-destructive inline" />
                  ) : avgEffort > 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 inline" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
