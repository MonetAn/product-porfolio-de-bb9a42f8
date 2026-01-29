import { useState } from 'react';
import { Settings, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import PeopleListDialog from './PeopleListDialog';
import UnitTeamMappingDialog from './UnitTeamMappingDialog';

interface SettingsMenuProps {
  onExport?: () => void;
  hasData?: boolean;
}

export default function SettingsMenu({ onExport, hasData = true }: SettingsMenuProps) {
  const [peopleListOpen, setPeopleListOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <Settings size={18} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onExport && (
            <>
              <DropdownMenuItem onClick={onExport} disabled={!hasData}>
                <Download size={14} className="mr-2" />
                Экспорт CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => setPeopleListOpen(true)}>
            👁️ Просмотр сотрудников
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMappingOpen(true)}>
            🔄 Синонимы Unit/Team
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PeopleListDialog 
        open={peopleListOpen} 
        onOpenChange={setPeopleListOpen} 
      />
      
      <UnitTeamMappingDialog 
        open={mappingOpen} 
        onOpenChange={setMappingOpen} 
      />
    </>
  );
}
