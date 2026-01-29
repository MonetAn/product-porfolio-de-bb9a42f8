

# План: Перенос статистики Support/Development наверх

## Текущее состояние

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Header                                                                   │
├──────────────────────────────────────────────────────────────────────────┤
│ FilterBar (фильтры, период, toggles)                                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                         Timeline (GanttView)                             │
│                                                                          │
│                      ... много строк инициатив ...                       │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ Легенда: [■ Development] [■ Support] [⊘ Off-track]                      │
│ Итого: 66.5 млн ₽ • Development: 45.2 млн ₽ (68%) • Support: 21.3 (32%) │
└──────────────────────────────────────────────────────────────────────────┘
```

## Целевое состояние (Вариант А)

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Header                                                                   │
├──────────────────────────────────────────────────────────────────────────┤
│ FilterBar (фильтры, период, toggles)                                     │
├──────────────────────────────────────────────────────────────────────────┤
│ Статистика:  Итого: 66.5 млн ₽                                          │
│              Development: 45.2 млн ₽ (68%)  Support: 21.3 млн ₽ (32%)   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                         Timeline (GanttView)                             │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ Легенда: [■ Development] [■ Support] [⊘ Off-track]    ← только цвета    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Подход к реализации

### Два варианта архитектуры:

**А1. Статистика внутри GanttView (но сверху)**
- Добавить блок статистики между хедером таблицы и строками
- Проще реализовать, не требует изменения Index.tsx
- Минус: визуально "внутри" Timeline

**А2. Вынести статистику в Index.tsx (между FilterBar и GanttView)**
- Чистое разделение: общая сводка отдельно от таблицы
- GanttView возвращает расчёты через callback или выносим расчёт в Index
- Минус: небольшой рефакторинг

### Рекомендация: Вариант А1

Проще и быстрее — добавляем статистику прямо под хедером Timeline, но над списком инициатив. Визуально это будет выглядеть как часть интерфейса Timeline, но читаться сразу при открытии.

---

## Техническая реализация

### Изменения в GanttView.tsx

**1. Добавить блок статистики после хедера (перед gantt-rows)**

Вставить после строки ~612 (после закрывающего `</div>` хедера):

```tsx
{/* Budget Statistics - показываем под хедером */}
<div className="gantt-stats-bar">
  <div className="gantt-stats-total">
    Итого за период: <strong>{formatBudget(grandTotal)}</strong>
  </div>
  <div className="gantt-stats-breakdown">
    <span className="gantt-stats-development">
      <span className="gantt-stats-dot development" />
      Development: {formatBudget(developmentTotal)} ({100 - supportPercent}%)
    </span>
    <span className="gantt-stats-support">
      <span className="gantt-stats-dot support" />
      Support: {formatBudget(supportTotal)} ({supportPercent}%)
    </span>
  </div>
</div>
```

**2. Упростить легенду внизу — убрать статистику**

Оставить только цветовые индикаторы:

```tsx
<div className="gantt-legend">
  <div className="gantt-legend-item">
    <div className="gantt-legend-color development"></div>
    <span>Development</span>
  </div>
  <div className="gantt-legend-item">
    <div className="gantt-legend-color support"></div>
    <span>Support</span>
  </div>
  <div className="gantt-legend-item">
    <div className="gantt-legend-color hatched"></div>
    <span>Off-track</span>
  </div>
</div>
```

---

### Новые стили в gantt.css

```css
/* Statistics Bar - под хедером */
.gantt-stats-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: hsl(var(--secondary));
  border-bottom: 1px solid hsl(var(--border));
  flex-shrink: 0;
}

.gantt-stats-total {
  font-size: 13px;
  color: hsl(var(--foreground));
}

.gantt-stats-total strong {
  font-weight: 600;
}

.gantt-stats-breakdown {
  display: flex;
  gap: 20px;
  font-size: 13px;
}

.gantt-stats-development {
  display: flex;
  align-items: center;
  gap: 6px;
  color: hsl(var(--development));
  font-weight: 500;
}

.gantt-stats-support {
  display: flex;
  align-items: center;
  gap: 6px;
  color: hsl(var(--support-color));
  font-weight: 500;
}

.gantt-stats-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.gantt-stats-dot.development {
  background: hsl(var(--development));
}

.gantt-stats-dot.support {
  background: hsl(var(--support-color));
}
```

---

## Визуальный результат

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Инициатива                    │  Q1 2024  │  Q2 2024  │  Q3 2024  │ ...  │
├──────────────────────────────────────────────────────────────────────────┤
│ Итого за период: 66.5 млн ₽   │  ■ Development: 45.2 млн ₽ (68%)         │
│                               │  ■ Support: 21.3 млн ₽ (32%)             │
├──────────────────────────────────────────────────────────────────────────┤
│ Project Alpha                 │ ████████████████                         │
│ FAP • База Знаний             │                                          │
├──────────────────────────────────────────────────────────────────────────┤
│ Project Beta                  │      ████████████████████████            │
│ DTIP • Core Team              │                                          │
└──────────────────────────────────────────────────────────────────────────┘
...
┌──────────────────────────────────────────────────────────────────────────┐
│ [■ Development]  [■ Support]  [⊘ Off-track]         ← только легенда     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Преимущества

| Аспект | Было (внизу) | Станет (сверху) |
|--------|--------------|-----------------|
| Видимость | Надо скроллить вниз | Сразу видно |
| Связь с фильтрами | Далеко | Рядом — причина-следствие |
| Легенда | Перегружена | Только цвета |
| Фокус внимания | Размыт | Сначала итог, потом детали |

---

## Порядок изменения файлов

1. `src/styles/gantt.css` — добавить стили для .gantt-stats-bar
2. `src/components/GanttView.tsx`:
   - Добавить блок статистики после хедера
   - Убрать статистику из легенды внизу

