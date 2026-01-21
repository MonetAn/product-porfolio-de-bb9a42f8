import { useState, useRef, useEffect, useCallback } from 'react';
import Header, { ViewType } from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import BudgetTreemap from '@/components/BudgetTreemap';
import {
  parseCSV,
  buildBudgetTree,
  RawDataRow,
  TreeNode,
  formatBudget,
  calculateBudget,
  isInitiativeOffTrack,
} from '@/lib/dataManager';
import { toast } from 'sonner';

const Index = () => {
  // Data state
  const [rawData, setRawData] = useState<RawDataRow[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [availableQuarters, setAvailableQuarters] = useState<string[]>([]);
  const [selectedQuarters, setSelectedQuarters] = useState<string[]>([]);
  const [stakeholderCombinations, setStakeholderCombinations] = useState<string[]>([]);

  // View state
  const [currentView, setCurrentView] = useState<ViewType>('budget');
  const [portfolioData, setPortfolioData] = useState<TreeNode>({ name: 'Все Unit', children: [], isRoot: true });
  const [currentRoot, setCurrentRoot] = useState<TreeNode>({ name: 'Все Unit', children: [], isRoot: true });
  const [navigationStack, setNavigationStack] = useState<TreeNode[]>([]);

  // Filter state - changed to multi-select arrays
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [hideSupport, setHideSupport] = useState(false);
  const [showOnlyOfftrack, setShowOnlyOfftrack] = useState(false);
  const [selectedStakeholders, setSelectedStakeholders] = useState<string[]>([]);
  const [showTeams, setShowTeams] = useState(false);
  const [showInitiatives, setShowInitiatives] = useState(false);

  // UI state
  const [showSearch, setShowSearch] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showOfftrackModal, setShowOfftrackModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get unique units and teams
  const units = [...new Set(rawData.map(r => r.unit))].sort();
  const teams = [...new Set(rawData.filter(r => r.team).map(r => r.team))].sort();

  // Build tree whenever filters change
  const rebuildTree = useCallback(() => {
    if (rawData.length === 0) return;

    // For multi-select: if nothing selected, show all
    const unitFilter = selectedUnits.length === 1 ? selectedUnits[0] : '';
    const teamFilter = selectedTeams.length === 1 ? selectedTeams[0] : '';

    const tree = buildBudgetTree(rawData, {
      selectedQuarters,
      hideSupportInitiatives: hideSupport,
      showOnlyOfftrack,
      selectedStakeholders,
      unitFilter,
      teamFilter,
      selectedUnits,
      selectedTeams,
      // NEW: pass toggle state for tree structure
      showTeams,
      showInitiatives
    });

    setPortfolioData(tree);
    setCurrentRoot(tree);
    setNavigationStack([]);
  }, [rawData, selectedQuarters, hideSupport, showOnlyOfftrack, selectedStakeholders, selectedUnits, selectedTeams, showTeams, showInitiatives]);

  useEffect(() => {
    rebuildTree();
  }, [rebuildTree]);

  // CSV Upload handler
  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseCSV(text);

      setRawData(result.rawData);
      setAvailableYears(result.availableYears);
      setAvailableQuarters(result.availableQuarters);
      setSelectedQuarters([...result.availableQuarters]);
      setStakeholderCombinations(result.stakeholderCombinations);

      toast.success('CSV загружен: ' + file.name);
    };
    reader.readAsText(file, 'UTF-8');
    
    // Reset input so same file can be uploaded again
    event.target.value = '';
  };

  // Navigation - drill down into a node
  const drillDown = (node: TreeNode) => {
    if (!node.children) return;
    
    // Auto-toggle based on what we're drilling into
    if (node.isUnit) {
      // Drilling into a unit - auto-enable Teams
      if (!showTeams) setShowTeams(true);
      // Set filter to this unit
      setSelectedUnits([node.name]);
    } else if (node.isTeam) {
      // Drilling into a team - auto-enable Initiatives
      if (!showInitiatives) setShowInitiatives(true);
      // Set filter to this team
      setSelectedTeams([node.name]);
    }
    
    setNavigationStack([...navigationStack, currentRoot]);
    setCurrentRoot(node);
  };

  // Navigate up - go back one level and clear corresponding filter
  const navigateUp = () => {
    if (navigationStack.length === 0) return;
    const newStack = [...navigationStack];
    const parent = newStack.pop()!;
    
    // Clear the filter of the level we're leaving
    if (currentRoot.isTeam) {
      setSelectedTeams([]);
    } else if (currentRoot.isUnit) {
      setSelectedUnits([]);
      setSelectedTeams([]);
    }
    
    setNavigationStack(newStack);
    setCurrentRoot(parent);
  };

  // Handle click on treemap node - select single item in filter
  const handleNodeClick = (node: TreeNode) => {
    if (node.isUnit) {
      // Reset teams and select only this unit
      setSelectedTeams([]);
      setSelectedUnits([node.name]);
    } else if (node.isTeam) {
      // Select only this team (keep units as is if single, otherwise reset)
      if (selectedUnits.length > 1) {
        // Find the unit this team belongs to
        const teamUnit = rawData.find(r => r.team === node.name)?.unit;
        if (teamUnit) {
          setSelectedUnits([teamUnit]);
        }
      }
      setSelectedTeams([node.name]);
    }
    // For initiatives - do nothing (or could navigate to Gantt in future)
  };

  // View switching
  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
    setNavigationStack([]);
    setCurrentRoot(portfolioData);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) {
        if (e.key === 'Escape') {
          setShowSearch(false);
          setSearchQuery('');
        }
        return;
      }

      switch (e.key) {
        case '1': handleViewChange('budget'); break;
        case '2': handleViewChange('stakeholders'); break;
        case '3': handleViewChange('gantt'); break;
        case '/': e.preventDefault(); setShowSearch(true); break;
        case '?': setShowShortcuts(true); break;
        case 'Escape':
          if (showSearch) {
            setShowSearch(false);
            setSearchQuery('');
          } else if (showShortcuts) {
            setShowShortcuts(false);
          } else if (showOfftrackModal) {
            setShowOfftrackModal(false);
          } else if (navigationStack.length > 0) {
            navigateUp();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showSearch, showShortcuts, showOfftrackModal, navigationStack]);

  // Search filtered results
  const searchResults = rawData.filter(row => {
    const q = searchQuery.toLowerCase();
    return row.initiative.toLowerCase().includes(q) ||
           row.unit.toLowerCase().includes(q) ||
           row.team.toLowerCase().includes(q);
  }).slice(0, 20);

  // Off-track items
  const offtrackItems = rawData.filter(row => {
    const budget = calculateBudget(row, selectedQuarters);
    return budget > 0 && isInitiativeOffTrack(row, selectedQuarters);
  });

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleCSVUpload}
      />

      {/* Header */}
      <Header
        currentView={currentView}
        onViewChange={handleViewChange}
        onSearchClick={() => setShowSearch(true)}
        onUploadClick={() => fileInputRef.current?.click()}
        onShortcutsClick={() => setShowShortcuts(true)}
      />

      {/* Filter Bar - 2 rows now */}
      <FilterBar
        units={units}
        teams={teams}
        selectedUnits={selectedUnits}
        selectedTeams={selectedTeams}
        onUnitsChange={setSelectedUnits}
        onTeamsChange={setSelectedTeams}
        hideSupport={hideSupport}
        onHideSupportChange={setHideSupport}
        showOnlyOfftrack={showOnlyOfftrack}
        onShowOnlyOfftrackChange={setShowOnlyOfftrack}
        allStakeholders={stakeholderCombinations}
        selectedStakeholders={selectedStakeholders}
        onStakeholdersChange={setSelectedStakeholders}
        availableYears={availableYears}
        availableQuarters={availableQuarters}
        selectedQuarters={selectedQuarters}
        onQuartersChange={setSelectedQuarters}
        rawData={rawData}
        showTeams={showTeams}
        showInitiatives={showInitiatives}
        onShowTeamsChange={setShowTeams}
        onShowInitiativesChange={setShowInitiatives}
        onOfftrackClick={() => setShowOfftrackModal(true)}
      />

      {/* Main Content - adjusted for 2-row filter bar (Header 56px + FilterBar ~88px) */}
      <main className="mt-[144px] h-[calc(100vh-144px)] p-4 overflow-hidden">
        {currentView === 'budget' && (
          <BudgetTreemap
            data={currentRoot}
            onDrillDown={drillDown}
            onNavigateUp={navigateUp}
            showBackButton={navigationStack.length > 0}
            showTeams={showTeams}
            showInitiatives={showInitiatives}
            onUploadClick={() => fileInputRef.current?.click()}
            selectedQuarters={selectedQuarters}
            onNodeClick={handleNodeClick}
          />
        )}

        {currentView === 'stakeholders' && (
          <div className="w-full h-full bg-card rounded-lg flex items-center justify-center text-muted-foreground">
            Stakeholders view - Coming soon
          </div>
        )}

        {currentView === 'gantt' && (
          <div className="w-full h-full bg-card rounded-lg flex items-center justify-center text-muted-foreground">
            Gantt view - Coming soon
          </div>
        )}
      </main>

      {/* Search Overlay */}
      {showSearch && (
        <div
          className="fixed inset-0 bg-black/50 z-[300] pt-24 flex justify-center"
          onClick={() => { setShowSearch(false); setSearchQuery(''); }}
        >
          <div
            className="w-[500px] max-w-[90vw] max-h-[500px] bg-card rounded-lg shadow-lg flex flex-col animate-in fade-in slide-in-from-top-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center p-4 border-b border-border">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground mr-3">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск инициатив..."
                className="flex-1 border-none outline-none text-base bg-transparent"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {searchQuery ? 'Ничего не найдено' : 'Начните вводить для поиска'}
                </div>
              ) : (
                searchResults.map((row, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 cursor-pointer hover:bg-secondary"
                    onClick={() => {
                      setShowSearch(false);
                      setSearchQuery('');
                      toast.success('Найдено: ' + row.initiative);
                    }}
                  >
                    <div className="w-8 h-8 bg-secondary rounded-md flex items-center justify-center text-sm font-medium flex-shrink-0">
                      {row.initiative.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{row.initiative}</div>
                      <div className="text-xs text-muted-foreground">{row.unit} › {row.team}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts Modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-[400px] max-w-[90vw] bg-card rounded-lg shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border text-base font-semibold">
              Горячие клавиши
            </div>
            <div className="p-4 space-y-2">
              {[
                ['Вкладка Budget', '1'],
                ['Вкладка Stakeholders', '2'],
                ['Вкладка Gantt', '3'],
                ['Поиск', '/'],
                ['Наверх / Закрыть', 'Esc']
              ].map(([label, key]) => (
                <div key={label} className="flex justify-between items-center py-2">
                  <span className="text-sm">{label}</span>
                  <kbd className="px-2 py-1 bg-secondary border border-border rounded text-xs font-mono">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Off-track Modal */}
      {showOfftrackModal && (
        <div
          className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center"
          onClick={() => setShowOfftrackModal(false)}
        >
          <div
            className="w-[600px] max-w-[90vw] max-h-[80vh] bg-card rounded-lg shadow-lg flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center gap-3">
              <div className="w-8 h-8 bg-destructive/10 rounded-md flex items-center justify-center">
                <div style={{ borderStyle: 'solid', borderWidth: '0 12px 12px 0', borderColor: 'transparent hsl(var(--destructive)) transparent transparent' }} />
              </div>
              <span className="text-base font-semibold flex-1">Инициативы Off-Track</span>
              <button
                onClick={() => setShowOfftrackModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {offtrackItems.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Нет инициатив со статусом Off-Track
                </div>
              ) : (
                offtrackItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 border border-border rounded-lg cursor-pointer hover:bg-secondary hover:border-destructive transition-colors"
                    onClick={() => {
                      setShowOfftrackModal(false);
                      setShowOnlyOfftrack(true);
                      handleViewChange('gantt');
                    }}
                  >
                    <div className="font-medium mb-1">{item.initiative}</div>
                    <div className="text-xs text-muted-foreground mb-2">{item.unit} › {item.team}</div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Бюджет: {formatBudget(calculateBudget(item, selectedQuarters))}</span>
                      <span>Стейкхолдеры: {item.stakeholders || '-'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;