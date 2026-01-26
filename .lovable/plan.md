
# План: Упрощённый UX для Effort %

## Что меняем

1. **Убираем Slider** — заменяем на простой `<input type="number">`
2. **Кликабельная вся ячейка** — раскрытие по клику на любую область
3. **Inline-редактирование badge** — клик на процент в компактном виде открывает input

## Техническая реализация

### Файл: `src/components/admin/QuarterCell.tsx`

**1. Добавить состояние для inline-редактирования:**
```typescript
const [isEditingEffort, setIsEditingEffort] = useState(false);
const [effortInputValue, setEffortInputValue] = useState('');
```

**2. Сделать ячейку кликабельной:**
- Добавить `onClick={() => setIsOpen(!isOpen)}` на внешний div
- Добавить `cursor-pointer` и `hover:bg-muted/30`

**3. Badge → кликабельный с inline edit:**
```tsx
{isEditingEffort ? (
  <Input
    type="number"
    value={effortInputValue}
    onChange={...}
    onBlur={...} // сохранить и закрыть
    onKeyDown={...} // Enter = сохранить
    className="w-14 h-6 text-xs"
    autoFocus
    onClick={(e) => e.stopPropagation()} // не раскрывать ячейку
  />
) : (
  <Badge 
    onClick={(e) => {
      e.stopPropagation();
      setEffortInputValue(String(effortValue));
      setIsEditingEffort(true);
    }}
    className="cursor-pointer hover:bg-primary/80"
  >
    {effortValue}%
  </Badge>
)}
```

**4. Заменить Slider на Input в развёрнутом виде:**
```tsx
<div className="flex items-center gap-2">
  <Input
    type="number"
    value={effortValue || ''}
    onChange={(e) => onChange('effortCoefficient', parseInt(e.target.value) || 0)}
    onClick={(e) => e.stopPropagation()}
    min={0}
    max={100}
    className="w-20 h-8"
  />
  <span className="text-xs text-muted-foreground">%</span>
</div>
```

### Файл: `src/components/admin/InitiativeDetailDialog.tsx`

**Заменить Slider на Input** в каждой секции квартала (аналогично QuarterCell)

## Визуальный результат

### Компактный вид
```
┌─────────────────────────────────────┐
│ ● 500K ₽   [25%]←клик   S    ▼     │  ← вся область кликабельна
└─────────────────────────────────────┘
```

### Развёрнутый вид
```
┌─────────────────────────────────────┐
│ Коэфф. трудозатрат:                 │
│ [  25  ] %                          │  ← простой input
│ Всего: 85% ✓                        │
│ ...                                 │
└─────────────────────────────────────┘
```

## Файлы

| Файл | Изменения |
|------|-----------|
| `src/components/admin/QuarterCell.tsx` | + inline edit badge, + кликабельная область, − slider → input |
| `src/components/admin/InitiativeDetailDialog.tsx` | − slider → input |

## Оценка
~4-5 кредитов (2 файла, простые изменения)
