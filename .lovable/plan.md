

# Fix: Принудительная передача данных для Exit-нод

## Подтверждённая проблема (из логов)

```
EXIT variant triggered {
  nodeName: 'Client Platform',
  hasCustomData: false,           // ← ДАННЫЕ НЕ ДОХОДЯТ
  closureAnimationType: 'filter', // ← STALE CLOSURE
  customDataKey: undefined
}
```

**Причина:** React 18 batches state updates. Когда `AnimatePresence` начинает exit-анимацию, он использует **снапшот props** на момент unmount. К этому моменту:
1. `animationType` в state ещё может быть `'filter'`
2. `zoomTargetInfo` может быть `null` из-за race condition

## Решение: 3 исправления

### Исправление 1: Убрать условие `animationType === 'drilldown'` из render

**Файл: `TreemapContainer.tsx`, строка 307**

Сейчас:
```typescript
{nodesForExit.length > 0 && animationType === 'drilldown' && nodesForExit.map(node => (
```

**Проблема:** Если `animationType` ещё не обновился в state, условие `false` и ноды НЕ рендерятся вообще.

**Исправление:** Проверять только `nodesForExit.length > 0`:
```typescript
{nodesForExit.length > 0 && nodesForExit.map(node => (
```

### Исправление 2: Hardcode `animationType="drilldown"` для exit-нод

**Файл: `TreemapContainer.tsx`, строка 314**

Сейчас:
```typescript
animationType={animationType}  // ← Может быть stale!
```

**Исправление:** Принудительно передать `'drilldown'`:
```typescript
animationType="drilldown"  // FORCE: не зависим от state
```

### Исправление 3: Гарантировать порядок state updates

**Файл: `TreemapContainer.tsx`, строки 135-146**

Сейчас:
```typescript
setZoomTargetInfo({...});
setNodesForExit(prevLayoutNodesRef.current);
```

React 18 батчит эти обновления, но для надёжности нужно убедиться, что `zoomTargetInfo` устанавливается **одновременно или раньше**.

**Проверка:** Порядок уже правильный (setZoomTargetInfo → setNodesForExit). Но добавим явное логирование для диагностики.

---

## Изменения в коде

### TreemapContainer.tsx

```typescript
// Строка 307 - убрать проверку animationType
{nodesForExit.length > 0 && nodesForExit.map(node => (
  <TreemapNode
    key={`exit-${node.key}`}
    node={{
      ...node,
      key: `exit-${node.key}`,
    }}
    animationType="drilldown"        // FORCE: hardcoded!
    zoomTarget={zoomTargetInfo}      // Pass explicitly
    containerWidth={dimensions.width}
    containerHeight={dimensions.height}
    onClick={handleNodeClick}
    onMouseEnter={handleMouseEnter}
    onMouseMove={handleMouseMove}
    onMouseLeave={handleMouseLeave}
    renderDepth={renderDepth}
  />
))}
```

### TreemapNode.tsx — проверка custom prop

**Строка 362** уже правильная:
```typescript
custom={zoomTarget}           // ✓ Передаётся корректно
```

Но нужно убедиться, что variant функция **правильно читает** из `customData`:

```typescript
exit: (customData: ZoomTargetInfo | null) => {
  const exitAnimationType = customData?.animationType;  // ✓ Уже исправлено
  
  console.log('EXIT variant triggered', { 
    nodeName: node.name, 
    hasCustomData: !!customData,
    customAnimationType: exitAnimationType,
    customDataKey: customData?.key,
  });
  
  // ...rest of logic
}
```

---

## Визуализация исправленного flow

```text
КЛИК на Unit B
     │
     ▼
useEffect срабатывает
     │
     ├─ setZoomTargetInfo({ key: 'unit-B', animationType: 'drilldown', ... })
     │
     └─ setNodesForExit(prevLayoutNodesRef.current)
           │
           ▼
React re-render
     │
     ├─ nodesForExit.length > 0 → TRUE
     │
     └─ nodesForExit.map(node => <TreemapNode animationType="drilldown" ... />)
                                              │
                                              ▼
                                    motion.div custom={zoomTarget}
                                              │
                                              ▼
                               variants.exit(customData) → hasCustomData: TRUE
```

---

## Ожидаемый результат

После исправления консоль покажет:
```
EXIT variant triggered {
  nodeName: 'Client Platform',
  hasCustomData: true,              // ← ИСПРАВЛЕНО
  customAnimationType: 'drilldown', // ← ИСПРАВЛЕНО
  customDataKey: 'unit-B'
}
```

И визуально:
- Zoom target расширяется на весь экран (полупрозрачный для debug)
- Соседние ноды улетают за края экрана
- Никаких `opacity: 0` fadeouts

