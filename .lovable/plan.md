
# Гибридная анимация: crossfade для узлов с экстремальным aspect ratio

## Проблема

При zoom-in в узкий вертикальный прямоугольник (например, "Tech Platform" с соотношением ~1:5) соседние блоки резко "улетают" влево, потому что горизонтальное масштабирование в 5+ раз больше вертикального. Это дезориентирует.

## Решение

Определять aspect ratio узла перед анимацией. Если соотношение сторон экстремальное (>3:1 или <1:3), соседние узлы исчезают через быстрый fade-out вместо геометрического сдвига, а сам целевой узел плавно расширяется. Для "нормальных" узлов анимация остается без изменений.

## Как это работает

```text
Нормальный узел (aspect ratio 1:1 - 3:1):
  Соседи: анимируют x, y, width, height (текущее поведение)
  Целевой: анимирует x, y, width, height

Экстремальный узел (aspect ratio > 3:1 или < 1:3):
  Соседи: быстрый fade-out (opacity 1->0 за 250мс), без движения
  Целевой: анимирует x, y, width, height (как обычно)
```

## Технические изменения

### 1. `src/components/treemap/types.ts`

Добавить новый тип анимации `'drilldown-crossfade'` в `AnimationType` и `ANIMATION_DURATIONS` (те же 1200мс, чтобы целевой узел анимировался с той же скоростью).

### 2. `src/components/treemap/TreemapContainer.tsx`

- Добавить вычисление aspect ratio целевого узла при клике в `handleNodeClick`
- Новый state: `zoomTargetKey` (string | null) -- ключ узла, в который зумимся
- При клике на узел с экстремальным ratio: `setAnimationType('drilldown-crossfade')` и `setZoomTargetKey(node.key)`
- При обычном ratio: текущее поведение (`'drilldown'`)
- Передавать `zoomTargetKey` как проп в `TreemapNode`

### 3. `src/components/treemap/TreemapNode.tsx`

- Новый проп: `zoomTargetKey?: string | null`
- Логика выбора варианта анимации:

```text
if (animationType === 'drilldown-crossfade') {
  if (node.key === zoomTargetKey) {
    // Целевой узел: обычная геометрическая анимация
    variants.animate.transition.duration = duration;
  } else {
    // Сосед: быстрый fade-out без движения координат
    variants.animate = {
      opacity: 0,
      x, y, width: node.width, height: node.height,
      transition: { duration: 0.25 }
    };
  }
}
```

- Передавать `zoomTargetKey` дочерним `TreemapNode` рекурсивно

### 4. Определение "экстремального" ratio

Порог: aspect ratio > 3 или < 1/3. Формула в `handleNodeClick`:

```text
const aspectRatio = node.width / node.height;
const isExtreme = aspectRatio > 3 || aspectRatio < (1/3);
```

Ratio вычисляется по текущим размерам узла до zoom-трансформации (из `layoutNodes`), что точно отражает визуальную форму.

## Результат

- Квадратные и умеренно прямоугольные узлы: анимация без изменений
- Узкие вертикальные/горизонтальные узлы: соседи мягко исчезают, целевой плавно заполняет экран
- Нет резких горизонтальных/вертикальных "выстрелов" при зуме в экстремальные прямоугольники
