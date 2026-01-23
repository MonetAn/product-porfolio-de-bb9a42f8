
# План: Исправление навигации "назад" при провале в юнит

## Проблема

После клика на юнит в treemap выбираются и юнит, и все его команды. При нажатии кнопки "назад":
1. Сначала очищаются только команды
2. Юнит остаётся выбранным
3. Требуется два нажатия "назад" для полного выхода
4. Визуально это выглядит как "меняется верхняя панель" без изменения treemap

## Решение

При нажатии "назад", если выбран один юнит и его команды — сбрасывать их одновременно (одним действием).

## Файл для изменения

| Файл | Изменение |
|------|-----------|
| `src/pages/Index.tsx` | Изменить логику `handleNavigateBack` |

## Техническая реализация

### Текущий код (строки 270-282):

```typescript
const handleNavigateBack = useCallback(() => {
  if (selectedTeams.length > 0) {
    setSelectedTeams([]);
  } else if (selectedUnits.length > 0) {
    setSelectedUnits([]);
  } else if (selectedStakeholders.length > 0) {
    setSelectedStakeholders([]);
  }
}, [selectedTeams.length, selectedUnits.length, selectedStakeholders.length]);
```

### Новый код:

```typescript
const handleNavigateBack = useCallback(() => {
  if (selectedTeams.length > 0) {
    // If teams are selected with a single unit, clear both at once
    // (this is the typical "drilled into unit" state)
    if (selectedUnits.length === 1) {
      setSelectedTeams([]);
      setSelectedUnits([]);
    } else {
      // Multiple units selected - just clear teams
      setSelectedTeams([]);
    }
  } else if (selectedUnits.length > 0) {
    setSelectedUnits([]);
  } else if (selectedStakeholders.length > 0) {
    setSelectedStakeholders([]);
  }
}, [selectedTeams.length, selectedUnits.length, selectedStakeholders.length]);
```

## Результат

| Сценарий | До | После |
|----------|-----|-------|
| Клик на юнит → Назад | 2 нажатия (команды, потом юнит) | 1 нажатие (оба сразу) |
| Выбор нескольких юнитов в фильтре → Назад | Сбрасываются команды, потом юниты | Без изменений |

## Альтернативный вариант

Если нужно сохранить двухшаговую навигацию (сначала команды, потом юнит), можно оставить текущую логику, но добавить визуальную обратную связь, чтобы было понятно, что сброс произошёл.
