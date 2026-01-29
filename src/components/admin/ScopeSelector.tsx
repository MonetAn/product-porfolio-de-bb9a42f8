import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Users, ClipboardList } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type ViewMode = 'initiatives' | 'people';

interface ScopeSelectorProps {
  units: string[];
  teams: string[];
  selectedUnits: string[];
  selectedTeams: string[];
  onUnitsChange: (units: string[]) => void;
  onTeamsChange: (teams: string[]) => void;
}

const ScopeSelector = ({
  units,
  teams,
  selectedUnits,
  selectedTeams,
  onUnitsChange,
  onTeamsChange
}: ScopeSelectorProps) => {
  const [unitMenuOpen, setUnitMenuOpen] = useState(false);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const unitRef = useRef<HTMLDivElement>(null);
  const teamRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  
  // Determine current view based on path
  const currentView: ViewMode = location.pathname.includes('/people') ? 'people' : 'initiatives';

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (unitRef.current && !unitRef.current.contains(e.target as Node)) {
        setUnitMenuOpen(false);
      }
      if (teamRef.current && !teamRef.current.contains(e.target as Node)) {
        setTeamMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getUnitLabel = () => {
    if (selectedUnits.length === 0) return 'Выберите юнит';
    if (selectedUnits.length === 1) return selectedUnits[0];
    return `${selectedUnits.length} юнитов`;
  };

  const getTeamLabel = () => {
    if (selectedTeams.length === 0) return 'Все команды';
    if (selectedTeams.length === 1) return selectedTeams[0];
    return `${selectedTeams.length} команд`;
  };

  const toggleUnit = (u: string) => {
    if (selectedUnits.includes(u)) {
      const newUnits = selectedUnits.filter(x => x !== u);
      onUnitsChange(newUnits);
      // Clear teams that don't belong to remaining units
      if (newUnits.length === 0) {
        onTeamsChange([]);
      }
    } else {
      onUnitsChange([...selectedUnits, u]);
    }
  };

  const toggleTeam = (t: string) => {
    if (selectedTeams.includes(t)) {
      onTeamsChange(selectedTeams.filter(x => x !== t));
    } else {
      onTeamsChange([...selectedTeams, t]);
    }
  };

  const [searchParams] = useSearchParams();
  
  // Build URLs for navigation - always use current search params directly
  const initiativesUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams);
    const queryString = params.toString();
    return queryString ? `/admin?${queryString}` : '/admin';
  }, [searchParams]);
  
  const peopleUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams);
    const queryString = params.toString();
    return queryString ? `/admin/people?${queryString}` : '/admin/people';
  }, [searchParams]);

  return (
    <div className="flex items-center gap-3 p-4 bg-card border-b border-border">
      {/* Unit selector */}
      <div ref={unitRef} className="relative">
        <button
          onClick={() => setUnitMenuOpen(!unitMenuOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm hover:border-muted-foreground transition-colors min-w-[180px]"
        >
          <span className="flex-1 text-left truncate">{getUnitLabel()}</span>
          <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />
        </button>
        {unitMenuOpen && (
          <div className="absolute top-full mt-1 left-0 min-w-[220px] max-h-[300px] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
            <div className="flex justify-between p-2 border-b border-border">
              <button 
                className="text-xs text-primary hover:underline" 
                onClick={() => onUnitsChange([...units])}
              >
                Выбрать все
              </button>
              <button 
                className="text-xs text-primary hover:underline" 
                onClick={() => { onUnitsChange([]); onTeamsChange([]); }}
              >
                Сброс
              </button>
            </div>
            <div className="max-h-[240px] overflow-y-auto p-1">
              {units.map(u => (
                <div
                  key={u}
                  onClick={() => toggleUnit(u)}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-secondary rounded ${
                    selectedUnits.includes(u) ? 'bg-primary/10' : ''
                  }`}
                >
                  <span className={`w-4 h-4 border rounded flex items-center justify-center ${
                    selectedUnits.includes(u) 
                      ? 'bg-primary border-primary text-primary-foreground' 
                      : 'border-border'
                  }`}>
                    {selectedUnits.includes(u) && <Check size={12} />}
                  </span>
                  <span className="truncate">{u}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Team selector */}
      <div ref={teamRef} className="relative">
        <button
          onClick={() => setTeamMenuOpen(!teamMenuOpen)}
          disabled={selectedUnits.length === 0}
          className={`flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm transition-colors min-w-[180px] ${
            selectedUnits.length === 0 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:border-muted-foreground cursor-pointer'
          }`}
        >
          <span className="flex-1 text-left truncate">{getTeamLabel()}</span>
          <ChevronDown size={16} className="text-muted-foreground flex-shrink-0" />
        </button>
        {teamMenuOpen && selectedUnits.length > 0 && (
          <div className="absolute top-full mt-1 left-0 min-w-[220px] max-h-[300px] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
            <div className="flex justify-between p-2 border-b border-border">
              <button 
                className="text-xs text-primary hover:underline" 
                onClick={() => onTeamsChange([...teams])}
              >
                Выбрать все
              </button>
              <button 
                className="text-xs text-primary hover:underline" 
                onClick={() => onTeamsChange([])}
              >
                Сброс
              </button>
            </div>
            <div className="max-h-[240px] overflow-y-auto p-1">
              {teams.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  Нет команд
                </div>
              ) : (
                teams.map(t => (
                  <div
                    key={t}
                    onClick={() => toggleTeam(t)}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-secondary rounded ${
                      selectedTeams.includes(t) ? 'bg-primary/10' : ''
                    }`}
                  >
                    <span className={`w-4 h-4 border rounded flex items-center justify-center ${
                      selectedTeams.includes(t) 
                        ? 'bg-primary border-primary text-primary-foreground' 
                        : 'border-border'
                    }`}>
                      {selectedTeams.includes(t) && <Check size={12} />}
                    </span>
                    <span className="truncate">{t}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      {selectedUnits.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {selectedUnits.length} {selectedUnits.length === 1 ? 'юнит' : 'юнитов'}
          {selectedTeams.length > 0 && `, ${selectedTeams.length} ${selectedTeams.length === 1 ? 'команда' : 'команд'}`}
        </div>
      )}

      {/* View mode toggle - always visible */}
      <div className="ml-auto flex items-center gap-3">
        {/* Separator */}
        <div className="h-6 w-px bg-border" />
        
        {/* Toggle with improved styles */}
        <ToggleGroup 
          type="single" 
          value={currentView} 
          className="bg-secondary rounded-lg p-1 shadow-sm"
        >
          <Link to={initiativesUrl}>
            <ToggleGroupItem 
              value="initiatives" 
              className="gap-1.5 px-4 h-9 text-sm font-medium rounded-md transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm"
            >
              <ClipboardList className="h-4 w-4" />
              <span>Инициативы</span>
            </ToggleGroupItem>
          </Link>
          <Link to={peopleUrl}>
            <ToggleGroupItem 
              value="people" 
              className="gap-1.5 px-4 h-9 text-sm font-medium rounded-md transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm"
            >
              <Users className="h-4 w-4" />
              <span>Люди</span>
            </ToggleGroupItem>
          </Link>
        </ToggleGroup>
      </div>
    </div>
  );
};

export default ScopeSelector;