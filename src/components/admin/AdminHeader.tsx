import { ArrowLeft, Upload, Download, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AdminHeaderProps {
  initiativeCount: number;
  totalCount: number;
  hasData: boolean;
  hasChanges: boolean;
  modifiedCount: number;
  hasFilters: boolean;
  onUploadClick: () => void;
  onDownloadAll: () => void;
  onDownloadFiltered: () => void;
  onDownloadModified: () => void;
}

const AdminHeader = ({
  initiativeCount,
  totalCount,
  hasData,
  hasChanges,
  modifiedCount,
  hasFilters,
  onUploadClick,
  onDownloadAll,
  onDownloadFiltered,
  onDownloadModified
}: AdminHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="h-14 bg-card border-b border-border flex items-center px-6 fixed top-0 left-0 right-0 z-50">
      {/* Back to Dashboard */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={() => navigate('/')}
      >
        <ArrowLeft size={16} />
        <span className="hidden sm:inline">Дашборд</span>
      </Button>

      {/* Logo & Title */}
      <div className="flex items-center gap-2 font-semibold text-foreground ml-4">
        <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center text-primary-foreground text-sm font-bold">
          A
        </div>
        <span>Админка</span>
      </div>

      {/* Status indicator - dynamic count */}
      {hasData && (
        <div className="ml-6 flex items-center gap-2 text-sm text-muted-foreground">
          <FileSpreadsheet size={16} />
          <span>
            {initiativeCount === totalCount 
              ? `${initiativeCount} инициатив` 
              : `${initiativeCount} из ${totalCount} инициатив`
            }
          </span>
          {hasChanges && (
            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
              {modifiedCount} изменено
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={onUploadClick}
        >
          <Upload size={16} />
          <span className="hidden sm:inline">Загрузить CSV</span>
        </Button>

        {/* Download dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              size="sm"
              className="gap-2"
              disabled={!hasData}
            >
              <Download size={16} />
              <span className="hidden sm:inline">Скачать CSV</span>
              <ChevronDown size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onDownloadAll}>
              Все инициативы ({totalCount})
            </DropdownMenuItem>
            {hasFilters && (
              <DropdownMenuItem onClick={onDownloadFiltered}>
                Отфильтрованные ({initiativeCount})
              </DropdownMenuItem>
            )}
            {modifiedCount > 0 && (
              <DropdownMenuItem onClick={onDownloadModified}>
                Только измененные ({modifiedCount})
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default AdminHeader;
