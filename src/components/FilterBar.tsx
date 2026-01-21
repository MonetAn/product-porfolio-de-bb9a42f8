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
  onOfftrackClick
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

  // Period label
  const getPeriodLabel = () => {
    if (selectedQuarters.length === 0) return 'Выберите период';
    if (selectedQuarters.length === availableQuarters.length) {
      return availableYears.join('-') + ' (все)';
    }
    if (selectedQuarters.length <= 2) {
      return selectedQuarters.map(q => q.replace('-', ' ')).join(', ');
    }
    return selectedQuarters.length + ' кварталов';
  };

  // Stakeholder label
  const getStakeholderLabel = () => {
    if (selectedStakeholders.length === 0) return 'Все стейкхолдеры';
    if (selectedStakeholders.length === 1) return selectedStakeholders[0];
    return selectedStakeholders.length + ' стейкхолдеров';
  };

  // Unit label
  const getUnitLabel = () => {
    if (selectedUnits.length === 0) return 'Все юниты';
    if (selectedUnits.length === 1) return selectedUnits[0];
    return selectedUnits.length + ' юнитов';
  };

  // Team label
  const getTeamLabel = () => {
    if (selectedTeams.length === 0) return 'Все команды';
    if (selectedTeams.length === 1) return selectedTeams[0];
    return selectedTeams.length + ' команд';
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
      // First click - start range
      setRangeStart(q);
      onQuartersChange([q]);
    } else {
      // Second click - complete range
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
      // Clear teams that don't belong to remaining units
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

  return (
    <div className="bg-card border-b border-border fixed top-14 left-0 right-0 z-40">
      {/* Row 1 - Main Filters */}
      <div className="h-12 flex items-center px-6 gap-3 border-b border-border/50">
        {/* Unit multi-select */}
        <div ref={unitRef} className="relative">
          <button
            onClick={() => setUnitMenuOpen(!unitMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg text-sm cursor-pointer hover:border-muted-foreground min-w-[140px]"
          >
            <span className="truncate">{getUnitLabel()}</span>
            <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
          </button>
          {unitMenuOpen && (
            <div className="absolute top-full mt-1 left-0 min-w-[220px] max-h-[300px] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
              <div className="flex justify-between p-2 border-b border-border">
                <button className="text-xs text-primary underline" onClick={() => onUnitsChange([...units])}>Выбрать все</button>
                <button className="text-xs text-primary underline" onClick={() => { onUnitsChange([]); onTeamsChange([]); }}>Сбросить</button>
              </div>
              <div className="max-h-[240px] overflow-y-auto p-1">
                {units.map(u => (
                  <div
                    key={u}
                    onClick={() => toggleUnit(u)}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-secondary rounded ${selectedUnits.includes(u) ? 'bg-primary/10' : ''}`}
                  >
                    <span className={`w-4 h-4 border rounded flex items-center justify-center ${selectedUnits.includes(u) ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                      {selectedUnits.includes(u) && <Check size={12} />}
                    </span>
                    <span>{u}</span>
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
            className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg text-sm cursor-pointer hover:border-muted-foreground min-w-[140px]"
          >
            <span className="truncate">{getTeamLabel()}</span>
            <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
          </button>
          {teamMenuOpen && (
            <div className="absolute top-full mt-1 left-0 min-w-[220px] max-h-[300px] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
              <div className="flex justify-between p-2 border-b border-border">
                <button className="text-xs text-primary underline" onClick={() => onTeamsChange([...filteredTeams])}>Выбрать все</button>
                <button className="text-xs text-primary underline" onClick={() => onTeamsChange([])}>Сбросить</button>
              </div>
              <div className="max-h-[240px] overflow-y-auto p-1">
                {filteredTeams.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Нет доступных команд</div>
                ) : (
                  filteredTeams.map(t => (
                    <div
                      key={t}
                      onClick={() => toggleTeam(t)}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-secondary rounded ${selectedTeams.includes(t) ? 'bg-primary/10' : ''}`}
                    >
                      <span className={`w-4 h-4 border rounded flex items-center justify-center ${selectedTeams.includes(t) ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                        {selectedTeams.includes(t) && <Check size={12} />}
                      </span>
                      <span>{t}</span>
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
            className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg text-sm cursor-pointer hover:border-muted-foreground min-w-[140px]"
          >
            <span className="truncate">{getStakeholderLabel()}</span>
            <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
          </button>
          {stakeholderMenuOpen && (
            <div className="absolute top-full mt-1 left-0 min-w-[280px] max-h-[300px] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
              <div className="flex justify-between p-2 border-b border-border">
                <button className="text-xs text-primary underline" onClick={() => onStakeholdersChange([...allStakeholders])}>Выбрать все</button>
                <button className="text-xs text-primary underline" onClick={() => onStakeholdersChange([])}>Сбросить</button>
              </div>
              <div className="max-h-[240px] overflow-y-auto p-1">
                {allStakeholders.map(s => (
                  <div
                    key={s}
                    onClick={() => toggleStakeholder(s)}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-secondary rounded ${selectedStakeholders.includes(s) ? 'bg-primary/10' : ''}`}
                  >
                    <span className={`w-4 h-4 border rounded flex items-center justify-center ${selectedStakeholders.includes(s) ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                      {selectedStakeholders.includes(s) && <Check size={12} />}
                    </span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Period selector */}
        <div ref={periodRef} className="relative">
          <button
            onClick={() => setPeriodMenuOpen(!periodMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg text-sm cursor-pointer hover:border-muted-foreground font-medium whitespace-nowrap"
          >
            <Calendar size={14} className="text-muted-foreground flex-shrink-0" />
            <span>{getPeriodLabel()}</span>
            <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />
          </button>
          {periodMenuOpen && (
            <div className="absolute top-full mt-1 left-0 min-w-[320px] bg-card border border-border rounded-lg shadow-lg z-50 p-3 animate-in fade-in slide-in-from-top-1">
              <div className="flex justify-between mb-2 pb-2 border-b border-border">
                <button className="text-xs text-primary underline" onClick={() => { onQuartersChange([...availableQuarters]); setRangeStart(null); }}>Выбрать все</button>
                <button className="text-xs text-primary underline" onClick={() => { onQuartersChange([]); setRangeStart(null); }}>Сбросить</button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {rangeStart ? `Выберите конец диапазона (начало: ${rangeStart.replace('-', ' ')})` : 'Кликните на квартал для начала диапазона'}
              </p>
              {availableYears.map(year => {
                const yearQuarters = availableQuarters.filter(q => q.startsWith(year));
                const allYearSelected = yearQuarters.every(q => selectedQuarters.includes(q));
                return (
                  <div key={year} className="mb-3">
                    <div
                      className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold cursor-pointer rounded hover:bg-secondary mb-1"
                      onClick={() => toggleYear(year)}
                    >
                      <span className={`w-4 h-4 border rounded flex items-center justify-center ${allYearSelected ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                        {allYearSelected && <Check size={12} />}
                      </span>
                      {year}
                    </div>
                    <div className="grid grid-cols-4 gap-1 px-2">
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
                            className={`py-1.5 px-2 text-xs rounded border transition-all ${
                              isStart
                                ? 'bg-primary text-primary-foreground border-primary ring-2 ring-primary/30'
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Totals */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1.5 bg-secondary rounded-lg text-sm font-medium">
            <span className="font-bold">{totals.count}</span>
            <span className="text-muted-foreground">инициатив</span>
          </div>
          <div className="flex items-center gap-1 px-3 py-1.5 bg-secondary rounded-lg text-sm font-medium">
            <span className="font-bold">{formatBudget(totals.budget)}</span>
          </div>
          <button
            onClick={onOfftrackClick}
            className="flex items-center gap-1 px-3 py-1.5 bg-destructive/10 text-destructive rounded-lg text-sm font-medium cursor-pointer hover:bg-destructive/20 transition-colors"
          >
            <span className="font-bold">{totals.offtrack}</span>
            <span>off-track</span>
          </button>
        </div>
      </div>

      {/* Row 2 - Toggles and Legend */}
      <div className="h-10 flex items-center px-6 gap-4">
        {/* Hide support toggle with tooltip */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer px-2 py-1 rounded hover:bg-secondary">
                <input
                  type="checkbox"
                  checked={hideSupport}
                  onChange={(e) => onHideSupportChange(e.target.checked)}
                  className="hidden"
                />
                <span className={`w-4 h-4 border rounded flex items-center justify-center ${hideSupport ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                  {hideSupport && <Check size={12} />}
                </span>
                <span>Скрыть Support</span>
                <HelpCircle size={12} className="text-muted-foreground/60" />
              </label>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p>Скрывает инициативы, которые находятся в статусе поддержки на последний квартал выбранного периода</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Only offtrack toggle with tooltip */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer px-2 py-1 rounded hover:bg-secondary">
                <input
                  type="checkbox"
                  checked={showOnlyOfftrack}
                  onChange={(e) => onShowOnlyOfftrackChange(e.target.checked)}
                  className="hidden"
                />
                <span className={`w-4 h-4 border rounded flex items-center justify-center ${showOnlyOfftrack ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                  {showOnlyOfftrack && <Check size={12} />}
                </span>
                <span>Только Off-track</span>
                <HelpCircle size={12} className="text-muted-foreground/60" />
              </label>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p>Показывает только инициативы, которые имеют статус Off-track на последний квартал выбранного периода</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Separator */}
        <div className="w-px h-5 bg-border" />

        {/* Nesting Toggles */}
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer px-2 py-1 rounded hover:bg-secondary">
          <input
            type="checkbox"
            checked={showTeams}
            onChange={(e) => onShowTeamsChange(e.target.checked)}
            className="hidden"
          />
          <span className={`w-4 h-4 border rounded flex items-center justify-center ${showTeams ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
            {showTeams && <Check size={12} />}
          </span>
          <span>Команды</span>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer px-2 py-1 rounded hover:bg-secondary">
          <input
            type="checkbox"
            checked={showInitiatives}
            onChange={(e) => onShowInitiativesChange(e.target.checked)}
            className="hidden"
          />
          <span className={`w-4 h-4 border rounded flex items-center justify-center ${showInitiatives ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
            {showInitiatives && <Check size={12} />}
          </span>
          <span>Инициативы</span>
        </label>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Legend */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="w-4 h-4 relative">
              <div 
                className="absolute top-0 right-0" 
                style={{ 
                  borderWidth: '0 16px 16px 0', 
                  borderStyle: 'solid',
                  borderColor: 'transparent hsl(var(--destructive)) transparent transparent' 
                }} 
              />
            </div>
            <span>Off-Track</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;