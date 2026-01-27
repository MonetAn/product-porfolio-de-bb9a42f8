import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, ClipboardList } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AdminHeader from '@/components/admin/AdminHeader';
import ScopeSelector from '@/components/admin/ScopeSelector';
import InitiativeTable from '@/components/admin/InitiativeTable';
import NewInitiativeDialog from '@/components/admin/NewInitiativeDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  parseAdminCSV,
  exportAdminCSV,
  getUniqueUnits,
  getTeamsForUnits,
  filterData,
  createNewInitiative,
  AdminDataRow,
  AdminQuarterData
} from '@/lib/adminDataManager';

const STORAGE_KEY = 'admin_portfolio_draft';
const AUTOSAVE_INTERVAL = 30000; // 30 секунд

interface DraftData {
  rawData: AdminDataRow[];
  quarters: string[];
  originalHeaders: string[];
  modifiedIds: string[];
  savedAt: number;
}

const Admin = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data state
  const [rawData, setRawData] = useState<AdminDataRow[]>([]);
  const [originalData, setOriginalData] = useState<AdminDataRow[]>([]);
  const [quarters, setQuarters] = useState<string[]>([]);
  const [originalHeaders, setOriginalHeaders] = useState<string[]>([]);

  // Filter state
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  // UI state
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [modifiedIds, setModifiedIds] = useState<Set<string>>(new Set());
  
  // Draft restoration state
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [savedDraft, setSavedDraft] = useState<DraftData | null>(null);

  // Derived state
  const hasData = rawData.length > 0;
  const hasChanges = modifiedIds.size > 0;
  const units = getUniqueUnits(rawData);
  const teams = getTeamsForUnits(rawData, selectedUnits);
  const filteredData = filterData(rawData, selectedUnits, selectedTeams);
  const needsSelection = hasData && selectedUnits.length === 0;
  const hideUnitTeamColumns = selectedUnits.length > 0;

  // Check for saved draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const draft: DraftData = JSON.parse(saved);
        if (draft.rawData && draft.rawData.length > 0) {
          setSavedDraft(draft);
          setShowRestoreDialog(true);
        }
      }
    } catch (e) {
      console.error('Failed to load draft:', e);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Autosave to localStorage every 30 seconds if there are changes
  useEffect(() => {
    if (!hasChanges || rawData.length === 0) return;

    const interval = setInterval(() => {
      try {
        const draft: DraftData = {
          rawData,
          quarters,
          originalHeaders,
          modifiedIds: Array.from(modifiedIds),
          savedAt: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } catch (e) {
        console.error('Failed to save draft:', e);
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [hasChanges, rawData, quarters, originalHeaders, modifiedIds]);

  // Clear draft when changes are saved (downloaded)
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear draft:', e);
    }
  }, []);

  // Restore draft data
  const handleRestoreDraft = useCallback(() => {
    if (savedDraft) {
      setRawData(savedDraft.rawData);
      setOriginalData(JSON.parse(JSON.stringify(savedDraft.rawData)));
      setQuarters(savedDraft.quarters);
      setOriginalHeaders(savedDraft.originalHeaders);
      setModifiedIds(new Set(savedDraft.modifiedIds));
      
      toast({
        title: 'Черновик восстановлен',
        description: `Загружено ${savedDraft.rawData.length} инициатив`
      });
    }
    setShowRestoreDialog(false);
    setSavedDraft(null);
  }, [savedDraft, toast]);

  // Discard draft
  const handleDiscardDraft = useCallback(() => {
    clearDraft();
    setShowRestoreDialog(false);
    setSavedDraft(null);
  }, [clearDraft]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  // File handling
  const handleFileUpload = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Ошибка',
        description: 'Пожалуйста, загрузите CSV файл',
        variant: 'destructive'
      });
      return;
    }

    if (hasChanges) {
      toast({
        title: 'Внимание',
        description: 'У вас есть несохраненные изменения. Скачайте текущий CSV перед загрузкой нового.',
        variant: 'destructive'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { data, quarters: q, originalHeaders: headers } = parseAdminCSV(text);
      
      setRawData(data);
      setOriginalData(JSON.parse(JSON.stringify(data)));
      setQuarters(q);
      setOriginalHeaders(headers);
      setSelectedUnits([]);
      setSelectedTeams([]);
      setModifiedIds(new Set());

      toast({
        title: 'Файл загружен',
        description: `Загружено ${data.length} инициатив`
      });
    };
    reader.readAsText(file);
  }, [hasChanges, toast]);

  // Drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  // Data modification
  const handleDataChange = useCallback((id: string, field: keyof AdminDataRow, value: string | string[] | number) => {
    setRawData(prev => prev.map(row => {
      if (row.id === id) {
        return { ...row, [field]: value };
      }
      return row;
    }));
    setModifiedIds(prev => new Set(prev).add(id));
  }, []);

  const handleQuarterDataChange = useCallback((
    id: string, 
    quarter: string, 
    field: keyof AdminQuarterData, 
    value: string | number | boolean
  ) => {
    setRawData(prev => prev.map(row => {
      if (row.id === id) {
        return {
          ...row,
          quarterlyData: {
            ...row.quarterlyData,
            [quarter]: {
              ...row.quarterlyData[quarter],
              [field]: value
            }
          }
        };
      }
      return row;
    }));
    setModifiedIds(prev => new Set(prev).add(id));
  }, []);

  // New initiative
  const handleAddInitiative = useCallback((data: {
    unit: string;
    team: string;
    initiative: string;
    initiativeType: string;
    stakeholdersList: string[];
    description: string;
    documentationLink: string;
  }) => {
    const newRow = createNewInitiative(data.unit, data.team, quarters, data.initiativeType as any, data.stakeholdersList);
    newRow.initiative = data.initiative;
    newRow.description = data.description;
    newRow.documentationLink = data.documentationLink;
    
    setRawData(prev => [...prev, newRow]);
    setModifiedIds(prev => new Set(prev).add(newRow.id));
    
    toast({
      title: 'Инициатива создана',
      description: `"${data.initiative}" добавлена в ${data.unit}`
    });
  }, [quarters, toast]);

  // Export - can download all, filtered, or modified only
  const handleDownload = useCallback((mode: 'all' | 'filtered' | 'modified' = 'all') => {
    let dataToExport: AdminDataRow[];
    let description: string;

    switch (mode) {
      case 'filtered':
        dataToExport = filteredData;
        description = `Скачано ${filteredData.length} отфильтрованных инициатив`;
        break;
      case 'modified':
        dataToExport = rawData.filter(row => modifiedIds.has(row.id));
        description = `Скачано ${dataToExport.length} измененных инициатив`;
        break;
      default:
        dataToExport = rawData;
        description = `Скачано ${rawData.length} инициатив`;
    }

    if (dataToExport.length === 0) {
      toast({
        title: 'Нет данных',
        description: 'Нет инициатив для скачивания',
        variant: 'destructive'
      });
      return;
    }

    const csv = exportAdminCSV(dataToExport, quarters, originalHeaders);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-${mode}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    // Mark as saved only if downloading all
    if (mode === 'all') {
      setOriginalData(JSON.parse(JSON.stringify(rawData)));
      setModifiedIds(new Set());
      clearDraft();
    }

    toast({
      title: 'Файл скачан',
      description
    });
  }, [rawData, filteredData, modifiedIds, quarters, originalHeaders, toast, clearDraft]);

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader
        initiativeCount={filteredData.length}
        totalCount={rawData.length}
        hasData={hasData}
        hasChanges={hasChanges}
        modifiedCount={modifiedIds.size}
        hasFilters={selectedUnits.length > 0 || selectedTeams.length > 0}
        onUploadClick={() => fileInputRef.current?.click()}
        onDownloadAll={() => handleDownload('all')}
        onDownloadFiltered={() => handleDownload('filtered')}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          e.target.value = '';
        }}
      />

      <main className="pt-14">
        {!hasData ? (
          /* Empty state with drag and drop */
          <div
            className={`flex flex-col items-center justify-center min-h-[calc(100vh-56px)] p-8 transition-colors ${
              isDragging ? 'bg-primary/5' : ''
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={`border-2 border-dashed rounded-xl p-12 text-center max-w-md transition-colors ${
              isDragging ? 'border-primary bg-primary/10' : 'border-border'
            }`}>
              <Upload size={48} className="mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Загрузите Portfolio CSV</h2>
              <p className="text-muted-foreground mb-6">
                Перетащите файл сюда или нажмите кнопку ниже
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Выбрать файл
              </button>
            </div>
          </div>
        ) : (
          /* Data view */
          <div className="flex flex-col h-[calc(100vh-56px)]">
            <ScopeSelector
              units={units}
              teams={teams}
              selectedUnits={selectedUnits}
              selectedTeams={selectedTeams}
              onUnitsChange={setSelectedUnits}
              onTeamsChange={setSelectedTeams}
            />

            {needsSelection ? (
              /* Placeholder when no Unit selected */
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="border border-dashed border-border rounded-xl p-12 text-center max-w-md">
                  <ClipboardList size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Выберите Unit и Team</h2>
                  <p className="text-muted-foreground">
                    Для просмотра и редактирования инициатив выберите Unit и Team в фильтрах выше
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <InitiativeTable
                  data={filteredData}
                  allData={rawData}
                  quarters={quarters}
                  selectedUnits={selectedUnits}
                  selectedTeams={selectedTeams}
                  onDataChange={handleDataChange}
                  onQuarterDataChange={handleQuarterDataChange}
                  onAddInitiative={() => setNewDialogOpen(true)}
                  modifiedIds={modifiedIds}
                  hideUnitTeamColumns={hideUnitTeamColumns}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Draft Restore Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Найден несохранённый черновик</DialogTitle>
            <DialogDescription>
              {savedDraft && (
                <>
                  Последнее изменение: {new Date(savedDraft.savedAt).toLocaleString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: 'numeric',
                    month: 'short'
                  })}
                  <br />
                  Инициатив: {savedDraft.rawData.length}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleDiscardDraft}>
              Удалить черновик
            </Button>
            <Button onClick={handleRestoreDraft}>
              Восстановить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewInitiativeDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        units={units}
        teams={teams}
        defaultUnit={selectedUnits[0] || ''}
        defaultTeam={selectedTeams[0] || ''}
        onSubmit={handleAddInitiative}
      />
    </div>
  );
};

export default Admin;
