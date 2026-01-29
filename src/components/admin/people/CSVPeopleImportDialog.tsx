import { useState, useCallback } from 'react';
import { Upload, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { parsePeopleCSV, ParsedPerson } from '@/lib/peopleDataManager';
import { usePeopleMutations } from '@/hooks/usePeople';

interface CSVPeopleImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingUnits: string[];
  existingTeams: string[];
}

export default function CSVPeopleImportDialog({
  open,
  onOpenChange,
  existingUnits,
  existingTeams,
}: CSVPeopleImportDialogProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [parsedPeople, setParsedPeople] = useState<ParsedPerson[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  const { importPeople } = usePeopleMutations();

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseErrors(['Пожалуйста, выберите файл .csv']);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parsePeopleCSV(text, existingUnits, existingTeams);
      
      if (result.errors.length > 0) {
        setParseErrors(result.errors);
        return;
      }
      
      setParsedPeople(result.people);
      setParseWarnings(result.warnings);
      setParseErrors([]);
      setStep('preview');
    };
    reader.readAsText(file, 'UTF-8');
  }, [existingUnits, existingTeams]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = async () => {
    await importPeople.mutateAsync(parsedPeople);
    onOpenChange(false);
    resetState();
  };

  const resetState = () => {
    setStep('upload');
    setParsedPeople([]);
    setParseErrors([]);
    setParseWarnings([]);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  const peopleWithWarnings = parsedPeople.filter(p => p.parseWarnings.length > 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Импорт сотрудников из CSV</DialogTitle>
          <DialogDescription>
            {step === 'upload' 
              ? 'Загрузите CSV-файл с данными сотрудников из HR-системы'
              : `Проверьте данные перед импортом (${parsedPeople.length} сотрудников)`
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div
            className={`
              border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
              ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            `}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.csv';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleFile(file);
              };
              input.click();
            }}
          >
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="font-medium mb-1">Перетащите CSV-файл сюда</p>
            <p className="text-sm text-muted-foreground">или нажмите для выбора</p>
          </div>
        )}

        {parseErrors.length > 0 && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            {parseErrors.map((err, i) => (
              <p key={i} className="text-sm text-destructive">{err}</p>
            ))}
          </div>
        )}

        {step === 'preview' && (
          <>
            {parseWarnings.length > 0 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div>
                  {parseWarnings.map((w, i) => (
                    <p key={i} className="text-sm text-yellow-700">{w}</p>
                  ))}
                </div>
              </div>
            )}

            <ScrollArea className="h-[300px] border rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="text-left p-2">ФИО</th>
                    <th className="text-left p-2">Unit</th>
                    <th className="text-left p-2">Команда</th>
                    <th className="text-left p-2">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedPeople.slice(0, 50).map((person, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{person.full_name}</td>
                      <td className="p-2 text-muted-foreground">{person.unit || '—'}</td>
                      <td className="p-2 text-muted-foreground">{person.team || '—'}</td>
                      <td className="p-2">
                        {person.parseWarnings.length > 0 ? (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {person.parseWarnings.length}
                          </Badge>
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedPeople.length > 50 && (
                <p className="p-2 text-center text-muted-foreground text-sm">
                  ... и ещё {parsedPeople.length - 50} сотрудников
                </p>
              )}
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Назад
              </Button>
              <Button 
                onClick={handleImport}
                disabled={importPeople.isPending}
              >
                {importPeople.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Импорт...
                  </>
                ) : (
                  <>Импортировать {parsedPeople.length} сотрудников</>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
