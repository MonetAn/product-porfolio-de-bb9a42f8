

# План: Поквартальные коэффициенты трудозатрат

## Бизнес-логика

Вместо единого коэффициента на инициативу → коэффициент указывается **для каждого квартала отдельно**.

**Валидация:** Сумма коэффициентов всех инициатив команды **в каждом квартале** не должна превышать 100%.

---

## UX-решение

### 1. Убираем колонку "Effort %" из таблицы
Она больше не нужна — коэффициент теперь привязан к кварталам.

### 2. Добавляем Effort в QuarterCell (компактная ячейка квартала)

В сжатом виде ячейки квартала показываем коэффициент рядом с другими данными:

```text
┌────────────────────────────┐
│ ● 500K ₽  │ 25%  │  [▼]   │  ← добавили "25%" 
└────────────────────────────┘
```

### 3. Индикатор суммы в заголовке колонки квартала

В шапке таблицы под названием квартала показываем сумму по текущей команде:

```text
│  2025-Q1   │  2025-Q2   │  2025-Q3   │
│  95% ✓     │  110% ⚠    │  60%       │
├────────────┼────────────┼────────────┤
```

**Цветовая индикация:**
- **≤100%** — зелёный/обычный цвет
- **>100%** — красный + ⚠ (превышение)
- **<80%** (опционально) — серый, показывает недозагрузку

### 4. В карточке инициативы — слайдер внутри каждого квартала

Вместо общего слайдера → слайдер в блоке каждого квартала:

```text
┌─────────────────────────────────────────────────┐
│ 2025-Q1                                         │
│ ─────────────────────────────────────────────── │
│ Коэффициент трудозатрат                         │
│ ├─────────●─────────────────┤  25%              │
│ Команда TeamA в Q1: 95% из 100% ✓               │
│                                                 │
│ [Стоимость] [Доп. расходы]                      │
│ [План метрики] [Факт метрики]                   │
│ [Комментарий]                                   │
└─────────────────────────────────────────────────┘
```

---

## Техническая реализация

### 1. Модель данных

**Файл: `src/lib/adminDataManager.ts`**

Перенести `effortCoefficient` из `AdminDataRow` в `AdminQuarterData`:

```typescript
export interface AdminQuarterData {
  cost: number;
  otherCosts: number;
  support: boolean;
  onTrack: boolean;
  metricPlan: string;
  metricFact: string;
  comment: string;
  effortCoefficient: number;  // НОВОЕ: 0-100% для этого квартала
}

export interface AdminDataRow {
  // ... удалить effortCoefficient отсюда
}
```

Обновить функции:
- `parseAdminCSV` — парсить `Effort` из квартальных колонок (например `25_Q1_Effort`)
- `exportAdminCSV` — экспортировать `effortCoefficient` в квартальные колонки
- `createEmptyQuarterData` — значение по умолчанию `0`

### 2. Валидация по кварталам

```typescript
export function getTeamQuarterEffortSum(
  data: AdminDataRow[], 
  unit: string, 
  team: string, 
  quarter: string,
  excludeId?: string
): number {
  return data
    .filter(row => row.unit === unit && row.team === team && row.id !== excludeId)
    .reduce((sum, row) => sum + (row.quarterlyData[quarter]?.effortCoefficient || 0), 0);
}

export function validateTeamQuarterEffort(
  data: AdminDataRow[],
  unit: string,
  team: string,
  quarter: string
): { isValid: boolean; total: number } {
  const total = getTeamQuarterEffortSum(data, unit, team, quarter);
  return { isValid: total <= 100, total };
}
```

### 3. Обновить QuarterCell

**Файл: `src/components/admin/QuarterCell.tsx`**

- Добавить отображение `effortCoefficient` в компактном виде
- Добавить слайдер в развёрнутом виде

### 4. Обновить заголовок таблицы

**Файл: `src/components/admin/InitiativeTable.tsx`**

- Убрать колонку "Effort %"
- Добавить индикатор суммы под названием каждого квартала в `TableHead`
- Для расчёта суммы нужно знать текущий фильтр (unit/team) — передавать через пропсы

### 5. Обновить карточку инициативы

**Файл: `src/components/admin/InitiativeDetailDialog.tsx`**

- Убрать общий слайдер коэффициента
- Добавить слайдер внутрь каждого блока квартала
- Показать индикатор суммы команды для каждого квартала

---

## Изменения в файлах

| Файл | Изменения |
|------|-----------|
| `src/lib/adminDataManager.ts` | Перенести `effortCoefficient` в `AdminQuarterData`, обновить парсер/экспорт, новые функции валидации |
| `src/components/admin/QuarterCell.tsx` | + отображение Effort %, + слайдер в развёрнутом виде |
| `src/components/admin/InitiativeTable.tsx` | − колонка Effort %, + сумма в заголовках кварталов |
| `src/components/admin/InitiativeDetailDialog.tsx` | − общий слайдер, + слайдер в каждом квартале |

## Оценка
~10-12 кредитов (4 файла, средняя сложность с рефакторингом данных)

