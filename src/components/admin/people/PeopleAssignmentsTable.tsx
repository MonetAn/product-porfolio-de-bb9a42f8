import { useMemo } from 'react';
import { Users, ClipboardList } from 'lucide-react';
import { Person, PersonAssignment, VirtualAssignment } from '@/lib/peopleDataManager';
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
  onEffortChange: (assignment: VirtualAssignment, quarter: string, value: number) => void;
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
  // Display all available quarters from initiatives (earliest to latest)
  const displayQuarters = useMemo(() => quarters, [quarters]);

  // Create lookup map for existing assignments
  const assignmentMap = useMemo(() => {
    const map = new Map<string, PersonAssignment>();
    assignments.forEach(a => {
      map.set(`${a.person_id}:${a.initiative_id}`, a);
    });
    return map;
  }, [assignments]);

  // Generate virtual assignments for all person-initiative combinations
  // A person can work on any initiative in their team
  const generateVirtualAssignments = (
    person: Person,
    teamInitiatives: AdminDataRow[]
  ): VirtualAssignment[] => {
    return teamInitiatives.map(initiative => {
      const key = `${person.id}:${initiative.id}`;
      const existing = assignmentMap.get(key);
      
      if (existing) {
        return {
          id: existing.id,
          person_id: existing.person_id,
          initiative_id: existing.initiative_id,
          quarterly_effort: existing.quarterly_effort,
          is_auto: existing.is_auto,
          isVirtual: false
        };
      }
      
      return {
        id: null,
        person_id: person.id,
        initiative_id: initiative.id,
        quarterly_effort: {},
        is_auto: true,
        isVirtual: true
      };
    });
  };

  // Group by person — show all initiatives for each person's team
  const byPerson = useMemo(() => {
    return people.map(person => {
      // Get all initiatives in this person's team
      const teamInitiatives = initiatives.filter(
        i => i.unit === person.unit && i.team === person.team
      );
      
      const virtualAssignments = generateVirtualAssignments(person, teamInitiatives);
      
      return { 
        person, 
        assignments: virtualAssignments,
        initiatives: teamInitiatives
      };
    }).filter(g => g.assignments.length > 0);
  }, [people, initiatives, assignmentMap]);

  // Group by initiative — show all people in each initiative's team
  const byInitiative = useMemo(() => {
    return initiatives.map(initiative => {
      // Get all people in this initiative's team
      const teamPeople = people.filter(
        p => p.unit === initiative.unit && p.team === initiative.team
      );
      
      const virtualAssignments = teamPeople.map(person => {
        const key = `${person.id}:${initiative.id}`;
        const existing = assignmentMap.get(key);
        
        if (existing) {
          return {
            id: existing.id,
            person_id: existing.person_id,
            initiative_id: existing.initiative_id,
            quarterly_effort: existing.quarterly_effort,
            is_auto: existing.is_auto,
            isVirtual: false
          };
        }
        
        return {
          id: null,
          person_id: person.id,
          initiative_id: initiative.id,
          quarterly_effort: {},
          is_auto: true,
          isVirtual: true
        };
      });
      
      return { 
        initiative, 
        assignments: virtualAssignments,
        people: teamPeople
      };
    }).filter(g => g.assignments.length > 0);
  }, [initiatives, people, assignmentMap]);

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
            byPerson.map(({ person, assignments: personAssignments, initiatives: personInitiatives }) => (
              <PersonGroupRow
                key={person.id}
                person={person}
                assignments={personAssignments}
                initiatives={personInitiatives}
                quarters={displayQuarters}
                onEffortChange={onEffortChange}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-medium mb-2">Нет людей в выбранной команде</h2>
              <p className="text-muted-foreground">
                Импортируйте сотрудников через CSV или выберите другую команду
              </p>
            </div>
          )
        ) : (
          // Group by initiative
          byInitiative.length > 0 ? (
            byInitiative.map(({ initiative, assignments: initiativeAssignments, people: initiativePeople }) => (
              <InitiativeGroupRow
                key={initiative.id}
                initiative={initiative}
                assignments={initiativeAssignments}
                people={initiativePeople}
                quarters={displayQuarters}
                onEffortChange={onEffortChange}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-medium mb-2">Нет инициатив</h2>
              <p className="text-muted-foreground">
                Добавьте инициативы в выбранной команде
              </p>
            </div>
          )
        )}
      </ScrollArea>
    </div>
  );
}
