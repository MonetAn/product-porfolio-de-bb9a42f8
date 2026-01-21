import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Calendar, HelpCircle, Check } from 'lucide-react';
import { formatBudget, RawDataRow, calculateBudget, isInitiativeOffTrack, isInitiativeSupport } from '@/lib/dataManager';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FilterBarProps {
  // Filters
  units: string[];
  teams: string[];
  selectedUnits: string[];
  selectedTeams: string[];
  onUnitsChange: (units: string[]) => void;
  onTeamsChange: (teams: string[]) => void;
  
  // Support/Offtrack toggles
  hideSupport: boolean;
  onHideSupportChange: (val: boolean) => void;
  showOnlyOfftrack: boolean;
  onShowOnlyOfftrackChange: (val: boolean) => void;
  
  // Stakeholder multi-select
  allStakeholders: string[];
  selectedStakeholders: string[];
  onStakeholdersChange: (stakeholders: string[]) => void;
  
  // Period selector
  availableYears: string[];
  availableQuarters: string[];
  selectedQuarters: string[];
  onQuartersChange: (quarters: string[]) => void;
  
  // Totals
  rawData: RawDataRow[];
  
  // Nesting toggles
  showTeams: boolean;
  showInitiatives: boolean;
  onShowTeamsChange: (val: boolean) => void;
  onShowInitiativesChange: (val: boolean) => void;
  
  // Off-track modal
  onOfftrackClick: () => void;
  
  // Hide nesting toggles (for Gantt view)
  hideNestingToggles?: boolean;
}

