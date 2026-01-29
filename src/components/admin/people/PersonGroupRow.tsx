import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Person, VirtualAssignment } from '@/lib/peopleDataManager';
import { AdminDataRow } from '@/lib/adminDataManager';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import EffortInput from './EffortInput';
import { cn } from '@/lib/utils';

interface PersonGroupRowProps {
  person: Person;
  assignments: VirtualAssignment[];
  initiatives: AdminDataRow[];
  quarters: string[];
  onEffortChange: (assignment: VirtualAssignment, quarter: string, value: number) => void;
}

export default function PersonGroupRow({
  person,
  assignments,
  initiatives,
  quarters,
  onEffortChange
}: PersonGroupRowProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Calculate totals per quarter for this person
  const quarterTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    quarters.forEach(q => {
      totals[q] = assignments.reduce((sum, a) => sum + (a.quarterly_effort[q] || 0), 0);
    });
    return totals;
  }, [assignments, quarters]);

  // Check for over-allocation
  const hasOverallocation = Object.values(quarterTotals).some(total => total > 100);

  // Get initiative info for assignments
  const assignmentDetails = useMemo(() => {
    return assignments.map(a => ({
      assignment: a,
      initiative: initiatives.find(i => i.id === a.initiative_id)
    })).filter(d => d.initiative); // Only show assignments with valid initiatives
  }, [assignments, initiatives]);

  if (assignmentDetails.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b">
      <CollapsibleTrigger asChild>
        <div className={cn(
          "flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors",
          hasOverallocation && "bg-destructive/5"
        )}>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{person.full_name}</span>
              {person.terminated_at && (
                <Badge variant="secondary" className="text-xs">Уволен</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {person.team || person.unit || '—'}
            </div>
          </div>

          {/* Quarter totals in header */}
          <div className="flex items-center gap-2">
            {quarters.map(q => {
              const total = quarterTotals[q] || 0;
              const isOver = total > 100;
              const isUnder = total < 100 && total > 0;
              
              return (
                <div 
                  key={q} 
                  className={cn(
                    "text-xs font-mono px-2 py-1 rounded min-w-[60px] text-center",
                    isOver && "bg-destructive/20 text-destructive",
                    isUnder && "bg-muted text-muted-foreground",
                    total === 100 && "bg-primary/20 text-primary",
                    total === 0 && "bg-muted/50 text-muted-foreground"
                  )}
                  title={`${q}: ${total}%`}
                >
                  {total}%
                  {isOver && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                  {total === 100 && <CheckCircle2 className="inline h-3 w-3 ml-1" />}
                </div>
              );
            })}
          </div>

          <Badge variant="outline" className="ml-2">
            {assignmentDetails.length} инициатив
          </Badge>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="bg-muted/20 border-t">
          {assignmentDetails.map(({ assignment, initiative }) => (
            <div 
              key={assignment.id || `${assignment.person_id}-${assignment.initiative_id}`}
              className="flex items-center gap-3 px-4 py-2 pl-10 border-b border-border/50 last:border-b-0 hover:bg-muted/30"
            >
              {/* Initiative info */}
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium" title={initiative!.initiative}>
                  {initiative!.initiative}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[initiative!.team, initiative!.initiativeType].filter(Boolean).join(' • ')}
                </div>
              </div>

              {/* Quarter efforts */}
              <div className="flex items-center gap-2">
                {quarters.map(q => (
                  <EffortInput
                    key={q}
                    value={assignment.quarterly_effort[q] || 0}
                    isAuto={assignment.is_auto}
                    isVirtual={assignment.isVirtual}
                    onChange={(value) => onEffortChange(assignment, q, value)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
