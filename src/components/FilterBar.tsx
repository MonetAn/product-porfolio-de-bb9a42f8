import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Calendar, HelpCircle } from 'lucide-react';
import { formatBudget, RawDataRow, calculateBudget, isInitiativeOffTrack } from '@/lib/dataManager';

interface FilterBarProps {
  // Breadcrumbs
  breadcrumbs: string[];
  onBreadcrumbClick: (index: number) => void;
  
  // Filters
  units: string[];
  teams: string[];
  selectedUnit: string;
  selectedTeam: string;
  onUnitChange: (unit: string) => void;
  onTeamChange: (team: string) => void;
  
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
  breadcrumbs,
  onBreadcrumbClick,
  units,
  teams,
  selectedUnit,
  selectedTeam,
  onUnitChange,
  onTeamChange,
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
  const periodRef = useRef<HTMLDivElement>(null);
  const stakeholderRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) {
        setPeriodMenuOpen(false);
      }
      if (stakeholderRef.current && !stakeholderRef.current.contains(e.target as Node)) {
        setStakeholderMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Calculate totals
  const totals = rawData.reduce(
    (acc, row) => {
      const budget = calculateBudget(row, selectedQuarters);
      if (budget === 0) return acc;
      
      const isSupport = selectedQuarters.length > 0 && row.quarterlyData[selectedQuarters[selectedQuarters.length - 1]]?.support;
      const isOffTrack = isInitiativeOffTrack(row, selectedQuarters);
      
      if (hideSupport && isSupport) return acc;
      if (showOnlyOfftrack && !isOffTrack) return acc;
      if (selectedStakeholders.length > 0 && !selectedStakeholders.includes(row.stakeholders)) return acc;
      if (selectedUnit && row.unit !== selectedUnit) return acc;
      if (selectedTeam && row.team !== selectedTeam) return acc;

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
    if (selectedQuarters.length <= 3) {
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

  const toggleQuarter = (q: string) => {
    if (selectedQuarters.includes(q)) {
      onQuartersChange(selectedQuarters.filter(x => x !== q));
    } else {
      onQuartersChange([...selectedQuarters, q].sort());
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
  };

  const toggleStakeholder = (s: string) => {
    if (selectedStakeholders.includes(s)) {
      onStakeholdersChange(selectedStakeholders.filter(x => x !== s));
    } else {
      onStakeholdersChange([...selectedStakeholders, s]);
    }
  };

  return (
    <div className="h-10 bg-card border-b border-border flex items-center px-6 fixed top-14 left-0 right-0 z-40 gap-4">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <div key={index} className="flex items-center gap-2">
            {index < breadcrumbs.length - 1 ? (
              <>
                <span
                  className="text-muted-foreground cursor-pointer px-2 py-1 rounded hover:bg-secondary hover:text-foreground transition-colors"
                  onClick={() => onBreadcrumbClick(index)}
                >
                  {crumb}
                </span>
                <span className="text-muted-foreground">›</span>
              </>
            ) : (
              <span className="text-foreground font-medium px-2 py-1">{crumb}</span>
            )}
          </div>
        ))}
      </nav>

      {/* Filters */}
      <div className="flex items-center gap-3 ml-auto">
        {/* Unit filter */}
        <select
          value={selectedUnit}
          onChange={(e) => onUnitChange(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-lg bg-card text-foreground cursor-pointer min-w-[140px] hover:border-muted-foreground"
        >
          <option value="">Все Unit</option>
          {units.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        {/* Team filter */}
        <select
          value={selectedTeam}
          onChange={(e) => onTeamChange(e.target.value)}
          className="px-3 py-1.5 text-sm border border-border rounded-lg bg-card text-foreground cursor-pointer min-w-[140px] hover:border-muted-foreground"
        >
          <option value="">Все команды</option>
          {teams.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Hide support toggle */}
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer px-2 py-1 rounded hover:bg-secondary">
          <input
            type="checkbox"
            checked={hideSupport}
            onChange={(e) => onHideSupportChange(e.target.checked)}
            className="hidden"
          />
          <span className={`w-3.5 h-3.5 border rounded flex items-center justify-center text-[10px] ${hideSupport ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
            {hideSupport && '✓'}
          </span>
          <span>Скрыть Support</span>
          <HelpCircle size={12} className="text-muted-foreground" />
        </label>

        {/* Only offtrack toggle */}
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer px-2 py-1 rounded hover:bg-secondary">
          <input
            type="checkbox"
            checked={showOnlyOfftrack}
            onChange={(e) => onShowOnlyOfftrackChange(e.target.checked)}
            className="hidden"
          />
          <span className={`w-3.5 h-3.5 border rounded flex items-center justify-center text-[10px] ${showOnlyOfftrack ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
            {showOnlyOfftrack && '✓'}
          </span>
          <span>Только Off-track</span>
          <HelpCircle size={12} className="text-muted-foreground" />
        </label>

        {/* Stakeholder multi-select */}
        <div ref={stakeholderRef} className="relative">
          <button
            onClick={() => setStakeholderMenuOpen(!stakeholderMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg text-sm cursor-pointer hover:border-muted-foreground min-w-[140px]"
          >
            <span className="truncate">{getStakeholderLabel()}</span>
            <ChevronDown size={14} className="text-muted-foreground" />
          </button>
          {stakeholderMenuOpen && (
            <div className="absolute top-full mt-1 right-0 min-w-[280px] max-h-[300px] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
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
                    <span className={`w-4 h-4 border rounded flex items-center justify-center text-xs ${selectedStakeholders.includes(s) ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                      {selectedStakeholders.includes(s) && '✓'}
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
            className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg text-sm cursor-pointer hover:border-muted-foreground font-medium"
          >
            <Calendar size={14} className="text-muted-foreground" />
            <span>{getPeriodLabel()}</span>
            <ChevronDown size={14} className="text-muted-foreground" />
          </button>
          {periodMenuOpen && (
            <div className="absolute top-full mt-1 right-0 min-w-[280px] bg-card border border-border rounded-lg shadow-lg z-50 p-2 animate-in fade-in slide-in-from-top-1">
              <div className="flex justify-between mb-2 pb-2 border-b border-border">
                <button className="text-xs text-primary underline" onClick={() => onQuartersChange([...availableQuarters])}>Выбрать все</button>
                <button className="text-xs text-primary underline" onClick={() => onQuartersChange([])}>Сбросить</button>
              </div>
              {availableYears.map(year => {
                const yearQuarters = availableQuarters.filter(q => q.startsWith(year));
                return (
                  <div key={year} className="mb-2">
                    <div
                      className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold cursor-pointer rounded hover:bg-secondary"
                      onClick={() => toggleYear(year)}
                    >
                      {year}
                    </div>
                    <div className="flex gap-1 px-2">
                      {yearQuarters.map(q => {
                        const qLabel = q.split('-')[1];
                        return (
                          <button
                            key={q}
                            onClick={() => toggleQuarter(q)}
                            className={`flex-1 py-1.5 px-3 text-xs rounded border transition-colors ${
                              selectedQuarters.includes(q)
                                ? 'bg-foreground text-background border-foreground'
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

      {/* Totals */}
      <div className="flex items-center gap-3 pl-4 border-l border-border">
        <div className="flex items-center gap-1 px-2 py-1 bg-secondary rounded text-xs font-medium">
          <span>{totals.count}</span> инициатив
        </div>
        <div className="flex items-center gap-1 px-2 py-1 bg-secondary rounded text-xs font-medium">
          {formatBudget(totals.budget)}
        </div>
        <button
          onClick={onOfftrackClick}
          className="flex items-center gap-1 px-2 py-1 bg-destructive/10 text-destructive rounded text-xs font-medium cursor-pointer hover:scale-105 transition-transform"
        >
          {totals.offtrack} off-track
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pl-4 border-l border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-4 h-4 relative">
            <div className="absolute top-0 right-0 border-solid border-[8px] border-transparent border-t-destructive border-r-destructive" style={{ borderWidth: '0 16px 16px 0', borderColor: 'transparent hsl(var(--destructive)) transparent transparent' }} />
          </div>
          <span>Off-Track</span>
        </div>
      </div>

      {/* Nesting Toggles */}
      <div className="flex items-center gap-3 pl-4 border-l border-border">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer px-2 py-1 rounded hover:bg-secondary">
          <input
            type="checkbox"
            checked={showTeams}
            onChange={(e) => onShowTeamsChange(e.target.checked)}
            className="hidden"
          />
          <span className={`w-3.5 h-3.5 border rounded flex items-center justify-center text-[10px] ${showTeams ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
            {showTeams && '✓'}
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
          <span className={`w-3.5 h-3.5 border rounded flex items-center justify-center text-[10px] ${showInitiatives ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
            {showInitiatives && '✓'}
          </span>
          <span>Инициативы</span>
        </label>
      </div>
    </div>
  );
};

export default FilterBar;
