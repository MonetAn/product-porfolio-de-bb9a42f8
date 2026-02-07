

# Быстрый drilldown для узлов с экстремальным aspect ratio

## Проблема

Текущий crossfade создает некрасивый эффект: соседи исчезают за 250мс, а целевой узел растягивается 1200мс -- почти секунду видно белое пустое пространство. Это выглядит хуже, чем исходная геометрическая анимация.

## Новое решение

Убрать crossfade. Вместо этого для узлов с экстремальным aspect ratio использовать **ускоренную версию** обычной геометрической анимации (400мс вместо 1200мс). Быстрое движение не успевает дезориентировать, при этом нет пустого белого пространства.

```text
Нормальный узел (aspect ratio 1:1 - 3:1):
  Все элементы: геометрическая анимация 1200мс (без изменений)

Экстремальный узел (aspect ratio > 3:1 или < 1:3):
  Все элементы: геометрическая анимация 400мс (быстро, но плавно)
```

## Технические изменения

### 1. `src/components/treemap/types.ts`

- Заменить `'drilldown-crossfade'` на `'drilldown-fast'` в AnimationType
- Добавить в ANIMATION_DURATIONS: `'drilldown-fast': 400`

### 2. `src/components/treemap/TreemapContainer.tsx`

- В `handleNodeClick`: заменить `setAnimationType('drilldown-crossfade')` на `setAnimationType('drilldown-fast')`
- Убрать state `zoomTargetKey` (больше не нужен)
- В useLayoutEffect: заменить логику crossfade на `'drilldown-fast'`
- Убрать проп `zoomTargetKey` из передачи в TreemapNode

### 3. `src/components/treemap/TreemapNode.tsx`

- Убрать проп `zoomTargetKey` и всю логику crossfade (isZoomTarget, isNeighbor)
- Убрать условие `isNeighbor ? 0 : 1` для opacity -- все узлы всегда opacity: 1
- Тип `'drilldown-fast'` не требует специальной обработки в TreemapNode, потому что duration берется из `ANIMATION_DURATIONS[animationType]` автоматически

### 4. Определение aspect ratio (без изменений)

Порог остается тот же: aspect ratio > 3 или < 1/3. Вычисляется в `handleNodeClick`.

## Результат

- Обычные узлы: плавная анимация 1200мс (как сейчас)
- Экстремальные узлы: быстрая анимация 400мс -- движение есть, но слишком быстрое, чтобы дезориентировать
- Никакого белого пространства и "бедных" переходов
