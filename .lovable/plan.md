

# Увеличение длительности zoom-in анимации

Увеличиваем только drilldown с 1100мс до 1400мс для более плавного отслеживания пространственного перехода. Остальные анимации без изменений.

## Изменения

### 1. `src/components/treemap/types.ts`

| Параметр | Было | Стало |
|---|---|---|
| drilldown | 1100ms | **1400ms** |
| navigate-up | 900ms | без изменений |
| filter | 750ms | без изменений |

### 2. `src/components/treemap/TreemapContainer.tsx`

Guard timeout (`isAnimatingRef`): 1150ms -> **1450ms**

