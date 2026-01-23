
# План: Pinnable Tooltips в Timeline и упрощение Treemap Tooltip

## Обзор изменений

### 1. Timeline Name Tooltip → Pinnable с expandable описанием
- Добавить состояние для pinned name tooltip (аналогично quarter popup)
- Hover показывает: Name, Unit, Costs, Description (truncated), Stakeholders
- Click pin'ит tooltip, можно развернуть Description

### 2. Treemap Tooltip → Упрощение
- Убрать Description и Comment
- Оставить: Name, Status, Budget, %, Plan (truncated), Fact (truncated), Stakeholders

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/GanttView.tsx` | Добавить pinnable name tooltip |
| `src/components/BudgetTreemap.tsx` | Убрать Description и Comment из tooltip |
| `src/styles/gantt.css` | Стили для нового name tooltip |

## Техническая реализация

### GanttView.tsx

#### 1. Новый интерфейс для name popup (после строки 21)

```typescript
interface NamePopupData {
  row: RawDataRow;
  x: number;
  y: number;
  pinned: boolean;
}
```

#### 2. Новые состояния (после строки 64)

```typescript
const [namePopup, setNamePopup] = useState<NamePopupData | null>(null);
const [nameExpandedSections, setNameExpandedSections] = useState<Record<string, boolean>>({});
const namePopupRef = useRef<HTMLDivElement>(null);
```

#### 3. Обновить useEffect для outside click (строки 129-138)

```typescript
useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    // Close quarter popup
    if (quarterPopup?.pinned && popupRef.current && !popupRef.current.contains(e.target as Node)) {
      setQuarterPopup(null);
      setExpandedSections({});
    }
    // Close name popup
    if (namePopup?.pinned && namePopupRef.current && !namePopupRef.current.contains(e.target as Node)) {
      setNamePopup(null);
      setNameExpandedSections({});
    }
  };
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [quarterPopup, namePopup]);
```

#### 4. Новые обработчики для name tooltip (заменить строки 142-153)

```typescript
const handleNameMouseEnter = (e: React.MouseEvent, row: RawDataRow) => {
  if (namePopup?.pinned) return;
  setNamePopup({
    row,
    x: e.clientX,
    y: e.clientY,
    pinned: false
  });
};

