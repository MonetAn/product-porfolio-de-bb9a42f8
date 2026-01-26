

# План: Этап 2 — Коэффициенты трудозатрат

## Цель
Добавить для каждой инициативы поле **«Коэффициент трудозатрат»** (0-100%), которое показывает, какую долю усилий команды занимает эта инициатива.

## Бизнес-правило
Сумма коэффициентов всех инициатив **одной команды** не должна превышать 100%.

## Визуальный результат

### В таблице — новая колонка "Effort %"

```text
│ Unit │ Team │ Initiative │ Type │ Effort % │ Stakeholders │ ...
├──────┼──────┼────────────┼──────┼──────────┼──────────────┼────
│ Unit1│ TeamA│ Init 1     │ Prod │   40%    │ Russia, EU   │ ...
│ Unit1│ TeamA│ Init 2     │ Strm │   35%    │ Turkey+      │ ...
│ Unit1│ TeamA│ Init 3     │ Enbl │   30%  ⚠ │ IT           │ ... ← превышение
```

### В карточке — слайдер с индикатором

```text
┌─────────────────────────────────────────────────┐
│ Коэффициент трудозатрат *                       │
│                                                 │
│ ├─────────●─────────────────┤  40%              │
│                                                 │
│ Команда TeamA: 105% из 100%  ⚠ Превышение!     │
└─────────────────────────────────────────────────┘
```

---

## Техническая реализация

### 1. Модель данных

**Файл: `src/lib/adminDataManager.ts`**

Добавить поле в интерфейс:
```typescript
export interface AdminDataRow {
  // ... существующие поля
  effortCoefficient: number;  // 0-100, процент трудозатрат
}
```

Обновить функции:
- `parseAdminCSV` — парсить колонку "Effort %" из CSV
- `exportAdminCSV` — экспортировать поле в CSV
- `createNewInitiative` — значение по умолчанию `0`

### 2. Утилита валидации

**Файл: `src/lib/adminDataManager.ts`**

```typescript
export function getTeamEffortSum(
  data: AdminDataRow[], 
  unit: string, 
  team: string, 
  excludeId?: string
): number {
  return data
    .filter(row => row.unit === unit && row.team === team && row.id !== excludeId)
    .reduce((sum, row) => sum + (row.effortCoefficient || 0), 0);
}

export function validateTeamEffort(
  data: AdminDataRow[],
  unit: string,
  team: string
): { isValid: boolean; total: number } {
  const total = getTeamEffortSum(data, unit, team);
  return { isValid: total <= 100, total };
}
```

### 3. Колонка в таблице

**Файл: `src/components/admin/InitiativeTable.tsx`**

Добавить колонку после "Type":
```tsx
<TableHead className="min-w-[80px]">Effort %</TableHead>
```

В строке:
```tsx
<TableCell className="p-2">
  <div className="flex items-center gap-1">
    <span className={`text-xs ${teamEffortExceeds ? 'text-red-600 font-medium' : ''}`}>
      {row.effortCoefficient || 0}%
    </span>
    {teamEffortExceeds && <AlertTriangle size={12} className="text-red-500" />}
  </div>
</TableCell>
```

### 4. Редактирование в карточке

**Файл: `src/components/admin/InitiativeDetailDialog.tsx`**

Добавить после блока "Тип инициативы":
```tsx
{/* Effort Coefficient */}
<div className="space-y-2">
  <RequiredLabel>Коэффициент трудозатрат</RequiredLabel>
  
  <div className="flex items-center gap-4">
    <Slider
      value={[initiative.effortCoefficient || 0]}
      onValueChange={([v]) => onDataChange(initiative.id, 'effortCoefficient', v)}
      max={100}
      step={5}
      className="flex-1"
    />
    <span className="w-12 text-right font-mono">
      {initiative.effortCoefficient || 0}%
    </span>
  </div>
  
  {/* Team total indicator */}
  <div className={`text-xs ${teamEffort.isValid ? 'text-muted-foreground' : 'text-red-600'}`}>
    Команда {initiative.team}: {teamEffort.total}% из 100%
    {!teamEffort.isValid && ' ⚠ Превышение!'}
  </div>
</div>
```

### 5. Пропс для валидации

Передать `allData` в `InitiativeDetailDialog` для расчёта суммы по команде:

```tsx
// В InitiativeTable.tsx
<InitiativeDetailDialog
  initiative={selectedInitiative}
  allData={data}  // добавить
  // ...
/>
```

---

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `src/lib/adminDataManager.ts` | + поле `effortCoefficient`, + функции валидации, обновить парсер/экспорт |
| `src/components/admin/InitiativeTable.tsx` | + колонка Effort %, + передача `allData` |
| `src/components/admin/InitiativeDetailDialog.tsx` | + Slider, + индикатор суммы команды |

## Оценка
~8-10 кредитов на реализацию (3 файла, умеренная сложность)