const FilterBar = ({
  units,
  teams,
  selectedUnits,
  selectedTeams,
  onUnitsChange,
  onTeamsChange,
  hideSupport,
  onHideSupportChange,
  showOnlyOfftrack,
  onShowOnlyOfftrackChange,
  allStakeholders,
  selectedStakeholders,
  onStakeholdersChange,
  availableYears,
  availableQuarters,
  selectedQuarters,
  onQuartersChange,
  rawData,
  showTeams,
  showInitiatives,
  onShowTeamsChange,
  onShowInitiativesChange,
  onOfftrackClick,
  hideNestingToggles = false
}: FilterBarProps) => {
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const [stakeholderMenuOpen, setStakeholderMenuOpen] = useState(false);
  const [unitMenuOpen, setUnitMenuOpen] = useState(false);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [hoverQuarter, setHoverQuarter] = useState<string | null>(null);
  
  const periodRef = useRef<HTMLDivElement>(null);
  const stakeholderRef = useRef<HTMLDivElement>(null);
  const unitRef = useRef<HTMLDivElement>(null);
  const teamRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) {
        setPeriodMenuOpen(false);
        setRangeStart(null);
      }
      if (stakeholderRef.current && !stakeholderRef.current.contains(e.target as Node)) {
        setStakeholderMenuOpen(false);
      }
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

  // Get filtered teams based on selected units
  const filteredTeams = selectedUnits.length > 0
    ? teams.filter(t => {
        const teamsFromUnits = rawData
          .filter(r => selectedUnits.includes(r.unit))
          .map(r => r.team);
        return teamsFromUnits.includes(t);
      })
    : teams;

  // Calculate totals based on current filters
  const totals = rawData.reduce(
    (acc, row) => {
      const budget = calculateBudget(row, selectedQuarters);
      if (budget === 0) return acc;
      
      const isSupport = isInitiativeSupport(row, selectedQuarters);
      const isOffTrack = isInitiativeOffTrack(row, selectedQuarters);
      
      if (hideSupport && isSupport) return acc;
      if (showOnlyOfftrack && !isOffTrack) return acc;
      if (selectedStakeholders.length > 0 && !selectedStakeholders.includes(row.stakeholders)) return acc;
      if (selectedUnits.length > 0 && !selectedUnits.includes(row.unit)) return acc;
      if (selectedTeams.length > 0 && !selectedTeams.includes(row.team)) return acc;

      acc.count++;
      acc.budget += budget;
      if (isOffTrack) acc.offtrack++;
      return acc;
    },
    { count: 0, budget: 0, offtrack: 0 }
  );

  // Period label - shorter version
  const getPeriodLabel = () => {
    if (selectedQuarters.length === 0) return 'Период';
    if (selectedQuarters.length === availableQuarters.length) {
      return `${availableYears[0]}-${availableYears[availableYears.length - 1]}`;
    }
    if (selectedQuarters.length === 1) {
      return selectedQuarters[0].replace('-', ' ');
    }
    return `${selectedQuarters.length} кв.`;
  };

  // Stakeholder label - shorter
  const getStakeholderLabel = () => {
    if (selectedStakeholders.length === 0) return 'Стейкхолдеры';
    if (selectedStakeholders.length === 1) {
      const s = selectedStakeholders[0];
      return s.length > 12 ? s.slice(0, 12) + '...' : s;
    }
    return `${selectedStakeholders.length} выбр.`;
  };

  // Unit label - shorter
  const getUnitLabel = () => {
    if (selectedUnits.length === 0) return 'Юниты';
    if (selectedUnits.length === 1) {
      const u = selectedUnits[0];
      return u.length > 12 ? u.slice(0, 12) + '...' : u;
    }
    return `${selectedUnits.length} юнит.`;
  };

  // Team label - shorter
  const getTeamLabel = () => {
    if (selectedTeams.length === 0) return 'Команды';
    if (selectedTeams.length === 1) {
      const t = selectedTeams[0];
      return t.length > 12 ? t.slice(0, 12) + '...' : t;
    }
    return `${selectedTeams.length} ком.`;
  };

  // Calculate quarters in range for hover preview
  const getQuartersInRange = (start: string, end: string): string[] => {
    const sorted = availableQuarters.sort();
    const startIdx = sorted.indexOf(start);
    const endIdx = sorted.indexOf(end);
    if (startIdx === -1 || endIdx === -1) return [];
    const [minIdx, maxIdx] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
    return sorted.slice(minIdx, maxIdx + 1);
  };

  // Handle quarter click for range selection
  const handleQuarterClick = (q: string) => {
    if (rangeStart === null) {
      setRangeStart(q);
      onQuartersChange([q]);
    } else {
      const range = getQuartersInRange(rangeStart, q);
      onQuartersChange(range);
      setRangeStart(null);
    }
  };

  // Check if quarter is in hover range
  const isInHoverRange = (q: string): boolean => {
    if (!rangeStart || !hoverQuarter) return false;
    const range = getQuartersInRange(rangeStart, hoverQuarter);
    return range.includes(q);
  };

  const toggleUnit = (u: string) => {
    if (selectedUnits.includes(u)) {
      const newUnits = selectedUnits.filter(x => x !== u);
      onUnitsChange(newUnits);
      if (newUnits.length > 0) {
        const validTeams = rawData
          .filter(r => newUnits.includes(r.unit))
          .map(r => r.team);
        onTeamsChange(selectedTeams.filter(t => validTeams.includes(t)));
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

  const toggleYear = (year: string) => {
    const yearQuarters = availableQuarters.filter(q => q.startsWith(year));
    const allSelected = yearQuarters.every(q => selectedQuarters.includes(q));
    if (allSelected) {
      onQuartersChange(selectedQuarters.filter(q => !q.startsWith(year)));
    } else {
      const newQuarters = [...selectedQuarters];
      yearQuarters.forEach(q => {
        if (!newQuarters.includes(q)) newQuarters.push(q);
      });
      onQuartersChange(newQuarters.sort());
    }
    setRangeStart(null);
  };

  const toggleStakeholder = (s: string) => {
    if (selectedStakeholders.includes(s)) {
      onStakeholdersChange(selectedStakeholders.filter(x => x !== s));
    } else {
      onStakeholdersChange([...selectedStakeholders, s]);
    }
  };

  // Format budget for compact display
  const formatBudgetCompact = (value: number): string => {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return Math.round(value / 1000) + 'K';
    }
    return value.toString();
  };

  return (
    <div className="bg-card border-b border-border fixed top-14 left-0 right-0 z-40">
      {/* Single responsive row */}
      <div className="h-auto min-h-[44px] flex flex-wrap items-center px-4 py-1.5 gap-2">
        {/* Filters Group */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Unit multi-select */}
          <div ref={unitRef} className="relative">
            <button
              onClick={() => setUnitMenuOpen(!unitMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-card border border-border rounded-md text-xs cursor-pointer hover:border-muted-foreground"
            >
              <span className="truncate max-w-[80px]">{getUnitLabel()}</span>
              <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
            </button>
            {unitMenuOpen && (
              <div className="absolute top-full mt-1 left-0 min-w-[200px] max-h-[280px] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                <div className="flex justify-between p-2 border-b border-border">
                  <button className="text-xs text-primary underline" onClick={() => onUnitsChange([...units])}>Все</button>
                  <button className="text-xs text-primary underline" onClick={() => { onUnitsChange([]); onTeamsChange([]); }}>Сброс</button>
                </div>
                <div className="max-h-[220px] overflow-y-auto p-1">
                  {units.map(u => (
                    <div
                      key={u}
                      onClick={() => toggleUnit(u)}
                      className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs hover:bg-secondary rounded ${selectedUnits.includes(u) ? 'bg-primary/10' : ''}`}
                    >
                      <span className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${selectedUnits.includes(u) ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                        {selectedUnits.includes(u) && <Check size={10} />}
                      </span>
                      <span className="truncate">{u}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Team multi-select */}
          <div ref={teamRef} className="relative">
            <button
              onClick={() => setTeamMenuOpen(!teamMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-card border border-border rounded-md text-xs cursor-pointer hover:border-muted-foreground"
            >
              <span className="truncate max-w-[80px]">{getTeamLabel()}</span>
              <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
            </button>
            {teamMenuOpen && (
              <div className="absolute top-full mt-1 left-0 min-w-[200px] max-h-[280px] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                <div className="flex justify-between p-2 border-b border-border">
                  <button className="text-xs text-primary underline" onClick={() => onTeamsChange([...filteredTeams])}>Все</button>
                  <button className="text-xs text-primary underline" onClick={() => onTeamsChange([])}>Сброс</button>
                </div>
                <div className="max-h-[220px] overflow-y-auto p-1">
                  {filteredTeams.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Нет команд</div>
                  ) : (
                    filteredTeams.map(t => (
                      <div
                        key={t}
                        onClick={() => toggleTeam(t)}
                        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs hover:bg-secondary rounded ${selectedTeams.includes(t) ? 'bg-primary/10' : ''}`}
                      >
                        <span className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${selectedTeams.includes(t) ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                          {selectedTeams.includes(t) && <Check size={10} />}
                        </span>
                        <span className="truncate">{t}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Stakeholder multi-select */}
          <div ref={stakeholderRef} className="relative">
            <button
              onClick={() => setStakeholderMenuOpen(!stakeholderMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-card border border-border rounded-md text-xs cursor-pointer hover:border-muted-foreground"
            >
              <span className="truncate max-w-[80px]">{getStakeholderLabel()}</span>
              <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
            </button>
            {stakeholderMenuOpen && (
              <div className="absolute top-full mt-1 left-0 min-w-[240px] max-h-[280px] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                <div className="flex justify-between p-2 border-b border-border">
                  <button className="text-xs text-primary underline" onClick={() => onStakeholdersChange([...allStakeholders])}>Все</button>
                  <button className="text-xs text-primary underline" onClick={() => onStakeholdersChange([])}>Сброс</button>
                </div>
                <div className="max-h-[220px] overflow-y-auto p-1">
                  {(() => {
                    // Get stakeholders that have projects matching current unit/team filters
                    const relevantStakeholders = new Set<string>();
                    rawData.forEach(row => {
                      const matchesUnit = selectedUnits.length === 0 || selectedUnits.includes(row.unit);
                      const matchesTeam = selectedTeams.length === 0 || selectedTeams.includes(row.team);
                      if (matchesUnit && matchesTeam && row.stakeholders) {
                        relevantStakeholders.add(row.stakeholders);
                      }
                    });
                    
                    // Sort: relevant first, then irrelevant
                    const sortedStakeholders = [...allStakeholders].sort((a, b) => {
                      const aRelevant = relevantStakeholders.has(a);
                      const bRelevant = relevantStakeholders.has(b);
                      if (aRelevant && !bRelevant) return -1;
                      if (!aRelevant && bRelevant) return 1;
                      return a.localeCompare(b);
                    });
                    
                    return sortedStakeholders.map(s => {
                      const isRelevant = relevantStakeholders.has(s);
                      return (
                        <div
                          key={s}
                          onClick={() => toggleStakeholder(s)}
                          className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer text-xs hover:bg-secondary rounded ${selectedStakeholders.includes(s) ? 'bg-primary/10' : ''} ${!isRelevant ? 'opacity-40' : ''}`}
                        >
                          <span className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${selectedStakeholders.includes(s) ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                            {selectedStakeholders.includes(s) && <Check size={10} />}
                          </span>
                          <span className="truncate">{s}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Period selector */}
          <div ref={periodRef} className="relative">
            <button
              onClick={() => setPeriodMenuOpen(!periodMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-card border border-border rounded-md text-xs cursor-pointer hover:border-muted-foreground font-medium"
            >
              <Calendar size={12} className="text-muted-foreground flex-shrink-0" />
              <span className="truncate max-w-[80px]">{getPeriodLabel()}</span>
              <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
            </button>
            {periodMenuOpen && (
              <div className="absolute top-full mt-1 left-0 min-w-[300px] bg-card border border-border rounded-lg shadow-lg z-50 p-2 animate-in fade-in slide-in-from-top-1">
                <div className="flex justify-between mb-2 pb-2 border-b border-border">
                  <button className="text-xs text-primary underline" onClick={() => { onQuartersChange([...availableQuarters]); setRangeStart(null); }}>Все</button>
                  <button className="text-xs text-primary underline" onClick={() => { onQuartersChange([]); setRangeStart(null); }}>Сброс</button>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">
                  {rangeStart ? `Конец: ${rangeStart.replace('-', ' ')}` : 'Клик = начало диапазона'}
                </p>
                {availableYears.map(year => {
                  const yearQuarters = availableQuarters.filter(q => q.startsWith(year));
                  const allYearSelected = yearQuarters.every(q => selectedQuarters.includes(q));
                  return (
                    <div key={year} className="mb-2">
                      <div
                        className="flex items-center gap-1.5 px-1.5 py-1 text-xs font-semibold cursor-pointer rounded hover:bg-secondary"
                        onClick={() => toggleYear(year)}
                      >
                        <span className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${allYearSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                          {allYearSelected && <Check size={10} />}
                        </span>
                        {year}
                      </div>
                      <div className="grid grid-cols-4 gap-1 px-1.5 mt-1">
                        {yearQuarters.map(q => {
                          const qLabel = q.split('-')[1];
                          const isSelected = selectedQuarters.includes(q);
                          const isHovered = isInHoverRange(q);
                          const isStart = rangeStart === q;
                          return (
                            <button
                              key={q}
                              onClick={() => handleQuarterClick(q)}
                              onMouseEnter={() => setHoverQuarter(q)}
                              onMouseLeave={() => setHoverQuarter(null)}
                              className={`py-1 px-1.5 text-[10px] rounded border transition-all ${
                                isStart
                                  ? 'bg-primary text-primary-foreground border-primary ring-1 ring-primary/30'
                                  : isSelected
                                    ? 'bg-foreground text-background border-foreground'
                                    : isHovered
                                      ? 'bg-primary/30 border-primary/50'
                                      : 'bg-secondary border-border hover:border-muted-foreground'
                              }`}
                            >
                              {qLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-border hidden sm:block" />

        {/* Toggles Group */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Hide support toggle with tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer px-1.5 py-1 rounded hover:bg-secondary">
                  <input
                    type="checkbox"
                    checked={hideSupport}
                    onChange={(e) => onHideSupportChange(e.target.checked)}
                    className="hidden"
                  />
                  <span className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${hideSupport ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                    {hideSupport && <Check size={10} />}
                  </span>
                  <span className="whitespace-nowrap">Support</span>
                  <HelpCircle size={10} className="text-muted-foreground/60" />
                </label>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px] text-xs">
                Скрывает инициативы в статусе поддержки
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Only offtrack toggle with tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer px-1.5 py-1 rounded hover:bg-secondary">
                  <input
                    type="checkbox"
                    checked={showOnlyOfftrack}
                    onChange={(e) => onShowOnlyOfftrackChange(e.target.checked)}
                    className="hidden"
                  />
                  <span className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${showOnlyOfftrack ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                    {showOnlyOfftrack && <Check size={10} />}
                  </span>
                  <span className="whitespace-nowrap">Off-track</span>
                  <HelpCircle size={10} className="text-muted-foreground/60" />
                </label>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px] text-xs">
                Показывает только Off-track инициативы
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Separator */}
          {!hideNestingToggles && <div className="w-px h-4 bg-border" />}

          {/* Nesting Toggles - hidden on Gantt */}
          {!hideNestingToggles && (
            <>
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer px-1.5 py-1 rounded hover:bg-secondary">
                <input
                  type="checkbox"
                  checked={showTeams}
                  onChange={(e) => onShowTeamsChange(e.target.checked)}
                  className="hidden"
                />
                <span className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${showTeams ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                  {showTeams && <Check size={10} />}
                </span>
                <span>Команды</span>
              </label>
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer px-1.5 py-1 rounded hover:bg-secondary">
                <input
                  type="checkbox"
                  checked={showInitiatives}
                  onChange={(e) => onShowInitiativesChange(e.target.checked)}
                  className="hidden"
                />
                <span className={`w-3.5 h-3.5 border rounded flex items-center justify-center ${showInitiatives ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                  {showInitiatives && <Check size={10} />}
                </span>
                <span>Инициативы</span>
              </label>
            </>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1 min-w-[8px]" />

        {/* KPIs - compact */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="px-2 py-1 bg-secondary rounded text-[11px] font-medium whitespace-nowrap">
            <span className="font-bold">{totals.count}</span> иниц.
          </div>
          <div className="px-2 py-1 bg-secondary rounded text-[11px] font-bold whitespace-nowrap">
            {formatBudgetCompact(totals.budget)} ₽
          </div>
          <button
            onClick={onOfftrackClick}
            className="flex items-center gap-1 px-2 py-1 bg-destructive/10 text-destructive rounded text-[11px] font-medium cursor-pointer hover:bg-destructive/20 transition-colors whitespace-nowrap"
          >
            <span className="font-bold">{totals.offtrack}</span>
            <span className="hidden sm:inline">off-track</span>
            <div 
              className="w-2.5 h-2.5 sm:hidden" 
              style={{ 
                borderWidth: '0 10px 10px 0', 
                borderStyle: 'solid',
                borderColor: 'transparent hsl(var(--destructive)) transparent transparent' 
              }} 
            />
          </button>
        </div>

        {/* Legend - hidden on small screens */}
        <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-border flex-shrink-0">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div 
              className="w-3 h-3" 
              style={{ 
                borderWidth: '0 12px 12px 0', 
                borderStyle: 'solid',
                borderColor: 'transparent hsl(var(--destructive)) transparent transparent' 
              }} 
            />
            <span>Off-Track</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;