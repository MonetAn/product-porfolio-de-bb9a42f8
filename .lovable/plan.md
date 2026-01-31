
# Полноценный Camera Zoom: Стык-в-стык анимация

## Концепция: Физическое выталкивание

Представь, что расширяющийся блок — это поршень, который **выталкивает** соседей за границы экрана. Ни один пиксель фона не должен быть виден во время анимации.

```text
Сейчас (проблема):                 Цель (стык в стык):
┌─A─┐ ┌─B─┐ ┌─C─┐                  ┌─A─┐┌─B─┐┌─C─┐
└───┘ └───┘ └───┘                  └───┘└───┘└───┘
       ↓                                  ↓
     A сжимается     пробел!    C        ┌───────────┐
     ← ·  ┌────B────┐  · →               │     B     │
              ↓                          └───────────┘
     A исчезла  B на экране  C исчезла   A и C уехали ЗА экран,
                                         всегда касаясь B
```

## Техническое решение

### Ключевая идея: Edge-based Push

Вместо расчёта от центра к центру, рассчитываем смещение **от границы расширяющегося блока**.

```text
Блок слева от B:
- B расширяется вправо на ΔW
- A должен сместиться влево на ΔW (чтобы остаться на границе B)
- Финальная позиция A: далеко за левым краем экрана

Блок справа от B:
- B расширяется влево на (B.x0 - 0) пикселей
- C должен сместиться вправо на эту величину
- Финальная позиция C: далеко за правым краем экрана
```

### Математика выталкивания

Для каждого соседнего блока определяем, как он соотносится с **границами** расширяющегося блока:

```typescript
// Zoom target расширяется: (x0, y0, w, h) → (0, 0, containerW, containerH)
// Соседи должны "ехать" вместе с соответствующей границей

function calculatePushAnimation(
  node: TreemapLayoutNode,
  zoomTarget: TreemapLayoutNode,
  container: { width: number; height: number }
) {
  // Насколько zoom target расширится в каждом направлении
  const expandLeft = zoomTarget.x0;           // пикселей влево
  const expandRight = container.width - zoomTarget.x1;  // вправо
  const expandTop = zoomTarget.y0;            // вверх
  const expandBottom = container.height - zoomTarget.y1; // вниз
  
  // Где находится наш блок относительно zoom target?
  let pushX = 0;
  let pushY = 0;
  
  // Горизонтальное смещение
  if (node.x1 <= zoomTarget.x0) {
    // Блок полностью СЛЕВА от target
    pushX = -(expandLeft + node.width + 50); // Уехать за левый край
  } else if (node.x0 >= zoomTarget.x1) {
    // Блок полностью СПРАВА от target
    pushX = expandRight + node.width + 50;   // Уехать за правый край
  }
  
  // Вертикальное смещение
  if (node.y1 <= zoomTarget.y0) {
    // Блок полностью СВЕРХУ от target
    pushY = -(expandTop + node.height + 50);
  } else if (node.y0 >= zoomTarget.y1) {
    // Блок полностью СНИЗУ от target
    pushY = expandBottom + node.height + 50;
  }
  
  // Диагональные блоки — комбинация обоих смещений
  // Если pushX и pushY оба не 0, блок уедет по диагонали
  
  return {
    x: node.x0 + pushX,
    y: node.y0 + pushY,
    width: node.width,   // НЕ сжимаем!
    height: node.height, // НЕ сжимаем!
    opacity: 1,          // Остаётся видимым до выхода за экран
  };
}
```

## Изменения по файлам

### 1. `src/components/treemap/types.ts`

Добавить интерфейс для zoom target:

```typescript
// Zoom target info for edge-based push calculation
export interface ZoomTargetInfo {
  key: string;
  name: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  height: number;
}
```

### 2. `src/components/treemap/TreemapNode.tsx`

**Ключевые изменения:**

1. Принимать `zoomTarget` (полную информацию, не только key)
2. Рассчитывать exit на основе границ
3. Убрать сжатие (`width: 0, height: 0`)
4. Сохранить opacity = 1 во время анимации

