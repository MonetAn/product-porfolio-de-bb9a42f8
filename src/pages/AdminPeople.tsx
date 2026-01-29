import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, Download, Users, Loader2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePeople } from '@/hooks/usePeople';
import { usePersonAssignments, useAssignmentMutations } from '@/hooks/usePeopleAssignments';
import { useInitiatives, useQuarters } from '@/hooks/useInitiatives';
import { useFilterParams } from '@/hooks/useFilterParams';
import ScopeSelector from '@/components/admin/ScopeSelector';
import PeopleAssignmentsTable from '@/components/admin/people/PeopleAssignmentsTable';
import CSVPeopleImportDialog from '@/components/admin/people/CSVPeopleImportDialog';
import { getUniqueUnits, getTeamsForUnits, filterData } from '@/lib/adminDataManager';
import { VirtualAssignment } from '@/lib/peopleDataManager';
type GroupMode = 'person' | 'initiative';

export default function AdminPeople() {
  const { data: people = [], isLoading: peopleLoading } = usePeople();
  const { data: assignments = [] } = usePersonAssignments();
  const { data: initiatives = [] } = useInitiatives();
  const quarters = useQuarters(initiatives);
  
  // URL-synced filters
  const { 
    selectedUnits, 
    selectedTeams, 
    setSelectedUnits, 
    setSelectedTeams,
    buildFilteredUrl 
  } = useFilterParams();
  
  // Dialogs & UI state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [groupMode, setGroupMode] = useState<GroupMode>('person');
  
  // Mutations
  const { createAssignment, updateAssignment } = useAssignmentMutations();

  // Derived data - units/teams from initiatives (to match Admin page behavior)
  const units = useMemo(() => getUniqueUnits(initiatives), [initiatives]);
  const teams = useMemo(() => getTeamsForUnits(initiatives, selectedUnits), [initiatives, selectedUnits]);
  
  // Filter initiatives by selected scope
  const filteredInitiatives = useMemo(() => {
    return filterData(initiatives, selectedUnits, selectedTeams);
  }, [initiatives, selectedUnits, selectedTeams]);

  // Filter people by unit/team
  const filteredPeople = useMemo(() => {
    if (selectedUnits.length === 0) return [];
    
    return people.filter(person => {
      // Unit filter
      if (person.unit && !selectedUnits.includes(person.unit)) {
        return false;
      }
      
      // Team filter (if teams selected)
      if (selectedTeams.length > 0 && person.team && !selectedTeams.includes(person.team)) {
        return false;
      }
      
      // Only active employees
      if (person.terminated_at) {
        const terminationDate = new Date(person.terminated_at);
        if (terminationDate < new Date()) {
          return false;
        }
      }
      
      return true;
    });
  }, [people, selectedUnits, selectedTeams]);

  // Filter assignments to only show those for filtered initiatives and people
  const filteredAssignments = useMemo(() => {
    const initiativeIds = new Set(filteredInitiatives.map(i => i.id));
    const personIds = new Set(filteredPeople.map(p => p.id));
    
    return assignments.filter(a => 
      initiativeIds.has(a.initiative_id) && personIds.has(a.person_id)
    );
  }, [assignments, filteredInitiatives, filteredPeople]);

  // Handle effort change — create assignment if virtual, update if exists
  const handleEffortChange = useCallback(async (assignment: VirtualAssignment, quarter: string, value: number) => {
    if (assignment.isVirtual || !assignment.id) {
      // Create new assignment (virtual → real)
      await createAssignment.mutateAsync({
        person_id: assignment.person_id,
        initiative_id: assignment.initiative_id,
        quarterly_effort: { [quarter]: value },
        is_auto: false // Manual edit
      });
    } else {
      // Update existing assignment
      await updateAssignment.mutateAsync({
        id: assignment.id,
        quarterly_effort: {
          ...assignment.quarterly_effort,
          [quarter]: value
        },
        is_auto: false // Manual edit marks as not auto
      });
    }
  }, [createAssignment, updateAssignment]);

  // Count stats
  const assignmentCount = filteredAssignments.length;
  const peopleCount = filteredPeople.length;
  const initiativeCount = filteredInitiatives.length;

  if (peopleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const needsSelection = selectedUnits.length === 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 bg-card border-b border-border flex items-center px-6 fixed top-0 left-0 right-0 z-50">
        <Link to={buildFilteredUrl('/admin')}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Админка</span>
          </Button>
        </Link>

        <div className="flex items-center gap-2 font-semibold text-foreground ml-4">
          <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center text-primary-foreground text-sm font-bold">
            <Users size={14} />
          </div>
          <span>Люди</span>
        </div>

        {/* Stats */}
        {!needsSelection && (
          <div className="ml-6 flex items-center gap-3 text-sm text-muted-foreground">
            <span>{peopleCount} чел.</span>
            <span>•</span>
            <span>{initiativeCount} инициатив</span>
            <span>•</span>
            <span>{assignmentCount} привязок</span>
          </div>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)}>
            <Upload size={16} className="mr-2" />
            <span className="hidden sm:inline">Импорт CSV</span>
          </Button>
          <Button variant="default" size="sm" disabled>
            <Download size={16} className="mr-2" />
            <span className="hidden sm:inline">Экспорт</span>
          </Button>
        </div>
      </header>

      {/* Scope Selector */}
      <div className="pt-14">
        <ScopeSelector
          units={units}
          teams={teams}
          selectedUnits={selectedUnits}
          selectedTeams={selectedTeams}
          onUnitsChange={setSelectedUnits}
          onTeamsChange={setSelectedTeams}
          buildFilteredUrl={buildFilteredUrl}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {needsSelection ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="border border-dashed border-border rounded-xl p-12 text-center max-w-md">
              <ClipboardList size={48} className="mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Выберите Unit</h2>
              <p className="text-muted-foreground">
                Для просмотра и редактирования привязок людей к инициативам выберите Unit в фильтрах выше
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <PeopleAssignmentsTable
              people={filteredPeople}
              initiatives={filteredInitiatives}
              assignments={filteredAssignments}
              quarters={quarters}
              groupMode={groupMode}
              onGroupModeChange={setGroupMode}
              onEffortChange={handleEffortChange}
            />
          </div>
        )}
      </main>

      {/* Dialogs */}
      <CSVPeopleImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        existingUnits={units}
        existingTeams={teams}
      />
    </div>
  );
}
