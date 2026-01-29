import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PeopleFiltersProps {
  units: string[];
  teams: string[];
  selectedUnits: string[];
  selectedTeams: string[];
  onUnitsChange: (units: string[]) => void;
  onTeamsChange: (teams: string[]) => void;
  showActive: boolean;
  onShowActiveChange: (show: boolean) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  quarters: string[];
}

export default function PeopleFilters({
  units,
  teams,
  selectedUnits,
  selectedTeams,
  onUnitsChange,
  onTeamsChange,
  showActive,
  onShowActiveChange,
  searchQuery,
  onSearchChange,
}: PeopleFiltersProps) {
  const hasFilters = selectedUnits.length > 0 || selectedTeams.length > 0 || !showActive || searchQuery;

  const clearFilters = () => {
    onUnitsChange([]);
    onTeamsChange([]);
    onShowActiveChange(true);
    onSearchChange('');
  };

  return (
    <div className="flex items-center gap-4 px-6 py-3 border-b bg-muted/30">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по имени, email, команде..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Unit filter */}
      <Select
        value={selectedUnits[0] || 'all'}
        onValueChange={(v) => onUnitsChange(v === 'all' ? [] : [v])}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Unit" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все Unit</SelectItem>
          {units.map(unit => (
            <SelectItem key={unit} value={unit}>{unit}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Team filter */}
      <Select
        value={selectedTeams[0] || 'all'}
        onValueChange={(v) => onTeamsChange(v === 'all' ? [] : [v])}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Команда" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все команды</SelectItem>
          {teams.map(team => (
            <SelectItem key={team} value={team}>{team}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Active only checkbox */}
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox
          checked={showActive}
          onCheckedChange={(checked) => onShowActiveChange(!!checked)}
        />
        <span className="text-sm">Только активные</span>
      </label>

      {/* Clear filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Сбросить
        </Button>
      )}
    </div>
  );
}
