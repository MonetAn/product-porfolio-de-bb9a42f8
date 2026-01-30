
# План: Фиксы фильтрации и наследование коэффициентов

## Проблема 1: Выбор команды без юнита

### Текущее поведение
При выборе только команды (без юнита) → ничего не отображается, потому что:
```typescript
// AdminPeople.tsx, строка 51
if (selectedUnits.length === 0) return [];
```

### Решение
При выборе команды — автоматически определять и выбирать юнит, к которому относится эта команда.

**Изменения в `ScopeSelector.tsx`:**

```typescript
const toggleTeam = (t: string) => {
  if (selectedTeams.includes(t)) {
    // Убираем команду
    onTeamsChange(selectedTeams.filter(x => x !== t));
  } else {
    // Добавляем команду
    const newTeams = [...selectedTeams, t];
    
    // Находим юнит этой команды
    const teamUnit = allData.find(r => r.team === t)?.unit;
    
    // Если юнит не выбран — добавляем его
    if (teamUnit && !selectedUnits.includes(teamUnit)) {
      const newUnits = [...selectedUnits, teamUnit];
      if (onFiltersChange) {
        onFiltersChange(newUnits, newTeams);
      } else {
        onUnitsChange(newUnits);
        onTeamsChange(newTeams);
      }
    } else {
      onTeamsChange(newTeams);
    }
  }
};
```

---

## Проблема 2: Коэффициенты из инициатив не отображаются

### Текущее поведение
- Виртуальные assignments создаются с `quarterly_effort: {}`
- EffortInput показывает "—" (нет значения)
- Коэффициент из инициативы (`effortCoefficient`) не используется

### Бизнес-логика
1. Если нет сохранённого значения → показывать значение из инициативы (как "авто")
2. Если есть сохранённое значение (вручную) → показывать его + ненавязчиво показать исходное значение

### Решение

**1. Передавать expected effort из инициативы в компоненты:**

```text
┌─────────────────────────────────────────────────────────────┐
│ PeopleAssignmentsTable                                       │
│   └─ При создании VirtualAssignment добавить поле:           │
│        expectedEffort: Record<string, number>                │
│                                                              │
│   └─ expectedEffort берётся из initiative.quarterlyData[q]   │
│        .effortCoefficient                                    │
└─────────────────────────────────────────────────────────────┘
```

**2. Изменить интерфейс VirtualAssignment:**

```typescript
// peopleDataManager.ts
export interface VirtualAssignment {
  id: string | null;
  person_id: string;
  initiative_id: string;
  quarterly_effort: Record<string, number>;
  expected_effort?: Record<string, number>; // NEW: коэффициент из инициативы
  is_auto: boolean;
  isVirtual: boolean;
}
```

**3. Заполнять expected_effort при создании виртуальных assignments:**

```typescript
// PeopleAssignmentsTable.tsx - generateVirtualAssignments
return teamInitiatives.map(initiative => {
  const key = `${person.id}:${initiative.id}`;
  const existing = assignmentMap.get(key);
  
  // Собираем expected effort из инициативы
  const expectedEffort: Record<string, number> = {};
  quarters.forEach(q => {
    const qData = initiative.quarterlyData[q];
    if (qData?.effortCoefficient > 0) {
      expectedEffort[q] = qData.effortCoefficient;
    }
  });
  
  if (existing) {
    return {
      ...existing,
      expected_effort: expectedEffort,
      isVirtual: false
    };
  }
  
  return {
    id: null,
    person_id: person.id,
    initiative_id: initiative.id,
    quarterly_effort: {},
    expected_effort: expectedEffort,
    is_auto: true,
    isVirtual: true
  };
});
```

**4. Обновить EffortInput для отображения обоих значений:**

Добавить prop `expectedValue` и показывать его ненавязчиво:

```typescript
interface EffortInputProps {
  value: number;
  expectedValue?: number; // NEW: значение из инициативы
  isAuto: boolean;
  isVirtual?: boolean;
  onChange: (value: number) => void;
}
```

**UI логика:**

```text
Случай 1: Нет сохранённого значения, есть expected
┌──────────────┐
│   35%        │  ← показываем expected как "авто"
│  (серый)     │    подсказка: "Из инициативы"
└──────────────┘

Случай 2: Сохранённое значение отличается от expected
┌──────────────────┐
│  50% ✎ (25%)    │  ← основное — вручную, в скобках — исходное
│                  │    стиль: 25% приглушённый, мелкий
└──────────────────┘

Случай 3: Нет сохранённого, нет expected
┌──────────────┐
│     —        │  ← пунктирная рамка (как сейчас)
└──────────────┘

Случай 4: Сохранённое = expected
┌──────────────┐
│   35%        │  ← как авто, но без подсветки "вручную"
└──────────────┘
```

---

## Файлы для изменения

### 1. `src/lib/peopleDataManager.ts`
- Добавить `expected_effort?: Record<string, number>` в `VirtualAssignment`

### 2. `src/components/admin/ScopeSelector.tsx`
- В `toggleTeam()` добавить автоматический выбор юнита

### 3. `src/components/admin/people/PeopleAssignmentsTable.tsx`
- В `generateVirtualAssignments` заполнять `expected_effort` из инициативы
- Аналогично в `byInitiative` computed

### 4. `src/components/admin/people/EffortInput.tsx`
- Добавить prop `expectedValue`
- Обновить логику отображения:
  - Если `value === 0` и `expectedValue > 0` → показывать expected
  - Если `value !== expectedValue` и оба > 0 → показывать "(expected)" рядом

### 5. `src/components/admin/people/PersonGroupRow.tsx`
- Передавать `expectedValue` в EffortInput

### 6. `src/components/admin/people/InitiativeGroupRow.tsx`  
- Передавать `expectedValue` в EffortInput

---

## Визуальный результат

**До (текущее):**
```
Инициатива X     Q1       Q2       Q3
├─ Иванов       [—]      [—]      [—]
├─ Петров       [—]      [—]      [—]
```

**После:**
```
Инициатива X     Q1       Q2       Q3
├─ Иванов       [35%]    [35%]    [—]     ← из инициативы (серые)
├─ Петров       [50% ✎ (35%)]  [—]  [—]   ← 50% вручную, 35% было
```

При наведении tooltip объяснит:
- "35%" (серый) → "Значение из инициативы"
- "50% (35%)" → "Изменено вручную, исходное: 35%"
