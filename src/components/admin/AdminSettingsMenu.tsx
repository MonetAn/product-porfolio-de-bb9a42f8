import { Settings, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AdminSettingsMenuProps {
  totalCount: number;
  filteredCount: number;
  hasFilters: boolean;
  hasData: boolean;
  onDownloadAll: () => void;
  onDownloadFiltered: () => void;
}

export default function AdminSettingsMenu({
  totalCount,
  filteredCount,
  hasFilters,
  hasData,
  onDownloadAll,
  onDownloadFiltered,
}: AdminSettingsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={!hasData}>
          <Settings size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onDownloadAll}>
          <Download size={14} className="mr-2" />
          Экспорт: Все инициативы ({totalCount})
        </DropdownMenuItem>
        {hasFilters && (
          <DropdownMenuItem onClick={onDownloadFiltered}>
            <Download size={14} className="mr-2" />
            Экспорт: Отфильтрованные ({filteredCount})
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
