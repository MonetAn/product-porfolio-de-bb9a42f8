

# Переписать drilldown: CSS Zoom вместо Framer Motion exit

## Почему push через AnimatePresence не работал (и не мог)

Цепочка событий при клике на unit:
1. `handleNodeClick` в TreemapContainer сохраняет `lastClickCenter`
2. Вызывает `onNodeClick` -> Index.tsx меняет фильтры (`selectedUnits`, `showTeams`)
3. `rebuildTree` создаёт новое дерево с корнем "Все Unit" (имя НЕ меняется)
4. `useLayoutEffect` видит `data.name` === прежнее -> классифицирует как `'filter'`
5. Для `'filter'` сбрасывает `lastClickCenter = null`
6. AnimatePresence вызывает exit с `custom = null` -> fallback на fade

Координаты клика стирались **до начала** exit-анимации. Никакие фиксы в exit-варианте не могли это исправить.

## Новый подход: CSS Zoom

Вместо того чтобы бороться с AnimatePresence, используем подход Flourish/d3-zoom:

1. Клик на узел -> НЕ менять данные сразу
2. Применить CSS `transform: scale(X) translate(Y)` ко всему контейнеру с узлами
3. Контейнер масштабируется так, что кликнутый узел заполняет viewport
4. Все остальные узлы естественно "уезжают" за край (это и есть push)
5. После завершения CSS transition (~600ms) -> сменить данные и сбросить transform

Визуально это выглядит ровно как в Flourish: камера приближается к кликнутому блоку, остальные уходят за края.

## Изменения

### 1. `src/components/treemap/TreemapContainer.tsx` — основные изменения

Добавить состояние зума и отложенный вызов:

```text
// Новые состояния:
const [zoomTransform, setZoomTransform] = useState<string>('none');
const [isZooming, setIsZooming] = useState(false);
const pendingCallbackRef = useRef<(() => void) | null>(null);

// Убрать:
// - lastClickCenter
// - clickedNodeKey 
// - всю логику isHero
// - overflow: visible
```

Переписать `handleNodeClick`:

```text
const handleNodeClick = useCallback((node: TreemapLayoutNode) => {
  if (isZooming) return; // Игнорировать клики во время зума

  // Сохранить callback для вызова после анимации
  const callback = () => {
    if (node.data.isInitiative && onInitiativeClick) {
      onInitiativeClick(node.data.name);
    } else if (onNodeClick) {
      onNodeClick(node.data);
    }
  };

  // Рассчитать zoom transform
  const scaleX = dimensions.width / node.width;
  const scaleY = dimensions.height / node.height;
  const scale = Math.min(scaleX, scaleY);

  // Translate: сместить кликнутый узел в начало координат, затем масштабировать
  const tx = -node.x0;
  const ty = -node.y0;

  setZoomTransform(`scale(${scale}) translate(${tx}px, ${ty}px)`);
  setIsZooming(true);
  pendingCallbackRef.current = callback;

  // После завершения CSS transition -> сменить данные
  setTimeout(() => {
    setZoomTransform('none');
    setIsZooming(false);
    pendingCallbackRef.current?.();
    pendingCallbackRef.current = null;
  }, 600);
}, [dimensions, onNodeClick, onInitiativeClick, isZooming]);
```

Обновить JSX — обернуть узлы в div с transform:

```text
<div 
  style={{
    position: 'relative',
    width: '100%',
    height: '100%',
    transform: zoomTransform,
    transformOrigin: '0 0',
    transition: isZooming ? 'transform 0.6s cubic-bezier(0.25, 0.1, 0.25, 1)' : 'none',
  }}
>
  <AnimatePresence mode="sync">
    {layoutNodes.map(node => (
      <TreemapNode ... />
    ))}
  </AnimatePresence>
</div>
```

Контейнер `.treemap-container` остаётся с `overflow: hidden` — масштабированные узлы за пределами viewport будут обрезаны.

Убрать `custom={lastClickCenter}` из AnimatePresence -- он больше не нужен.

### 2. `src/components/treemap/TreemapNode.tsx` — упрощение

Убрать все push-related пропсы и логику:

- Убрать из интерфейса: `clickCenter`, `isHero`, `containerDimensions`
- Упростить `exit` variant до простого объекта:
```text
exit: { opacity: 0, scale: 0.92 }
```
- Убрать `zIndex: isHero ? 10 : 1` (просто `zIndex: 1`)
- Убрать передачу `clickCenter`, `isHero`, `containerDimensions` в рекурсивные дочерние TreemapNode
- Убрать `custom={clickCenter}` из вложенного AnimatePresence

Exit-анимация теперь только для случаев фильтрации и навигации назад (где fade+scale уместен). При drilldown exit НЕ вызывается, потому что данные меняются после завершения CSS zoom.

### 3. `src/components/treemap/TreemapContainer.tsx` — useLayoutEffect

Убрать сброс `lastClickCenter`/`clickedNodeKey` (их больше нет):

```text
// Было:
if (newAnimationType === 'navigate-up' || newAnimationType === 'filter') {
  setLastClickCenter(null);
  setClickedNodeKey(null);
}

// Станет: просто убрать эти строки
```

### 4. `src/components/treemap/useTreemapLayout.ts`

Без изменений — D3 layout остаётся как есть.

## Что происходит визуально

### Drilldown (клик на unit)
1. Весь treemap плавно масштабируется, "наезжая камерой" на кликнутый блок
2. Кликнутый блок растёт до размеров контейнера
3. Соседние блоки уезжают за край (обрезаются overflow: hidden)
4. После завершения анимации: данные меняются, новые блоки (команды) появляются с fade+scale

### Фильтрация / навигация назад
Без изменений — fade+scale через Framer Motion variants (работает сейчас).

## Почему это сработает

- Никакого конфликта с Framer Motion: CSS transform на контейнере, FM управляет только enter/exit отдельных узлов
- Нет проблем со stale props: координаты рассчитываются синхронно в момент клика
- Нет проблем с AnimatePresence: данные меняются ПОСЛЕ завершения зума, а не одновременно
- `overflow: hidden` на контейнере обеспечивает обрезку узлов за пределами viewport

## Файлы

| Файл | Что меняется |
|---|---|
| `src/components/treemap/TreemapContainer.tsx` | Добавить CSS zoom, убрать click-center state |
| `src/components/treemap/TreemapNode.tsx` | Убрать push-пропсы, упростить exit |

