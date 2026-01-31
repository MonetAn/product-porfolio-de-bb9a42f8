

# Fix: Camera Zoom Animation — Полное исправление wiring

## Обнаруженные проблемы

### Проблема 1: setTimeout сбрасывает zoomTargetInfo ДО завершения exit

**Строки 153-158 в TreemapContainer.tsx:**
```typescript
if (newAnimationType === 'drilldown') {
  const duration = ANIMATION_DURATIONS.drilldown;
  setTimeout(() => {
    setNodesForExit([]);
    setZoomTargetInfo(null);  // ← УБИВАЕТ custom prop!
  }, duration);              // duration = 500ms
}
```

`ANIMATION_DURATIONS.drilldown = 500ms`, но `ZOOM_TRANSITION.duration = 0.6s = 600ms`.  
Результат: `zoomTargetInfo` становится `null` **на 100ms раньше** чем заканчивается анимация!

### Проблема 2: animationType берётся из closure, а не из custom

В `TreemapNode.tsx` variants создаются через `useMemo` и "замораживают" `animationType`:
```typescript
const variants = useMemo(() => 
  createNodeVariants(node, containerWidth, containerHeight, animationType, isEntering),
  [node, containerWidth, containerHeight, animationType, isEntering]
);
```

Когда exiting nodes рендерятся, их `animationType` может быть уже **не 'drilldown'**, а измениться на что-то другое.

### Проблема 3: Логи показывают hasCustomData: false

Консольные логи подтверждают:
```
EXIT variant triggered {
  "nodeName": "Client Platform",
  "hasCustomData": false,        // ← custom = null к моменту exit!
  "animationType": "filter",     // ← Не "drilldown"!
}
```

---

## Решение: 3 исправления

### 1. Расширить ZoomTargetInfo — включить animationType

**Файл: `src/components/treemap/types.ts`**

Добавить `animationType` в интерфейс, чтобы передавать через `custom`:

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
  animationType: AnimationType;  // НОВОЕ: передаём тип анимации
}
```

### 2. Использовать onExitComplete вместо setTimeout

**Файл: `src/components/treemap/TreemapContainer.tsx`**

Удалить setTimeout который сбрасывает state слишком рано:

```typescript
// УДАЛИТЬ строки 153-159:
// if (newAnimationType === 'drilldown') {
//   const duration = ANIMATION_DURATIONS.drilldown;
//   setTimeout(() => {
//     setNodesForExit([]);
//     setZoomTargetInfo(null);
//   }, duration);
// }
```

Добавить `onExitComplete` callback в AnimatePresence:

```typescript
<AnimatePresence 
  mode="sync" 
  custom={zoomTargetInfo}
  onExitComplete={() => {
    // Очищаем ТОЛЬКО после завершения всех exit анимаций
    console.log('AnimatePresence: onExitComplete triggered');
    setNodesForExit([]);
    setZoomTargetInfo(null);
  }}
>
```

При установке zoomTargetInfo — включать animationType:

```typescript
// Строки 134-144
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
    animationType: 'drilldown',  // НОВОЕ!
  });
  setNodesForExit(prevLayoutNodesRef.current);
}
```

### 3. Читать animationType из custom в variants

**Файл: `src/components/treemap/TreemapNode.tsx`**

В exit variant использовать `customData.animationType` вместо closure:

```typescript
exit: (customData: ZoomTargetInfo | null) => {
  // DEBUG: Log to verify data flow
  console.log('EXIT variant triggered', { 
    nodeName: node.name, 
    hasCustomData: !!customData,
    customAnimationType: customData?.animationType,  // Из custom!
    customDataKey: customData?.key,
  });
  
  const isZoomTarget = customData?.key === node.key;
  const exitAnimationType = customData?.animationType;  // ИЗ CUSTOM!
  
  // Zoom target: expands to fullscreen (stays on top)
  if (isZoomTarget) {
    return {
      x: 0,
      y: 0,
      width: containerWidth,
      height: containerHeight,
      opacity: 1,
      zIndex: 50,
    };
  }
  
  // Non-target during drilldown: fly off screen
  if (customData && exitAnimationType === 'drilldown') {
    const pushAnimation = getEdgeBasedExitAnimation(
      node, customData, containerWidth, containerHeight
    );
    return {
      ...pushAnimation,
      zIndex: 0,
    };
  }
  
  // Fallback: simple fade
  return { 
    opacity: 0,
    x: node.x0,
    y: node.y0,
    width: node.width,
    height: node.height,
    zIndex: 0,
  };
}
```

### 4. Slow-Motion Debug Mode (временно)

Для визуальной проверки — увеличить duration до 3 секунд:

```typescript
// TreemapNode.tsx — временно!
const ZOOM_TRANSITION = {
  type: 'tween' as const,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
  duration: 3.0,  // TEMPORARY: было 0.6
};

// TreemapContainer.tsx — синхронизировать
export const ANIMATION_DURATIONS: Record<AnimationType, number> = {
  'initial': 0,
  'filter': 800,
  'drilldown': 3000,  // TEMPORARY: было 500
  'navigate-up': 3000,  // TEMPORARY: было 600
  'resize': 300
};
```

---

## Визуализация исправленного Data Flow

```text
КЛИК на Unit B
     │
     ▼
setZoomTargetInfo({
  key: "unit-B",
  animationType: "drilldown",  ← СОХРАНЯЕМ ТИП!
  x0, y0, x1, y1, ...
})
     │
     ▼
AnimatePresence custom={zoomTargetInfo}  ← ПЕРЕДАЁМ В custom
     │
     ├─────────────────────────────────┐
     ▼                                 ▼
TreemapNode A (exit)            TreemapNode B (exit = zoom target)
     │                                 │
     ▼                                 ▼
variants.exit(customData)        variants.exit(customData)
     │                                 │
customData = {                   customData = {
  key: "unit-B",                   key: "unit-B",
  animationType: "drilldown",      animationType: "drilldown",
  ...                              ...
}                                }
     │                                 │
isZoomTarget? NO                 isZoomTarget? YES
     │                                 │
     ▼                                 ▼
getEdgeBasedExitAnimation()      { x:0, y:0, width:100%, zIndex:50 }
→ { x: -500, zIndex: 0 }
     │
     ▼
... exit анимация завершается ...
     │
     ▼
onExitComplete()
     │
     ▼
setZoomTargetInfo(null)  ← ТОЛЬКО СЕЙЧАС сбрасываем!
setNodesForExit([])
```

---

## Порядок изменений в файлах

| Файл | Изменение |
|------|-----------|
| `types.ts` | Добавить `animationType: AnimationType` в `ZoomTargetInfo` |
| `TreemapContainer.tsx` | 1. Удалить setTimeout (строки 153-159) |
| | 2. Добавить `onExitComplete` в AnimatePresence |
| | 3. Включать `animationType` в zoomTargetInfo |
| `TreemapNode.tsx` | 1. Читать `customData?.animationType` вместо closure |
| | 2. Временно: duration = 3.0 для debug |

---

## Ожидаемый результат после исправления

Консоль должна показать:
```
EXIT variant triggered {
  nodeName: "Unit A",
  hasCustomData: true,           ← FIXED!
  customAnimationType: "drilldown", ← FIXED!
  customDataKey: "unit-B"
}
```

Визуально:
- Unit B расширяется на весь экран с zIndex: 50
- Unit A, C, D, ... улетают за края экрана с zIndex: 0
- Никаких белых промежутков
- Slow-motion (3 сек) позволит увидеть все детали

