
# План: Smart positioning для Timeline tooltips

## Проблема

При hover на правой части экрана tooltip "прыгает" слишком далеко влево (на ~376px от курсора), создавая визуально неприятный разрыв.

## Решение

Применить ту же логику **flip + clamp**, которую мы уже реализовали для Treemap tooltips. Это обеспечит:
- Tooltip всегда близко к курсору
- Никогда не выходит за границы viewport
- Консистентное поведение во всём приложении

## Файл для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/GanttView.tsx` | Обновить позиционирование для quarterPopup и namePopup |

## Техническая реализация

### Обновить позиционирование в renderQuarterPopup (строки 294-307)

**Было:**
```typescript
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
```

**Станет:**
```typescript
const padding = 16;
const tooltipWidth = 360;
const tooltipHeight = 400;

// Start with position to the right and below cursor
let posX = x + padding;
let posY = y + padding;

if (typeof window !== 'undefined') {
  // Flip horizontally if overflows right edge
  if (posX + tooltipWidth > window.innerWidth - padding) {
    posX = x - tooltipWidth - padding;
  }
  // Clamp to left edge if still overflows
  if (posX < padding) {
    posX = padding;
  }

  // Flip vertically if overflows bottom edge
  if (posY + tooltipHeight > window.innerHeight - padding) {
    posY = y - tooltipHeight - padding;
  }
  // Clamp to top edge if still overflows
  if (posY < padding) {
    posY = padding;
  }
}
```

### Аналогично обновить позиционирование в renderNamePopup (строки 434-446)

Та же логика flip + clamp.

## Визуальное сравнение

```text
БЫЛО (проблема):
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│  ┌─────────────┐                                     cursor ●          │
│  │  Tooltip    │←─────── 376px разрыв ──────────────→│                 │
│  │             │                                                       │
│  └─────────────┘                                                       │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

СТАНЕТ (flip + clamp):
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                                        ┌─────────────┐ cursor ●        │
│                                        │  Tooltip    │←─ 16px          │
│                                        │             │                 │
│                                        └─────────────┘                 │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

## Преимущества

- **Консистентность** — одинаковая логика в Treemap и Timeline
- **Близость** — tooltip всегда рядом с курсором (max 16px gap)
- **Надёжность** — clamp гарантирует, что tooltip никогда не выйдет за экран
- **Простота** — переиспользуем проверенный паттерн