const handleNameMouseMove = (e: React.MouseEvent) => {
  if (namePopup?.pinned) return;
  setNamePopup(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
};

const handleNameMouseLeave = () => {
  if (namePopup?.pinned) return;
  setNamePopup(null);
};

const handleNameClick = (e: React.MouseEvent, row: RawDataRow) => {
  e.stopPropagation();
  setNamePopup({
    row,
    x: e.clientX,
    y: e.clientY,
    pinned: true
  });
  setNameExpandedSections({});
};

const toggleNameSection = (section: string) => {
  setNameExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
};
```

#### 5. Новая функция renderNamePopup (после renderQuarterPopup)

```typescript
const renderNamePopup = () => {
  if (!namePopup) return null;

  const { row, x, y, pinned } = namePopup;
  const totalCost = calculateTotalBudget(row);
  const periodCost = calculateBudget(row, selectedQuarters);
  const allQuarters = getInitiativeQuarters(row);
  const showPeriodCost = selectedQuarters.length < allQuarters.length && periodCost !== totalCost;
  const descriptionLong = row.description && row.description.length > 150;

  // Position calculation
  const padding = 16;
  let posX = x + padding;
  let posY = y + padding;

  if (typeof window !== 'undefined') {
    if (posX + 360 > window.innerWidth - padding) {
      posX = x - 360 - padding;
    }
    if (posY + 300 > window.innerHeight - padding) {
      posY = Math.max(padding, window.innerHeight - 400 - padding);
    }
  }

  return (
    <div
      ref={namePopupRef}
      className={`gantt-name-popup ${pinned ? 'pinned' : ''}`}
      style={{
        left: posX,
        top: posY,
        pointerEvents: pinned ? 'auto' : 'none'
      }}
    >
      <div className="gantt-name-popup-title">{row.initiative}</div>
      
      <div className="gantt-name-popup-unit">{row.unit}</div>

      <div className="gantt-name-popup-costs">
        <span>Всего: {formatBudget(totalCost)}</span>
        {showPeriodCost && (
          <span className="period-cost">За период: {formatBudget(periodCost)}</span>
        )}
      </div>

      {row.description && (
        <div className="gantt-name-popup-section">
          <div 
            className="gantt-name-popup-label expandable-header"
            onClick={() => pinned && descriptionLong && toggleNameSection('description')}
          >
            Описание
            {pinned && descriptionLong && (
              nameExpandedSections['description'] 
                ? <ChevronUp size={12} className="expand-icon" />
                : <ChevronDown size={12} className="expand-icon" />
            )}
          </div>
          <div 
            className={`gantt-name-popup-text ${!nameExpandedSections['description'] && descriptionLong ? 'truncated' : ''}`}
          >
            {nameExpandedSections['description'] || !descriptionLong 
              ? row.description 
              : row.description.slice(0, 150) + '…'}
          </div>
        </div>
      )}

      {row.stakeholders && (
        <div className="gantt-name-popup-section">
          <div className="gantt-name-popup-label">Стейкхолдеры</div>
          <div className="gantt-name-popup-stakeholders">
            <span className="gantt-name-popup-tag">{row.stakeholders}</span>
          </div>
        </div>
      )}

      {!pinned && (
        <div className="gantt-name-popup-hint">
          Кликните для детального просмотра
        </div>
      )}
    </div>
  );
};
```

#### 6. Обновить обработчики в JSX (строки 439-446)

```tsx
<div 
  className="gantt-row-name"
  onMouseEnter={(e) => handleNameMouseEnter(e, row)}
  onMouseMove={handleNameMouseMove}
  onMouseLeave={handleNameMouseLeave}
  onClick={(e) => handleNameClick(e, row)}
>
  {row.initiative}
</div>
```

#### 7. Заменить старый tooltip на новый popup (строки 529-545)

Удалить старый блок с `gantt-name-tooltip` и добавить:

```tsx
{renderNamePopup()}
```

### BudgetTreemap.tsx

#### Убрать Description и Comment, обрезать Plan/Fact (строки 184-210)

Заменить на:

```typescript
// Plan/Fact for initiatives - truncated, last quarter
if (isInitiative && nodeData.quarterlyData && lastQuarter) {
  const qData = nodeData.quarterlyData[lastQuarter];
  if (qData && (qData.metricPlan || qData.metricFact)) {
    const [year, quarter] = lastQuarter.split('-');
    const qLabel = `${quarter} ${year}`;
    html += `<div class="tooltip-metrics">`;
    if (qData.metricPlan) {
      const truncatedPlan = qData.metricPlan.length > 100 
        ? qData.metricPlan.slice(0, 100) + '…' 
        : qData.metricPlan;
      html += `<div class="tooltip-metric"><span class="tooltip-metric-label">План (${qLabel})</span><span class="tooltip-metric-value">${escapeHtml(truncatedPlan)}</span></div>`;
    }
    if (qData.metricFact) {
      const truncatedFact = qData.metricFact.length > 100 
        ? qData.metricFact.slice(0, 100) + '…' 
        : qData.metricFact;
      html += `<div class="tooltip-metric"><span class="tooltip-metric-label">Факт (${qLabel})</span><span class="tooltip-metric-value">${escapeHtml(truncatedFact)}</span></div>`;
    }
    html += `</div>`;
  }
  // Comment removed
}
// Description removed
```

### gantt.css

#### Новые стили для name popup (добавить в конец файла)

```css
/* Name Popup - Pinnable */
.gantt-name-popup {
  position: fixed;
  z-index: 200;
  background: hsl(var(--popover));
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  max-width: 360px;
  max-height: 400px;
  overflow-y: auto;
}

.gantt-name-popup.pinned {
  pointer-events: auto;
}

.gantt-name-popup-title {
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground));
  margin-bottom: 4px;
}

