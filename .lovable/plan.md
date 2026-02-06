

# План: Сделать клик на описание раскрывающим его

## Текущее состояние

Сейчас для раскрытия описания нужно кликнуть на маленький заголовок "Описание" с иконкой ▼. Это неудобно:
- Мелкая область для клика
- Неочевидно, что заголовок кликабельный
- Пользователь интуитивно хочет кликнуть на сам текст с "…"

## Предлагаемое решение

Сделать **весь блок описания** кликабельным:
- Клик на заголовок "Описание" → раскрывает
- Клик на сам текст → раскрывает  
- Hover на обрезанный текст → cursor: pointer + лёгкий эффект

## Изменения

### 1. `src/components/GanttView.tsx`

**Переместить onClick с заголовка на весь блок:**

```tsx
// Было: onClick только на заголовке
<div className="gantt-name-popup-label expandable-header"
     onClick={() => pinned && descriptionLong && toggleNameSection('description')}>
  Описание
  ...
</div>
<div className="gantt-name-popup-text ...">
  {текст}
</div>

// Станет: onClick на весь section
<div 
  className={`gantt-name-popup-section ${pinned && descriptionLong ? 'clickable' : ''}`}
  onClick={() => pinned && descriptionLong && toggleNameSection('description')}
>
  <div className="gantt-name-popup-label expandable-header">
    Описание
    {иконка}
  </div>
  <div className="gantt-name-popup-text ...">
    {текст}
  </div>
</div>
```

### 2. `src/styles/gantt.css`

**Добавить стили для кликабельного блока:**

```css
.gantt-name-popup-section.clickable {
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-radius: 6px;
  margin: -4px;
  padding: 4px;
}

.gantt-name-popup-section.clickable:hover {
  background-color: rgba(255, 255, 255, 0.05);
}
```

## Результат

| До | После |
|----|-------|
| Кликабелен только заголовок | Кликабелен весь блок описания |
| Нет visual feedback | Hover-эффект + cursor: pointer |
| Надо целиться в мелкую область | Большая область = быстрый клик |

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/GanttView.tsx` | Переместить onClick на section, добавить класс `clickable` |
| `src/styles/gantt.css` | Добавить стили для `.gantt-name-popup-section.clickable` |

## Оценка

| Метрика | Значение |
|---------|----------|
| Сложность | Минимальная |
| Файлов | 2 |
| Риск регрессии | Нулевой |

