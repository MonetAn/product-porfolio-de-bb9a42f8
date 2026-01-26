import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface NewInitiativeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: string[];
  teams: string[];
  defaultUnit?: string;
  defaultTeam?: string;
  onSubmit: (data: { unit: string; team: string; initiative: string; description: string; documentationLink: string }) => void;
}

const NewInitiativeDialog = ({
  open,
  onOpenChange,
  units,
  teams,
  defaultUnit = '',
  defaultTeam = '',
  onSubmit
}: NewInitiativeDialogProps) => {
  const [unit, setUnit] = useState(defaultUnit);
  const [team, setTeam] = useState(defaultTeam);
  const [initiative, setInitiative] = useState('');
  const [description, setDescription] = useState('');
  const [documentationLink, setDocumentationLink] = useState('');

  const handleSubmit = () => {
    if (!unit || !initiative) return;
    onSubmit({ unit, team, initiative, description, documentationLink });
    // Reset form
    setInitiative('');
    setDescription('');
    setDocumentationLink('');
    onOpenChange(false);
  };

  // Filter teams based on selected unit
  const availableTeams = unit 
    ? teams 
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Новая инициатива</DialogTitle>
          <DialogDescription>
            Создайте новую инициативу. Она будет добавлена с пустыми квартальными данными.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Unit */}
          <div className="grid gap-2">
            <Label htmlFor="unit">Unit *</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите юнит" />
              </SelectTrigger>
              <SelectContent>
                {units.map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Team */}
          <div className="grid gap-2">
            <Label htmlFor="team">Team</Label>
            <Select value={team} onValueChange={setTeam} disabled={!unit}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите команду (опционально)" />
              </SelectTrigger>
              <SelectContent>
                {availableTeams.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Initiative name */}
          <div className="grid gap-2">
            <Label htmlFor="initiative">Название инициативы *</Label>
            <Input
              id="initiative"
              value={initiative}
              onChange={(e) => setInitiative(e.target.value)}
              placeholder="Введите название"
            />
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="description">Описание</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание инициативы"
            />
          </div>

          {/* Documentation Link */}
          <div className="grid gap-2">
            <Label htmlFor="docLink">Ссылка на документацию</Label>
            <Input
              id="docLink"
              value={documentationLink}
              onChange={(e) => setDocumentationLink(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={!unit || !initiative}>
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewInitiativeDialog;