.gantt-name-popup-unit {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  margin-bottom: 12px;
}

.gantt-name-popup-costs {
  display: flex;
  gap: 12px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: hsl(var(--secondary));
  border-radius: 6px;
}

.gantt-name-popup-costs .period-cost {
  color: hsl(var(--primary));
}

.gantt-name-popup-section {
  margin-bottom: 12px;
}

.gantt-name-popup-section:last-child {
  margin-bottom: 0;
}

.gantt-name-popup-label {
  font-size: 11px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.gantt-name-popup-label.expandable-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.gantt-name-popup.pinned .gantt-name-popup-label.expandable-header {
  cursor: pointer;
}

.gantt-name-popup.pinned .gantt-name-popup-label.expandable-header:hover {
  color: hsl(var(--primary));
}

.gantt-name-popup-label .expand-icon {
  opacity: 0.7;
  transition: transform 0.2s ease, opacity 0.15s ease;
}

.gantt-name-popup.pinned .gantt-name-popup-label:hover .expand-icon {
  opacity: 1;
}

.gantt-name-popup-text {
  font-size: 12px;
  color: hsl(var(--foreground));
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.gantt-name-popup-text.truncated {
  max-height: 60px;
  overflow: hidden;
  position: relative;
}

.gantt-name-popup-text.truncated::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 24px;
  background: linear-gradient(to bottom, transparent, hsl(var(--popover)));
  pointer-events: none;
}

.gantt-name-popup-stakeholders {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.gantt-name-popup-tag {
  font-size: 11px;
  padding: 3px 8px;
  background: hsl(var(--secondary));
  border-radius: 4px;
  color: hsl(var(--foreground));
}

.gantt-name-popup-hint {
  font-size: 10px;
  color: hsl(var(--muted-foreground));
  margin-top: 8px;
  text-align: center;
}
```

## Результат

| Элемент | Hover | Click (Pinned) |
|---------|-------|----------------|
| **Timeline Name** | Name, Unit, Costs, Description (150 симв.), Stakeholders, Hint | Развернуть Description |
| **Timeline Segment** | Без изменений (квартальные данные) | Развернуть Plan/Fact/Comment |
| **Treemap Node** | Name, Status, Budget, %, Plan (100 симв.), Fact (100 симв.), Stakeholders | N/A (не pinnable) |

## Схема взаимодействия

```text
TIMELINE VIEW
┌─────────────────────────────────────────────────────────────────────┐
│  Initiative Name                     │ [====Segment====]            │
│  Unit › Team                         │                              │
│  Costs: 15.2M / 8.1M                 │                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Hover на Name]              [Hover на Segment]                    │
│       ↓                              ↓                              │
│  ┌─────────────────┐          ┌─────────────────┐                   │
│  │ Initiative      │          │ Initiative      │                   │
│  │ Unit: Юнит X    │          │ Q1 2024         │                   │
│  │ Costs: 15.2M    │          │ Development     │                   │
│  │ Description...  │          │ Budget: 2.5M    │                   │
│  │ [Stakeholders]  │          │ Plan: ...       │                   │
│  │ Click to pin    │          │ Fact: ...       │                   │
│  └─────────────────┘          │ Click to pin    │                   │
│                               └─────────────────┘                   │
│       ↓ Click                        ↓ Click                        │
│  ┌─────────────────┐          ┌─────────────────┐                   │
│  │ [PINNED]        │          │ [PINNED]        │                   │
│  │ ▾ Description   │          │ ▾ Plan          │                   │
│  │   Full text...  │          │   Full text...  │                   │
│  │   with scroll   │          │ ▾ Fact          │                   │
│  └─────────────────┘          │ ▾ Comment       │                   │
│                               └─────────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
```
