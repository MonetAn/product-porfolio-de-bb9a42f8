

# Подход Flourish: анимация перерасчёта layout без смены данных

## Почему текущий CSS Zoom не работает как Flourish

Текущая архитектура имеет два раздельных этапа:
1. CSS zoom приближает камеру к блоку
2. React заменяет данные, все компоненты перемонтируются

Flourish работает иначе: он **не перемонтирует компоненты**. Он пересчитывает D3 layout для новой области и анимирует каждый прямоугольник от старой позиции/размера к новой.

## Новый подход: Single-pass layout transition

Вместо zoom + remount, делаем один переход:

1. Клик на узел Unit
2. D3 пересчитывает layout: **те же данные**, но размеры контейнера = размерам кликнутого узла (расширенным до полного viewport)
3. Framer Motion анимирует каждый узел от старого `{x, y, width, height}` к новому
4. Узлы за пределами viewport обрезаются `overflow: hidden`
5. Кликнутый узел растягивается на весь экран, его дети перераспределяются внутри

## Ключевое архитектурное изменение

Сейчас при клике на Unit мы **меняем дерево данных** (фильтруем по unit, включаем showTeams). Это вызывает полную перерисовку.

Новый подход: **не менять дерево**. Вместо этого:
- Хранить "focused node" — узел, на который кликнули
- D3 layout пересчитывает позиции так, что focused node занимает весь viewport
- Дочерние узлы focused node получают больше пространства и становятся видимыми
- Соседние узлы сжимаются до 0 и уходят за край

## Детальные изменения

### 1. Новый хук `useTreemapZoom.ts` (новый файл)

Управляет состоянием зума:

```text
interface ZoomState {
  // Путь от корня до текущего focused node (для навигации назад)
  path: TreeNode[];  
  // Текущий focused node (или корень)
  currentNode: TreeNode;
}
```

- `zoomIn(node)` — добавляет узел в path, пересчитывает layout
- `zoomOut()` — убирает последний узел из path
- `canZoomOut` — есть ли куда возвращаться

### 2. Изменения в `useTreemapLayout.ts`

Новый параметр `focusedNodePath`:

```text
interface UseTreemapLayoutOptions {
  data: TreeNode;
  dimensions: ContainerDimensions;
  focusedNodePath?: string[];  // e.g. ['Все Unit', 'UnitA']
  ...
}
```

Логика:
- Если `focusedNodePath` не задан — обычный layout на всё дерево
- Если задан — layout рассчитывается так, что focused node занимает весь viewport
- D3 `treemap.size([fullWidth, fullHeight])` применяется к focused node
- Родительские и соседние узлы получают координаты за пределами viewport

Конкретнее: вместо `treemap.size([width, height])` на root, мы делаем layout на root, но потом **масштабируем координаты** так, чтобы focused node заполнял `[0, 0, width, height]`.

Формула трансформации:
```text
// focusedNode имеет координаты [fx0, fy0, fx1, fy1] в оригинальном layout
// Нужно: fx0->0, fy0->0, fx1->width, fy1->height
scaleX = width / (fx1 - fx0)
scaleY = height / (fy1 - fy0)
scale = min(scaleX, scaleY)  // Или использовать оба для stretch

// Для каждого узла:
newX0 = (node.x0 - fx0) * scale
newY0 = (node.y0 - fy0) * scale
newX1 = (node.x1 - fx0) * scale  
newY1 = (node.y1 - fy0) * scale
```

Это означает, что соседние узлы получат отрицательные координаты или координаты за пределами viewport — и будут обрезаны `overflow: hidden`.

### 3. Изменения в `TreemapContainer.tsx`

- Убрать `zoomTransform`, `isZooming`, `pendingCallbackRef` (CSS zoom больше не нужен)
- Убрать обёртку с `transform`
- Добавить `focusedPath` state (массив имён узлов от корня)
- `handleNodeClick`:
  - Не вызывать `onNodeClick` напрямую
  - Добавить имя кликнутого узла в `focusedPath`
  - `useTreemapLayout` получит новый `focusedPath` и вернёт пересчитанные позиции
  - Framer Motion автоматически анимирует узлы к новым позициям
- `onNavigateBack`:
  - Убрать последний элемент из `focusedPath`
- Для инициатив: по-прежнему вызывать `onInitiativeClick`

### 4. Изменения в `TreemapNode.tsx`

Минимальные:
- Убрать CSS zoom-related код (уже нет после текущей итерации)
- Variants.animate уже содержит `x, y, width, height` — Framer Motion будет интерполировать

### 5. Изменения в `Index.tsx`

Ключевое: при клике на unit в treemap **не менять фильтры** (не вызывать `setSelectedUnits`, `setShowTeams`). Вместо этого treemap управляет зумом внутри себя.

Но: фильтры из FilterBar по-прежнему должны работать. Это значит:
- `onNodeClick` из `BudgetTreemap` больше не пробрасывается в `Index.tsx` для смены фильтров
- Навигация внутрь — полностью внутри TreemapContainer
- FilterBar фильтрует данные до передачи в TreemapContainer

## Визуальный результат

1. Клик на Unit "TechPlatform"
2. Блок "TechPlatform" плавно растягивается до размеров всего treemap (600ms)
3. Соседние блоки ("FAP", "Data Office") сжимаются и уезжают за край
4. Внутри TechPlatform появляются команды (если showTeams включён) — они растут из 0
5. Один непрерывный переход, без мигания

## Риски и ограничения

1. **Производительность**: D3 layout пересчитывается при каждом зуме, но это быстро (< 5ms для сотен узлов)
2. **Совместимость с фильтрами**: фильтры FilterBar меняют входные данные, что вызовет пересчёт layout с учётом текущего focusedPath
3. **Глубина вложенности**: focusedPath может быть произвольной глубины (Unit -> Team -> ...)

## Файлы

| Файл | Что меняется |
|---|---|
| `src/components/treemap/useTreemapLayout.ts` | Добавить `focusedNodePath`, пересчёт координат |
| `src/components/treemap/TreemapContainer.tsx` | Убрать CSS zoom, добавить `focusedPath` state, новый handleNodeClick |
| `src/components/treemap/TreemapNode.tsx` | Убрать остатки CSS zoom кода |
| `src/components/treemap/types.ts` | Добавить focusedNodePath в типы |
| `src/components/BudgetTreemap.tsx` | Убрать onNodeClick проброс (зум внутри контейнера) |
| `src/components/StakeholdersTreemap.tsx` | Аналогично |
| `src/pages/Index.tsx` | Убрать логику смены фильтров при клике на treemap unit |

