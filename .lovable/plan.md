

# Исправление интерфейса страницы "Люди"

## Проблемы на скриншоте

1. **Не скроллится страница** — контент обрезается внизу, нет возможности пролистать
2. **Кварталы не выровнены** — заголовки кварталов (25 Q1, 25 Q2...) не совпадают с ячейками значений в строках
3. **"12 привязок" — лишняя метрика** — теперь показываем все возможные комбинации, поэтому счётчик привязок не несёт смысла
4. **Шаг стрелок в input = 1%** — слишком мелкий шаг, нужно 5% или 10%

---

## Решение

### 1. Исправить скролл

Проблема в CSS-структуре:
- `AdminPeople.tsx` использует `flex-col` и `overflow-hidden`
- `PeopleAssignmentsTable.tsx` использует `ScrollArea` внутри `flex-1`

Но высота не ограничена правильно. Нужно:
- Добавить `h-screen` и правильные `overflow` на контейнеры
- Убедиться что `ScrollArea` получает ограниченную высоту

### 2. Выровнять кварталы с ячейками

Сейчас:
- Заголовки кварталов: `flex gap-2` с `w-[50px]`
- Ячейки в строках: `flex gap-2` с `min-w-[50px]` или `min-w-[60px]`

Проблема — разная ширина и несогласованные gap/padding. Решение:
- Использовать **фиксированную табличную структуру** с CSS Grid
- Левая колонка (имя/инициатива) — `flex-1`
- Правая часть (кварталы) — фиксированная ширина на каждый квартал

```text
| Имя человека / Инициатива      | 25Q1 | 25Q2 | 25Q3 | 25Q4 | 26Q1 | ... |
|--------------------------------|------|------|------|------|------|-----|
| ↳ Инициатива 1                 | 40%  | 26%  | 69%  | —    | —    | ... |
```

### 3. Убрать "привязок" из статистики

Заменить на что-то более полезное или убрать совсем:

```text
Было:    3 чел. • 7 инициатив • 12 привязок
Станет:  3 чел. • 7 инициатив
```

### 4. Шаг input = 5%

Добавить `step={5}` к input полям:

```tsx
<Input
  type="number"
  min={0}
  max={100}
  step={5}  // Добавить
  ...
/>
```

Это касается:
- `EffortInput.tsx` — страница Люди
- `QuarterCell.tsx` — админка инициатив

---

## Техническая реализация

### Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `AdminPeople.tsx` | Исправить структуру flex/overflow для скролла, убрать "привязок" |
| `PeopleAssignmentsTable.tsx` | Переделать на CSS Grid с фиксированными колонками для кварталов |
| `PersonGroupRow.tsx` | Адаптировать под grid-структуру, фиксированная ширина ячеек |
| `InitiativeGroupRow.tsx` | Адаптировать под grid-структуру |
| `EffortInput.tsx` | Добавить `step={5}` |
| `QuarterCell.tsx` | Добавить `step={5}` к input |

### Шаг 1: Grid-структура для таблицы

```tsx
// PeopleAssignmentsTable.tsx

// Динамическое создание grid-template-columns
const gridCols = `minmax(300px, 1fr) repeat(${displayQuarters.length}, 70px) 90px`;

return (
  <div className="flex flex-col h-full overflow-hidden">
    {/* Header row */}
    <div 
      className="grid items-center px-4 py-3 bg-muted/50 border-b sticky top-0 z-10"
      style={{ gridTemplateColumns: gridCols }}
    >
      <ToggleGroup>...</ToggleGroup>
      
      {displayQuarters.map(q => (
        <div key={q} className="text-xs font-medium text-center">
          {q.replace('20', '').replace('-', ' ')}
        </div>
      ))}
      
      <div>{/* Placeholder for badge column */}</div>
    </div>

    {/* Scrollable content */}
    <div className="flex-1 overflow-y-auto">
      {byPerson.map(...)}
    </div>
  </div>
);
```

### Шаг 2: Строки с такой же grid-структурой

```tsx
// PersonGroupRow.tsx

<div 
  className="grid items-center px-4 py-3 cursor-pointer hover:bg-muted/50"
  style={{ gridTemplateColumns: gridCols }}
>
  {/* Имя человека */}
  <div className="flex items-center gap-3">
    <ChevronDown />
    <div>
      <span className="font-medium">{person.full_name}</span>
      <div className="text-xs text-muted-foreground">{person.team}</div>
    </div>
  </div>
  
  {/* Кварталы — каждый в своей ячейке grid */}
  {quarters.map(q => (
    <div key={q} className="text-center">
      {quarterTotals[q]}%
    </div>
  ))}
  
  {/* Badge */}
  <Badge>7 инициатив</Badge>
</div>
```

### Шаг 3: Передача gridCols через props или context

Чтобы все строки использовали одинаковую структуру:

```tsx
// Вариант 1: props
<PersonGroupRow gridCols={gridCols} ... />

// Вариант 2: CSS-переменная
<div style={{ '--grid-cols': gridCols } as React.CSSProperties}>
  ...
</div>
```

### Шаг 4: Исправить скролл в AdminPeople

```tsx
// AdminPeople.tsx

<div className="h-screen bg-background flex flex-col overflow-hidden">
  {/* Header - fixed */}
  <header className="h-14 shrink-0 ...">...</header>

  {/* Scope Selector - fixed */}
  <div className="shrink-0">
    <ScopeSelector ... />
  </div>

  {/* Main Content - scrollable */}
  <main className="flex-1 overflow-hidden">
    <PeopleAssignmentsTable ... />
  </main>
</div>
```

### Шаг 5: Step=5 для input

```tsx
// EffortInput.tsx, строка 67-77
<Input
  type="number"
  min={0}
  max={100}
  step={5}  // ДОБАВИТЬ
  ...
/>

// QuarterCell.tsx, строки 89-103 и 162-170
<Input
  type="number"
  min={0}
  max={100}
  step={5}  // ДОБАВИТЬ
  ...
/>
```

---

## Визуальный результат

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Админка  👥 Люди  3 чел. • 7 инициатив                 [Импорт] [Экспорт] │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Client Platform ▾] [Auth&Security ▾]  1 юнит  │ [Инициативы] [👥 Люди]    │
├─────────────────────────────────────────────────────────────────────────────┤
│ [👥 По людям] [📋 По инициативам]    25Q1  25Q2  25Q3  25Q4  26Q1  26Q2  .. │
├─────────────────────────────────────────────────────────────────────────────┤
│ ▼ Завгородний Артём Вадимович         40%   26%   69%   77%   40%   8%  .. │ ← ВЫРОВНЕНО
│   Auth&Security                                                             │
│ ────────────────────────────────────────────────────────────────────────────│
│   Анализ уязвимостей                  40%   2%    69%   77%   40%   8%  .. │ ← ВЫРОВНЕНО
│   Auth&Security                                                             │
│ ────────────────────────────────────────────────────────────────────────────│
│   Антифрод                            —     7%    —     —     —     —   .. │
│   ...                                                                       │
│                                    ↕ СКРОЛЛИТСЯ                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Порядок реализации

1. `EffortInput.tsx` — добавить `step={5}`
2. `QuarterCell.tsx` — добавить `step={5}` ко всем input
3. `AdminPeople.tsx` — исправить структуру для скролла, убрать "привязок"
4. `PeopleAssignmentsTable.tsx` — переделать на CSS Grid
5. `PersonGroupRow.tsx` — адаптировать под grid
6. `InitiativeGroupRow.tsx` — адаптировать под grid

