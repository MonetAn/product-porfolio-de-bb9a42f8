
# План: Синхронизация фильтров Unit↔Team в админке

## Проблема

Сценарий:
1. Пользователь выбирает команду `AI Lab`
2. Затем выбирает юнит `Client Platform` (в который AI Lab не входит)
3. Результат: "Нет инициатив для отображения"

## Решение

Перенести логику из `FilterBar.tsx` (дашборд) в `ScopeSelector.tsx` (админка):
- При добавлении юнита → автоматически выбирать все его команды
- При удалении юнита → очищать команды, которые больше не относятся к выбранным юнитам

---

## Изменения

### Файл: `src/components/admin/ScopeSelector.tsx`

**1. Добавить prop для доступа к данным:**

```typescript
interface ScopeSelectorProps {
  units: string[];
  teams: string[];
  selectedUnits: string[];
  selectedTeams: string[];
  onUnitsChange: (units: string[]) => void;
  onTeamsChange: (teams: string[]) => void;
  allData: AdminDataRow[];  // ← Добавить для поиска команд юнита
}
```

**2. Изменить логику `toggleUnit`:**

Было:
```typescript
const toggleUnit = (u: string) => {
  if (selectedUnits.includes(u)) {
    const newUnits = selectedUnits.filter(x => x !== u);
    onUnitsChange(newUnits);
    if (newUnits.length === 0) {
      onTeamsChange([]);
    }
  } else {
    onUnitsChange([...selectedUnits, u]);
  }
};
```

Станет:
```typescript
const toggleUnit = (u: string) => {
  if (selectedUnits.includes(u)) {
    // Удаление юнита
    const newUnits = selectedUnits.filter(x => x !== u);
    onUnitsChange(newUnits);
    
    // Очистить команды, которые больше не валидны
    if (newUnits.length > 0) {
      const validTeams = allData
        .filter(r => newUnits.includes(r.unit))
        .map(r => r.team);
      onTeamsChange(selectedTeams.filter(t => validTeams.includes(t)));
    } else {
      onTeamsChange([]);
    }
  } else {
    // Добавление юнита → авто-выбор всех его команд
    const newUnits = [...selectedUnits, u];
    onUnitsChange(newUnits);
    
    const teamsFromNewUnit = [...new Set(allData
      .filter(r => r.unit === u)
      .map(r => r.team)
      .filter(Boolean))];
    
    const newTeams = [...new Set([...selectedTeams, ...teamsFromNewUnit])];
    onTeamsChange(newTeams);
  }
};
```

**3. Обновить вызов в Admin.tsx:**

```typescript
<ScopeSelector
  units={units}
  teams={teams}
  selectedUnits={selectedUnits}
  selectedTeams={selectedTeams}
  onUnitsChange={setSelectedUnits}
  onTeamsChange={setSelectedTeams}
  allData={rawData}  // ← Добавить
/>
```

---

## Результат

| Действие | Сейчас | После |
|----------|--------|-------|
| Выбрать Client Platform | Только юнит выбран | Юнит + все его команды выбраны |
| Снять DTIP (остаётся Client Platform) | Команды DTIP остаются выбраны | Команды DTIP убраны |
| Сначала AI Lab, потом Client Platform | AI Lab остаётся, но нет данных | AI Lab убран, добавлены команды Client Platform |

---

## Файлы для изменения

1. `src/components/admin/ScopeSelector.tsx` — добавить prop `allData`, изменить `toggleUnit`
2. `src/pages/Admin.tsx` — передать `rawData` в `ScopeSelector`
3. `src/pages/AdminPeople.tsx` — передать `rawData` в `ScopeSelector`
