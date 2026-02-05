

# План: Изменить логику off-track на "последний квартал периода"

## Текущее поведение

Инициатива считается off-track, если она была off-track **хотя бы в одном квартале** выбранного диапазона.

```typescript
// Текущая логика
return selectedQuarters.some(q => {
  const qData = row.quarterlyData[q];
  return qData && !qData.onTrack;
});
```

## Новое поведение

Инициатива считается off-track, если она off-track **в последнем квартале** выбранного диапазона.

---

## Изменения

### 1. `src/lib/dataManager.ts` — функция `isInitiativeOffTrack`

```typescript
export function isInitiativeOffTrack(row: RawDataRow, selectedQuarters: string[]): boolean {
  if (selectedQuarters.length === 0) return false;
  
  // Off-track only if the LAST quarter in selected period was off-track
  const lastQuarter = selectedQuarters[selectedQuarters.length - 1];
  const qData = row.quarterlyData[lastQuarter];
  return qData ? !qData.onTrack : false;
}
```

---

## Что использует эту функцию

| Место | Эффект изменения |
|-------|------------------|
| `shouldIncludeRow()` | Фильтр "показать только off-track" будет показывать только инициативы с off-track в последнем квартале |
| `buildFullTree()` | Статус `offTrack` на нодах тримапа будет отражать последний квартал |
| `FilterBar.tsx` | Счётчик off-track инициатив обновится автоматически |

---

## Консистентность с логикой Support

Эта логика станет **идентичной** логике фильтра Support (которая уже работает по последнему кварталу):

```typescript
// isInitiativeSupport — уже использует последний квартал
const lastQuarter = selectedQuarters[selectedQuarters.length - 1];
const lastQData = row.quarterlyData[lastQuarter];
return lastQData?.support || false;
```

---

## Обновление документации

Нужно обновить тултип в FilterBar, чтобы он отражал новую логику:

**Было**: "Инициатива считается off-track, если была off-track хотя бы в одном квартале периода"

**Станет**: "Инициатива считается off-track, если off-track в последнем квартале периода"

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/lib/dataManager.ts` | Изменить `isInitiativeOffTrack` — проверять только последний квартал |
| `src/components/FilterBar.tsx` (опционально) | Обновить тултип для тоггла off-track |

---

## Оценка

| Метрика | Значение |
|---------|----------|
| Сложность | Очень низкая |
| Файлов изменится | 1-2 |
| Риск регрессии | Минимальный — изолированная функция |
| Время реализации | 2-3 минуты |

