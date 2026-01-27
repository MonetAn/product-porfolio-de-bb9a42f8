
# План: Синхронное раскрытие всех кварталов инициативы

## Что меняем

При клике на любой квартал — раскрываются ВСЕ кварталы этой инициативы одновременно.

## Почему это хорошее UX решение

- **Меньше кликов**: 1 вместо 4-5 для доступа ко всем полям
- **Визуальная консистентность**: все ячейки строки одной высоты
- **Контекст заполнения**: обычно нужны все кварталы сразу
- **Эффективность**: строка всё равно расширяется

---

## Техническая реализация

### 1. InitiativeTable.tsx — состояние раскрытых строк

**Добавить состояние:**
```typescript
const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());

const toggleRowExpanded = (id: string) => {
  setExpandedRowIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  });
};
```

**Изменить рендер QuarterCell:**
```tsx
<QuarterCell
  quarter={q}
  data={row.quarterlyData[q] || {...}}
  onChange={(field, value) => onQuarterDataChange(row.id, q, field, value)}
  isModified={modifiedIds.has(row.id)}
  expandedView={expandedView}
  teamEffort={teamEffort}
  // Новые пропсы:
  isExpanded={expandedRowIds.has(row.id)}
  onToggleExpand={() => toggleRowExpanded(row.id)}
/>
```

### 2. QuarterCell.tsx — использование внешнего состояния

**Изменить интерфейс:**
```typescript
interface QuarterCellProps {
  quarter: string;
  data: AdminQuarterData;
  onChange: (...) => void;
  isModified?: boolean;
  expandedView?: boolean;
  teamEffort?: { total: number; isValid: boolean };
  // Новые пропсы:
  isExpanded: boolean;
  onToggleExpand: () => void;
}
```

**Убрать локальное состояние и использовать пропсы:**
```typescript
// Было:
const [isOpen, setIsOpen] = useState(false);

// Станет:
// Используем isExpanded и onToggleExpand из пропсов
```

**Обновить Collapsible:**
```tsx
<Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
```

**Обновить handleCellClick:**
```typescript
const handleCellClick = (e: React.MouseEvent) => {
  const target = e.target as HTMLElement;
  if (target.closest('input, button, [role="switch"]')) return;
  onToggleExpand(); // Вместо setIsOpen(!isOpen)
};
```

**Обновить кнопку chevron:**
```tsx
<Button 
  variant="ghost" 
  size="sm" 
  className="h-6 w-6 p-0"
  onClick={(e) => {
    e.stopPropagation();
    onToggleExpand(); // Вместо setIsOpen(!isOpen)
  }}
>
  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
</Button>
```

---

## Визуальный результат

### До (текущее поведение):
```text
│ Init A │ Q1 ▼ (развернут) │ Q2 ▶ (свёрнут) │ Q3 ▶ │ Q4 ▶ │
│        │ [много полей]    │ [компактно]    │      │      │
```
↑ Визуальный дисбаланс, 4 клика для заполнения

### После:
```text
│ Init A │ Q1 ▼             │ Q2 ▼           │ Q3 ▼ │ Q4 ▼ │
│        │ [все поля]       │ [все поля]     │ ...  │ ...  │
```
↑ Консистентно, 1 клик для доступа ко всем кварталам

---

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `src/components/admin/InitiativeTable.tsx` | + состояние `expandedRowIds`, + функция `toggleRowExpanded`, передача пропсов в QuarterCell |
| `src/components/admin/QuarterCell.tsx` | − локальное состояние `isOpen`, + пропсы `isExpanded` и `onToggleExpand` |

## Оценка
~3-4 кредита (простой рефакторинг состояния)
