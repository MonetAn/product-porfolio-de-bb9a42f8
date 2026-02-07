

# Обновление таймингов анимаций тримапа

Замедляем анимации drill-down и zoom-out для более плавного, Flourish-подобного восприятия.

## Изменения

### 1. `src/components/treemap/types.ts` -- новые длительности

| Параметр | Было | Стало |
|---|---|---|
| drilldown | 800ms | **1100ms** |
| navigate-up | 650ms | **900ms** |
| filter | 650ms | **750ms** |
| resize | 420ms | 420ms (без изменений) |

### 2. `src/components/treemap/TreemapNode.tsx` -- новая easing-кривая и exit duration

- Easing: `[0.25, 0.1, 0.25, 1]` → **`[0.4, 0, 0.2, 1]`**
- Exit transition duration: `0.3` → **`0.4`**

### 3. `src/components/treemap/TreemapContainer.tsx` -- увеличить guard timeout

- `isAnimatingRef` timeout: `700ms` → **`1150ms`**