```typescript
interface TreemapNodeProps {
  node: TreemapLayoutNode;
  animationType: AnimationType;
  // NEW: Полная информация о zoom target для расчёта границ
  zoomTarget?: ZoomTargetInfo | null;
  containerWidth: number;
  containerHeight: number;
  onClick?: (node: TreemapLayoutNode) => void;
  // ... остальные пропы
}

// NEW: Edge-based push calculation
function getEdgeBasedExitAnimation(
  node: TreemapLayoutNode,
  zoomTarget: ZoomTargetInfo,
  containerWidth: number,
  containerHeight: number
) {
  // Насколько target расширится
  const expandLeft = zoomTarget.x0;
  const expandRight = containerWidth - zoomTarget.x1;
  const expandTop = zoomTarget.y0;
  const expandBottom = containerHeight - zoomTarget.y1;
  
  let pushX = 0;
  let pushY = 0;
  
  // Определяем преобладающее направление
  const nodeCenterX = node.x0 + node.width / 2;
  const nodeCenterY = node.y0 + node.height / 2;
  const targetCenterX = zoomTarget.x0 + zoomTarget.width / 2;
  const targetCenterY = zoomTarget.y0 + zoomTarget.height / 2;
  
  // Горизонтальное смещение
  if (nodeCenterX < targetCenterX) {
    // Блок левее target — уезжает влево
    pushX = -(expandLeft + node.width + 100);
  } else {
    // Блок правее target — уезжает вправо
    pushX = expandRight + node.width + 100;
  }
  
  // Вертикальное смещение (пропорционально)
  if (nodeCenterY < targetCenterY) {
    // Блок выше — уезжает вверх
    pushY = -(expandTop + node.height + 100);
  } else {
    // Блок ниже — уезжает вниз
    pushY = expandBottom + node.height + 100;
  }
  
  // Нормализуем направление для более естественного движения
  // Блоки на одной горизонтали — минимальное вертикальное смещение
  const horizontalOverlap = !(node.x1 <= zoomTarget.x0 || node.x0 >= zoomTarget.x1);
  const verticalOverlap = !(node.y1 <= zoomTarget.y0 || node.y0 >= zoomTarget.y1);
  
  if (horizontalOverlap) {
    // Блок над/под target — только вертикальное смещение
    pushX = 0;
  }
  if (verticalOverlap) {
    // Блок слева/справа — только горизонтальное смещение
    pushY = 0;
  }
  
  return {
    x: node.x0 + pushX,
    y: node.y0 + pushY,
    width: node.width,   // Сохраняем размер!
    height: node.height, // Сохраняем размер!
    opacity: 1,          // Не fade!
  };
}
```

### 3. `src/components/treemap/TreemapContainer.tsx`

**Ключевые изменения:**

1. Передавать полную информацию о zoomTarget, не только key
2. Убрать двойной рендеринг (exiting + new nodes)
3. Единый поток: старые блоки анимируются → удаляются → новые появляются

```typescript
// NEW: Хранить полную информацию о zoom target
const [zoomTargetInfo, setZoomTargetInfo] = useState<ZoomTargetInfo | null>(null);

// В useEffect при drilldown:
if (newAnimationType === 'drilldown' && clickedNodeName) {
  const clickedNode = prevLayoutNodesRef.current.find(n => n.name === clickedNodeName);
  if (clickedNode) {
    setZoomTargetInfo({
      key: clickedNode.key,
      name: clickedNode.name,
      x0: clickedNode.x0,
      y0: clickedNode.y0,
      x1: clickedNode.x1,
      y1: clickedNode.y1,
      width: clickedNode.width,
      height: clickedNode.height,
    });
    setNodesForExit(prevLayoutNodesRef.current);
  }
}

// В рендере — передаём zoomTargetInfo:
<TreemapNode
  node={node}
  zoomTarget={zoomTargetInfo}
  // ... остальные пропы
/>
```

### 4. Анимация Zoom Target

Zoom target должен расширяться с тем же easing и duration, что и соседи:

