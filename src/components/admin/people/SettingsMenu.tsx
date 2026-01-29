import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import PeopleListDialog from './PeopleListDialog';
import UnitTeamMappingDialog from './UnitTeamMappingDialog';

export default function SettingsMenu() {
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
