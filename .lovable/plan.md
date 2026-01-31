
# Fix: Variants + Custom Prop Wiring для Camera Zoom

## Проблема (подтверждена)

Текущая реализация использует **статические объекты** для `initial/animate/exit`, которые вычисляются через `useMemo` в момент рендера. Но когда `AnimatePresence` начинает exit-анимацию:

1. React уже удалил ноду из дерева
2. Framer Motion использует **снапшот** компонента на момент удаления
3. `zoomTarget` в этом снапшоте может быть устаревшим или `null`
4. Результат: fallback на `{ opacity: 0 }` вместо edge-based push

## Решение: Рефакторинг на Variants Pattern

### Файл 1: `src/components/treemap/TreemapNode.tsx`

**Изменения:**

1. Заменить `useMemo` объекты на **variants-функции**
2. Добавить `custom` prop к `motion.div`
3. Добавить `zIndex` согласно твоему требованию:
   - Zoom target: `zIndex: 50`
   - Соседи (exit): `zIndex: 0`
4. Добавить console.log для отладки

```typescript
// НОВАЯ структура вариантов
const createNodeVariants = (
  node: TreemapLayoutNode,
  containerWidth: number,
  containerHeight: number,
  animationType: AnimationType,
  isEntering: boolean
) => ({
  initial: (customData: ZoomTargetInfo | null) => {
    // ... логика initial
  },
  
  animate: (customData: ZoomTargetInfo | null) => {
    const isZoomTarget = customData?.key === node.key;
    
    if (isZoomTarget && animationType === 'drilldown') {
      return {
        x: 0,
        y: 0,
        width: containerWidth,
        height: containerHeight,
        opacity: 1,
        zIndex: 50,  // КРИТИЧНО: поверх соседей
      };
    }
    
    return {
      x: node.x0,
      y: node.y0,
      width: node.width,
      height: node.height,
      opacity: 1,
      zIndex: node.depth,
    };
  },
  
  exit: (customData: ZoomTargetInfo | null) => {
    console.log('EXIT variant triggered', { 
      nodeName: node.name, 
      hasCustomData: !!customData,
      animationType,
    });
    
    const isZoomTarget = customData?.key === node.key;
    
    // Zoom target: расширяется на весь экран
    if (isZoomTarget) {
      return {
        x: 0,
        y: 0,
        width: containerWidth,
        height: containerHeight,
        opacity: 1,
        zIndex: 50,  // Поверх улетающих соседей
      };
    }
    
    // Non-target: улетает за экран
    if (customData && animationType === 'drilldown') {
      const pushAnimation = getEdgeBasedExitAnimation(
        node, customData, containerWidth, containerHeight
      );
      return {
        ...pushAnimation,
        zIndex: 0,  // Под zoom target
      };
    }
    
    // Fallback
    return { 
      opacity: 0,
      x: node.x0,
      y: node.y0,
      width: node.width,
      height: node.height,
      zIndex: 0,
    };
  }
});

// В компоненте:
<motion.div
  custom={zoomTarget}           // КРИТИЧНО: передаём данные в варианты
  variants={variants}           // Объект с функциями
  initial="initial"             // Строковые ключи
  animate="animate"
  exit="exit"
  transition={transition}
  // ...
/>
```

### Файл 2: `src/components/treemap/TreemapContainer.tsx`

**Изменения:**

1. Добавить `custom={zoomTargetInfo}` к `<AnimatePresence>`
2. Исправить key для exiting nodes (уникальный суффикс)
3. Передавать `zoomTargetInfo` всем нодам (не только exiting)

```typescript
// Строка ~300
<AnimatePresence mode="sync" custom={zoomTargetInfo}>
  {/* Exiting nodes - с уникальными ключами */}
  {nodesForExit.length > 0 && animationType === 'drilldown' && nodesForExit.map(node => (
    <TreemapNode
      key={`exit-${node.key}`}           // Уникальный ключ!
      node={{
        ...node,
        key: `exit-${node.key}`,          // И layoutId тоже!
      }}
      zoomTarget={zoomTargetInfo}         // Передаём данные
      animationType={animationType}
      // ...
    />
  ))}
  
  {/* Current nodes - тоже получают zoomTargetInfo для animate */}
  {(showNewNodes || animationType !== 'drilldown') && layoutNodes.map(node => (
    <TreemapNode
      key={node.key}
      node={node}
      zoomTarget={zoomTargetInfo}         // Добавить! Сейчас null
      animationType={...}
      // ...
    />
  ))}
</AnimatePresence>
```

## Визуализация Data Flow

```text
TreemapContainer
│
├── AnimatePresence custom={zoomTargetInfo}
│   │
│   ├── TreemapNode (exiting node A)
│   │   ├── key="exit-unit-A"
│   │   ├── zoomTarget={zoomTargetInfo}
│   │   ├── custom={zoomTargetInfo} ← в motion.div
│   │   └── variants.exit(zoomTargetInfo) → { x: -500, zIndex: 0 }
│   │
│   ├── TreemapNode (exiting node B = ZOOM TARGET)
│   │   ├── key="exit-unit-B"
│   │   ├── zoomTarget={zoomTargetInfo}
│   │   ├── custom={zoomTargetInfo} ← в motion.div
│   │   └── variants.exit(zoomTargetInfo) → { x: 0, width: 100%, zIndex: 50 }
│   │
│   └── TreemapNode (exiting node C)
│       ├── key="exit-unit-C"
│       ├── zoomTarget={zoomTargetInfo}
│       ├── custom={zoomTargetInfo} ← в motion.div
│       └── variants.exit(zoomTargetInfo) → { x: +800, zIndex: 0 }
```

## Ожидаемый результат

После этих изменений в консоли должны появиться логи:

```
EXIT variant triggered { nodeName: "Unit A", hasCustomData: true, animationType: "drilldown" }
EXIT variant triggered { nodeName: "Unit B", hasCustomData: true, animationType: "drilldown" }
EXIT variant triggered { nodeName: "Unit C", hasCustomData: true, animationType: "drilldown" }
```

И визуально:
- Unit B (zoom target) расширяется на весь экран с `zIndex: 50`
- Unit A улетает влево с `zIndex: 0` (под Unit B)
- Unit C улетает вправо с `zIndex: 0` (под Unit B)
- Никаких белых промежутков — границы движутся синхронно

## Критические точки zIndex

| Элемент | zIndex | Причина |
|---------|--------|---------|
| Zoom target (animate) | 50 | Поверх расширяющихся |
| Zoom target (exit) | 50 | Поверх улетающих |
| Соседи (exit) | 0 | Под zoom target |
| Обычные ноды (animate) | depth | Иерархия |

## Порядок изменений

1. **TreemapNode.tsx** — полный рефакторинг на variants pattern
2. **TreemapContainer.tsx** — добавить custom prop и исправить keys
3. Протестировать drill-down
4. Удалить console.log после подтверждения

