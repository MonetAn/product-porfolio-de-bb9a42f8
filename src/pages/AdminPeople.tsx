import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, Download, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePeople, usePeopleFilters } from '@/hooks/usePeople';
import { usePersonAssignments } from '@/hooks/usePeopleAssignments';
import { useInitiatives, useQuarters } from '@/hooks/useInitiatives';
import PeopleTable from '@/components/admin/people/PeopleTable';
import PeopleFilters from '@/components/admin/people/PeopleFilters';
import CSVPeopleImportDialog from '@/components/admin/people/CSVPeopleImportDialog';
import PersonDetailDialog from '@/components/admin/people/PersonDetailDialog';
import { Person } from '@/lib/peopleDataManager';

export default function AdminPeople() {
  const { data: people, isLoading: peopleLoading } = usePeople();
  const { data: assignments } = usePersonAssignments();
  const { data: initiatives } = useInitiatives();
  const quarters = useQuarters(initiatives);
  
  const { units, teams } = usePeopleFilters(people);
  
  // Filters
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [showActive, setShowActive] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialogs
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  
  // Filter people
  const filteredPeople = useMemo(() => {
    if (!people) return [];
    
    return people.filter(person => {
      // Unit filter
      if (selectedUnits.length > 0 && person.unit && !selectedUnits.includes(person.unit)) {
        return false;
      }
      
      // Team filter
      if (selectedTeams.length > 0 && person.team && !selectedTeams.includes(person.team)) {
        return false;
      }
      
      // Active filter (no termination date or future termination)
      if (showActive && person.terminated_at) {
        const terminationDate = new Date(person.terminated_at);
        if (terminationDate < new Date()) {
          return false;
        }
      }
      
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = person.full_name.toLowerCase().includes(q);
        const matchesEmail = person.email?.toLowerCase().includes(q);
        const matchesTeam = person.team?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesTeam) {
          return false;
        }
      }
      
      return true;
    });
  }, [people, selectedUnits, selectedTeams, showActive, searchQuery]);

  // Calculate effort sums for each person per quarter
  const personEffortSums = useMemo(() => {
    if (!assignments || !people) return {};
    
    const sums: Record<string, Record<string, number>> = {};
    
    people.forEach(person => {
      sums[person.id] = {};
      quarters.forEach(q => {
        sums[person.id][q] = 0;
      });
    });
    
    assignments.forEach(assignment => {
      Object.entries(assignment.quarterly_effort).forEach(([quarter, effort]) => {
        if (sums[assignment.person_id]) {
          sums[assignment.person_id][quarter] = (sums[assignment.person_id][quarter] || 0) + effort;
        }
      });
    });
    
    return sums;
  }, [assignments, people, quarters]);

  if (peopleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link to="/admin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Управление людьми</h1>
            </div>
            <span className="text-sm text-muted-foreground">
              {filteredPeople.length} из {people?.length || 0}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Импорт CSV
            </Button>
            <Button variant="outline" disabled>
              <Download className="h-4 w-4 mr-2" />
              Экспорт коэффициентов
            </Button>
          </div>
        </div>
      </header>

      {/* Filters */}
      <PeopleFilters
        units={units}
        teams={teams}
        selectedUnits={selectedUnits}
        selectedTeams={selectedTeams}
        onUnitsChange={setSelectedUnits}
        onTeamsChange={setSelectedTeams}
        showActive={showActive}
        onShowActiveChange={setShowActive}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        quarters={quarters}
      />

      {/* Table */}
      <main className="p-6">
        {people && people.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium mb-2">Нет сотрудников</h2>
            <p className="text-muted-foreground mb-4">
              Загрузите CSV-файл с данными сотрудников из HR-системы
            </p>
            <Button onClick={() => setImportDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Импортировать CSV
            </Button>
          </div>
        ) : (
          <PeopleTable
            people={filteredPeople}
            quarters={quarters}
            effortSums={personEffortSums}
            onPersonClick={setSelectedPerson}
          />
        )}
      </main>

      {/* Dialogs */}
      <CSVPeopleImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        existingUnits={units}
        existingTeams={teams}
      />

      {selectedPerson && (
        <PersonDetailDialog
          person={selectedPerson}
          open={!!selectedPerson}
          onOpenChange={(open) => !open && setSelectedPerson(null)}
          initiatives={initiatives || []}
          quarters={quarters}
        />
      )}
    </div>
  );
}
