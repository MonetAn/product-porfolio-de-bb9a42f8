
# План: Унификация UX для tooltips в Timeline

## Обзор изменений

1. **Унифицировать курсор** — `cursor: pointer` для названия и сегментов
2. **Улучшить discoverability** — подчёркивание при hover для названия
3. **Убрать описание из quarter popup** — оставить только в name popup

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/styles/gantt.css` | Изменить курсор + добавить underline при hover |
| `src/components/GanttView.tsx` | Удалить секцию Description из renderQuarterPopup |

## Техническая реализация

### gantt.css

#### 1. Изменить курсор для названия (строка 92)

**Было:**
```css
.gantt-row-name {
  ...
  cursor: help;
}
```

**Станет:**
```css
.gantt-row-name {
  ...
  cursor: pointer;
}
```

#### 2. Добавить hover эффект для названия (после строки 93)

```css
.gantt-row-name:hover {
  text-decoration: underline;
  text-decoration-color: hsl(var(--primary));
  text-underline-offset: 2px;
}
```

### GanttView.tsx

#### Удалить секцию Description из renderQuarterPopup (строки 338-359)

**Было:**
```tsx
{row.description && (
  <div className="gantt-quarter-popup-section">
    <div 
      className="gantt-quarter-popup-label expandable-header"
      onClick={() => pinned && descriptionLong && toggleSection('description')}
    >
      Описание
      {pinned && descriptionLong && (
        expandedSections['description'] 
          ? <ChevronUp size={12} className="expand-icon" />
          : <ChevronDown size={12} className="expand-icon" />
      )}
    </div>
    <div 
      className={`gantt-quarter-popup-text ${!expandedSections['description'] && descriptionLong ? 'truncated' : ''}`}
    >
      {expandedSections['description'] || !descriptionLong 
        ? row.description 
        : row.description.slice(0, 150) + '…'}
    </div>
  </div>
)}
```

**Станет:** Удалить этот блок полностью.

#### Удалить неиспользуемую переменную (строка 290)

```tsx
// Удалить
const descriptionLong = row.description && row.description.length > 150;
```

## Результат

| Элемент | Курсор | Hover эффект | Содержимое popup |
|---------|--------|--------------|------------------|
| **Название** | pointer | Underline синий | Name, Unit, Costs, Description, Stakeholders |
| **Сегмент** | pointer | Brightness +10% | Quarter, Status, Budget, Plan, Fact, Comment, Stakeholders |

## Визуальная схема

```text
TIMELINE - Unified Interaction Pattern

┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  Initiative Name ←── [hover: underline, cursor: pointer]        │
│  ▼ Click                                                         │
│  ┌─────────────────────┐                                         │
│  │ Name                │ ← ЧТО это?                              │
│  │ Unit                │                                         │
│  │ Costs               │                                         │
│  │ ▾ Description       │ ← Полное описание здесь                 │
│  │ Stakeholders        │                                         │
│  └─────────────────────┘                                         │
│                                                                  │
│  [====Segment====] ←── [hover: brightness, cursor: pointer]     │
│  ▼ Click                                                         │
│  ┌─────────────────────┐                                         │
│  │ Quarter + Status    │ ← КАК идёт в этом квартале?             │
│  │ Budget              │                                         │
│  │ ▾ Plan              │ ← Только квартальные метрики            │
│  │ ▾ Fact              │                                         │
│  │ ▾ Comment           │                                         │
│  │ Stakeholders        │                                         │
│  └─────────────────────┘                                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Преимущества

- **Консистентность** — одинаковый паттерн взаимодействия
- **Discoverability** — подчёркивание явно показывает кликабельность
- **Чёткое разделение** — Name popup = общая информация, Quarter popup = прогресс
- **Меньше дублирования** — описание в одном месте
