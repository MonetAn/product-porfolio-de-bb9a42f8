import { ArrowLeft, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface AdminHeaderProps {
  initiativeCount: number;
  hasData: boolean;
  hasChanges: boolean;
  onUploadClick: () => void;
  onDownloadClick: () => void;
}

const AdminHeader = ({
  initiativeCount,
  hasData,
  hasChanges,
  onUploadClick,
  onDownloadClick
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

      {/* Status indicator */}
      {hasData && (
        <div className="ml-6 flex items-center gap-2 text-sm text-muted-foreground">
          <FileSpreadsheet size={16} />
          <span>{initiativeCount} инициатив</span>
          {hasChanges && (
            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
              Изменено
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

        <Button
          variant="default"
          size="sm"
          className="gap-2"
          onClick={onDownloadClick}
          disabled={!hasData}
        >
          <Download size={16} />
          <span className="hidden sm:inline">Скачать CSV</span>
        </Button>
      </div>
    </header>
  );
};

export default AdminHeader;
