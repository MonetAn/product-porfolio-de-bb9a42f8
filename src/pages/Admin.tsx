import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AdminHeader from '@/components/admin/AdminHeader';
import ScopeSelector from '@/components/admin/ScopeSelector';
import InitiativeTable from '@/components/admin/InitiativeTable';
import NewInitiativeDialog from '@/components/admin/NewInitiativeDialog';
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

  // Derived state
  const hasData = rawData.length > 0;
  const hasChanges = modifiedIds.size > 0;
  const units = getUniqueUnits(rawData);
  const teams = getTeamsForUnits(rawData, selectedUnits);
  const filteredData = filterData(rawData, selectedUnits, selectedTeams);

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
  const handleDataChange = useCallback((id: string, field: keyof AdminDataRow, value: string | string[]) => {
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
    }

    toast({
      title: 'Файл скачан',
      description
    });
  }, [rawData, filteredData, modifiedIds, quarters, originalHeaders, toast]);

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

            <div className="flex-1 overflow-hidden">
              <InitiativeTable
                data={filteredData}
                quarters={quarters}
                onDataChange={handleDataChange}
                onQuarterDataChange={handleQuarterDataChange}
                onAddInitiative={() => setNewDialogOpen(true)}
                modifiedIds={modifiedIds}
              />
            </div>
          </div>
        )}
      </main>

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
