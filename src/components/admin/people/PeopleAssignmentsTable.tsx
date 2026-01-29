import { useMemo } from 'react';
import { Users, ClipboardList } from 'lucide-react';
import { Person, PersonAssignment } from '@/lib/peopleDataManager';
import { AdminDataRow } from '@/lib/adminDataManager';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import PersonGroupRow from './PersonGroupRow';
import InitiativeGroupRow from './InitiativeGroupRow';

type GroupMode = 'person' | 'initiative';

interface PeopleAssignmentsTableProps {
  people: Person[];
  initiatives: AdminDataRow[];
  assignments: PersonAssignment[];
  quarters: string[];
  groupMode: GroupMode;
  onGroupModeChange: (mode: GroupMode) => void;
  onEffortChange: (assignmentId: string, quarter: string, value: number) => void;
}

export default function PeopleAssignmentsTable({
  people,
  initiatives,
  assignments,
  quarters,
  groupMode,
  onGroupModeChange,
  onEffortChange
}: PeopleAssignmentsTableProps) {
  // Display last 4 quarters
  const displayQuarters = useMemo(() => quarters.slice(-4), [quarters]);

  // Group assignments by person
  const byPerson = useMemo(() => {
    const groups = new Map<string, PersonAssignment[]>();
    
    // Initialize groups for all filtered people
    people.forEach(p => {
      groups.set(p.id, []);
    });
    
    // Add assignments
    assignments.forEach(a => {
      if (groups.has(a.person_id)) {
        groups.get(a.person_id)!.push(a);
      }
    });
    
    // Filter to only people with assignments
    return Array.from(groups.entries())
      .filter(([, assignments]) => assignments.length > 0)
      .map(([personId, assignments]) => ({
        person: people.find(p => p.id === personId)!,
        assignments
      }))
      .filter(g => g.person);
  }, [people, assignments]);

  // Group assignments by initiative
  const byInitiative = useMemo(() => {
    const groups = new Map<string, PersonAssignment[]>();
    
    // Initialize groups for all filtered initiatives
    initiatives.forEach(i => {
      groups.set(i.id, []);
    });
    
    // Add assignments
    assignments.forEach(a => {
      if (groups.has(a.initiative_id)) {
        groups.get(a.initiative_id)!.push(a);
      }
    });
    
    // Filter to only initiatives with assignments
    return Array.from(groups.entries())
      .filter(([, assignments]) => assignments.length > 0)
      .map(([initiativeId, assignments]) => ({
        initiative: initiatives.find(i => i.id === initiativeId)!,
        assignments
      }))
      .filter(g => g.initiative);
  }, [initiatives, assignments]);

  return (
    <div className="flex flex-col h-full">
      {/* Header with toggle and quarter labels */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b">
        <ToggleGroup 
          type="single" 
          value={groupMode} 
          onValueChange={(v) => v && onGroupModeChange(v as GroupMode)}
          className="bg-background rounded-md p-1"
        >
          <ToggleGroupItem value="person" className="gap-2 px-3">
            <Users className="h-4 w-4" />
            По людям
          </ToggleGroupItem>
          <ToggleGroupItem value="initiative" className="gap-2 px-3">
            <ClipboardList className="h-4 w-4" />
            По инициативам
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Quarter headers */}
        <div className="flex items-center gap-2">
          {displayQuarters.map(q => (
            <div key={q} className="text-xs font-medium text-muted-foreground w-[50px] text-center">
              {q.replace('20', '').replace('-', ' ')}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {groupMode === 'person' ? (
          // Group by person
          byPerson.length > 0 ? (
            byPerson.map(({ person, assignments: personAssignments }) => (
              <PersonGroupRow
                key={person.id}
                person={person}
                assignments={personAssignments}
                initiatives={initiatives}
                quarters={displayQuarters}
                onEffortChange={onEffortChange}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-medium mb-2">Нет привязок</h2>
              <p className="text-muted-foreground">
                Проставьте effortCoefficient в инициативах, чтобы автоматически привязать людей
              </p>
            </div>
          )
        ) : (
          // Group by initiative
          byInitiative.length > 0 ? (
            byInitiative.map(({ initiative, assignments: initiativeAssignments }) => (
              <InitiativeGroupRow
                key={initiative.id}
                initiative={initiative}
                assignments={initiativeAssignments}
                people={people}
                quarters={displayQuarters}
                onEffortChange={onEffortChange}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-medium mb-2">Нет привязок</h2>
              <p className="text-muted-foreground">
                Проставьте effortCoefficient в инициативах, чтобы автоматически привязать людей
              </p>
            </div>
          )
        )}
      </ScrollArea>
    </div>
  );
}
