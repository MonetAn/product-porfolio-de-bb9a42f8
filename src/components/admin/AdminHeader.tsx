import { ArrowLeft, FileSpreadsheet, Check, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SyncStatus } from '@/hooks/useInitiativeMutations';
import UnifiedSettingsMenu from './UnifiedSettingsMenu';

interface AdminHeaderProps {
  initiativeCount: number;
  totalCount: number;
  hasData: boolean;
  hasFilters: boolean;
  syncStatus: SyncStatus;
  pendingChanges: number;
  onImportClick: () => void;
  onDownloadAll: () => void;
  onDownloadFiltered: () => void;
  onRetry: () => void;
}

const AdminHeader = ({
  initiativeCount,
  totalCount,
  hasData,
  hasFilters,
  syncStatus,
  pendingChanges,
  onImportClick,
  onDownloadAll,
  onDownloadFiltered,
  onRetry
}: AdminHeaderProps) => {
  const navigate = useNavigate();

  // Sync status indicator
  const renderSyncStatus = () => {
    switch (syncStatus) {
      case 'saving':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 text-primary text-xs font-medium">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Сохранение...</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {pendingChanges > 0 ? `${pendingChanges} изменений в очереди` : 'Сохранение изменений'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'synced':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 text-primary text-xs font-medium">
                  <Check size={12} />
                  <span>Сохранено</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Все изменения сохранены</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'error':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
                >
                  <AlertCircle size={12} />
                  <span>Ошибка</span>
                  <RefreshCw size={10} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Нажмите для повторной попытки</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      case 'offline':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted text-muted-foreground text-xs font-medium">
            <AlertCircle size={12} />
            <span>Офлайн</span>
          </div>
        );
      default:
        return null;
    }
  };

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
        <div className="ml-6 flex items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} />
            <span>
              {initiativeCount === totalCount 
                ? `${initiativeCount} инициатив` 
                : `${initiativeCount} из ${totalCount} инициатив`
              }
            </span>
          </div>
          {renderSyncStatus()}
        </div>
      )}

      {/* Actions */}
      <div className="ml-auto flex items-center gap-2">
        <UnifiedSettingsMenu
          onImportInitiatives={onImportClick}
          onExportAllInitiatives={onDownloadAll}
          onExportFilteredInitiatives={onDownloadFiltered}
          initiativesTotal={totalCount}
          initiativesFiltered={initiativeCount}
          hasInitiativeFilters={hasFilters}
          hasData={hasData}
        />
      </div>
    </header>
  );
};

export default AdminHeader;
