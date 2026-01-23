
# План: Автовыбор команд при клике на юнит в treemap

## Проблема

При клике на юнит в treemap:
1. Выбирается только юнит, команды не выбираются
2. Если потом выбрать другой юнит через фильтр, первый юнит "пропадает"

Причина: `handleNodeClick` в Index.tsx очищает команды (`setSelectedTeams([])`) вместо выбора всех команд юнита.

## Решение

При клике на юнит в treemap автоматически выбирать все его команды (аналогично логике в `toggleUnit` из FilterBar).

## Файл для изменения

| Файл | Строки | Изменение |
|------|--------|-----------|
| `src/pages/Index.tsx` | 236-241 | Добавить выбор всех команд юнита |

## Техническая реализация

### Index.tsx — функция `handleNodeClick`

**Было (строки 236-241):**
```typescript
} else if (node.isUnit) {
  // Reset teams and select only this unit
  setSelectedTeams([]);
  setSelectedUnits([node.name]);
  // Auto-enable Teams toggle
  if (!showTeams) setShowTeams(true);
}
```

**Станет:**
```typescript
} else if (node.isUnit) {
  // Select this unit and all its teams
  setSelectedUnits([node.name]);
  // Auto-select all teams from this unit
  const teamsFromUnit = [...new Set(
    rawData
      .filter(r => r.unit === node.name)
      .map(r => r.team)
      .filter(Boolean)
  )];
  setSelectedTeams(teamsFromUnit);
  // Auto-enable Teams toggle
  if (!showTeams) setShowTeams(true);
}
```

## Результат

| Сценарий | До | После |
|----------|-----|-------|
| Клик на юнит "Data" | Units: [Data], Teams: [] | Units: [Data], Teams: [Team1, Team2, ...] |
| Затем выбор юнита "Growth" через фильтр | Добавятся Teams из Growth | Работает корректно |

Это унифицирует поведение: клик на юнит в treemap и выбор юнита в dropdown будут работать одинаково.