```typescript
// В TreemapNode, для zoom target:
const animateState = useMemo(() => {
  if (zoomTarget && node.key === zoomTarget.key) {
    // Zoom target → fullscreen
    return {
      x: 0,
      y: 0,
      width: containerWidth,
      height: containerHeight,
      opacity: 1,
      zIndex: 100,
    };
  }
  // Обычный блок
  return {
    x: node.x0,
    y: node.y0,
    width: node.width,
    height: node.height,
    opacity: 1,
  };
}, [node, zoomTarget, containerWidth, containerHeight]);
```

### 5. Transition Синхронизация

Все блоки должны использовать **идентичный** transition:

```typescript
const ZOOM_TRANSITION = {
  type: 'tween' as const,
  ease: [0.4, 0, 0.2, 1], // ease-in-out
  duration: 0.6,
};

// В TreemapNode:
<motion.div
  initial={...}
  animate={animateState}
  exit={exitAnimation}
  transition={ZOOM_TRANSITION} // Одинаковый для всех!
  // ...
/>
```

## Визуальный таймлайн

```text
t=0ms:   Клик на Unit B (центральный)
         ┌─A─┐┌─B─┐┌─C─┐
         └───┘└───┘└───┘
         ┌─D─┐┌─E─┐┌─F─┐
         └───┘└───┘└───┘

t=100ms: B начинает расширяться
         A←┌──┐┌────B────┐┌──┐→C
           D↓          ↑E   F→
         Все блоки движутся СИНХРОННО, границы касаются

t=300ms: B почти fullscreen
         ←A   ┌─────────────B─────────────┐   C→
                        ↑E
         A,C,D,E,F уже частично за экраном (но opacity=1!)

t=600ms: B занимает 100% экрана
         A,C,D,E,F полностью за экраном → AnimatePresence удаляет
         ┌─────────────────────────────────┐
         │               B                  │
         └─────────────────────────────────┘

t=600ms+: Teams появляются с fade-in
         ┌─────────────────────────────────┐
         │  ┌Team1┐ ┌Team2┐ ┌Team3┐        │
         │  └─────┘ └─────┘ └─────┘        │
         └─────────────────────────────────┘
```

## Обратная анимация (Zoom Out / Navigate Up)

Та же логика в обратном направлении:

1. Текущий fullscreen блок сжимается к своей позиции
2. Соседние блоки "въезжают" с краёв экрана (начальные позиции = за экраном)
3. Все движутся синхронно, границы всегда касаются

```typescript
function getEdgeBasedEnterAnimation(
  node: TreemapLayoutNode,
  containerCenter: { x: number; y: number },
  containerWidth: number,
  containerHeight: number
) {
  // Откуда блок "въезжает" — зависит от его финальной позиции
  const nodeCenterX = node.x0 + node.width / 2;
  const nodeCenterY = node.y0 + node.height / 2;
  
  let startX = node.x0;
  let startY = node.y0;
  
  if (nodeCenterX < containerWidth / 2) {
    // Финальная позиция слева → въезжает слева
    startX = -(node.width + 100);
  } else {
    // Финальная позиция справа → въезжает справа
    startX = containerWidth + 100;
  }
  
  if (nodeCenterY < containerHeight / 2) {
    startY = -(node.height + 100);
  } else {
    startY = containerHeight + 100;
  }
  
  return {
    x: startX,
    y: startY,
    width: node.width,
    height: node.height,
    opacity: 1,
  };
}
```

## Оптимизация: Предотвращение пробелов

Для 100% гарантии "стык в стык":

1. **Единый transition** — все блоки используют одинаковый duration и easing
2. **Overflow: hidden** на контейнере — блоки "исчезают" за краем, а не fade
3. **Без сжатия** — блоки сохраняют свой размер во время движения
4. **Z-index** — zoom target имеет z-index: 100, соседи — стандартный

## CSS изменения

```css
.treemap-container {
  overflow: hidden; /* КРИТИЧНО! Блоки уезжают за край */
}

.treemap-node {
  /* Убрать любые transition, Framer Motion управляет всем */
  will-change: transform; /* Оптимизация GPU */
}
```

## Ожидаемый результат

- **Идеальная синхронизация**: Все блоки движутся с одинаковой скоростью
- **Нет белых промежутков**: Границы всегда касаются
- **Естественное выталкивание**: Блоки уезжают в направлении, противоположном расширению
- **Плавность 60fps**: GPU-ускоренные transform анимации
