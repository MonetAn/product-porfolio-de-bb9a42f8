

# Фикс: Stale Props в exit-анимации тримапа

## Проблема

IIFE `exit={(() => { ... })()}` вычисляется при рендере. Exiting-узлы — снимки прошлого рендера, где `clickCenter` ещё `null`. Условие push-анимации не срабатывает.

## Решение

Заменить IIFE на `variants` с функцией `exit`, которая получает актуальный `custom` из `AnimatePresence`.

## Изменения (только `src/components/treemap/TreemapNode.tsx`)

`TreemapContainer.tsx` уже корректен: `custom={lastClickCenter}` передаётся в `AnimatePresence`.

### Заменить блок initial/animate/exit/transition (строки 145-184) на variants:

```typescript
const variants = {
  initial: animationType === 'initial'
    ? (false as const)
    : { opacity: 0, scale: 0.92, x, y, width: node.width, height: node.height },

  animate: {
    opacity: 1,
    scale: 1,
    x,
    y,
    width: node.width,
    height: node.height,
    transition: {
      duration,
      ease: [0.25, 0.1, 0.25, 1],
      scale: { duration: duration * 0.8 },
    },
  },

  // custom получается из AnimatePresence, а НЕ из пропсов
  exit: (customClickCenter: { x: number; y: number } | null) => {
    if (animationType === 'drilldown' && customClickCenter && containerDimensions && !isHero) {
      const nodeCenterX = node.x0 + node.width / 2;
      const nodeCenterY = node.y0 + node.height / 2;
      const dx = nodeCenterX - customClickCenter.x;
      const dy = nodeCenterY - customClickCenter.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = Math.max(containerDimensions.width, containerDimensions.height) * 1.5;
      return {
        x: x + (dx / distance) * force,
        y: y + (dy / distance) * force,
        opacity: 0,
        scale: 0.8,
        transition: { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] },
      };
    }
    return { opacity: 0, scale: 0.92 };
  },
};
```

### Обновить motion.div:

```tsx
<motion.div
  layoutId={node.key}
  custom={clickCenter}
  variants={variants}
  initial="initial"
  animate="animate"
  exit="exit"
  // transition убирается — она теперь внутри variants.animate
  className={classNames}
  style={{ ... }}  // без изменений
>
```

## Файлы

| Файл | Что меняется |
|---|---|
| `src/components/treemap/TreemapNode.tsx` | IIFE заменяется на variants |

