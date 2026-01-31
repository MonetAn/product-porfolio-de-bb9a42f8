

# Isolation Test: Отключаем Layout Projection для Exit-нод

## Подтверждённая гипотеза

**Строка 375 в TreemapNode.tsx:**
```tsx
layoutId={node.key}
```

Когда у `motion.div` есть `layoutId`, Framer Motion применяет **Layout Projection** — автоматически вычисляет и анимирует позицию элемента на основе DOM-измерений. Это **полностью игнорирует** ручные `x`, `y`, `width`, `height` в `exit` variant!

**Результат:** Наша логика `getEdgeBasedExitAnimation()` рассчитывает правильные координаты (`x: -500`, `y: -300`), но они никуда не применяются — Layout Projection делает своё.

---

## План Isolation Test

### Изменение 1: Передать флаг `isExitingNode` в TreemapNode

**Файл: `TreemapContainer.tsx`**

В цикле `nodesForExit.map(...)` передать проп, сигнализирующий что это exit-нода:

```typescript
{nodesForExit.length > 0 && nodesForExit.map(node => (
  <TreemapNode
    key={`exit-${node.key}`}
    node={{ ...node, key: `exit-${node.key}` }}
    animationType="drilldown"
    zoomTarget={zoomTargetInfo}
    isExitingNode={true}           // НОВЫЙ ПРОП!
    containerWidth={dimensions.width}
    containerHeight={dimensions.height}
    // ...rest
  />
))}
```

### Изменение 2: Условно отключить layoutId для exit-нод

**Файл: `TreemapNode.tsx`**

1. Добавить проп `isExitingNode?: boolean` в интерфейс
2. Если `isExitingNode === true` И нода **не является zoom target**, то:
   - Убрать `layoutId` (не передавать вообще или `undefined`)
   - Добавить визуальный маркер: `border: "5px solid red"`

```typescript
interface TreemapNodeProps {
  // ...existing props
  isExitingNode?: boolean;  // NEW
}

// Inside component:
const isZoomTarget = zoomTarget?.key === node.key;
const shouldDisableLayout = isExitingNode && !isZoomTarget;

return (
  <motion.div
    ref={ref}
    // CRITICAL: Disable layoutId for exiting non-target nodes
    layoutId={shouldDisableLayout ? undefined : node.key}
    custom={zoomTarget}
    // ...
    style={{
      position: 'absolute',
      backgroundColor: node.color,
      // DEBUG: Red border for exiting nodes
      border: shouldDisableLayout ? '5px solid red' : undefined,
      // ...
    }}
  >
```

### Изменение 3: Добавить консольный лог для отладки

```typescript
if (shouldDisableLayout) {
  console.log('ISOLATION TEST: layoutId DISABLED for', node.name, {
    isExitingNode,
    isZoomTarget,
    zoomTargetKey: zoomTarget?.key,
    nodeKey: node.key,
  });
}
```

---

## Ожидаемый результат

### Если гипотеза верна (layoutId — виновник):
- Красные блоки начнут **физически улетать за края экрана**
- В консоли появятся логи `ISOLATION TEST: layoutId DISABLED for Unit A`
- Zoom target (без красной рамки) расширится на весь экран

### Если гипотеза неверна:
- Красные блоки все ещё будут fade out
- Нужно искать другую причину (например, AnimatePresence mode, или что-то ещё)

---

## Визуализация теста

```text
ДО (сейчас):
┌────────────────────────────────────────┐
│ ┌──────────┐  ┌──────────┐  ┌────────┐ │
│ │ Unit A   │  │ Unit B   │  │ Unit C │ │  ← КЛИК на Unit B
│ │          │  │ (target) │  │        │ │
│ └──────────┘  └──────────┘  └────────┘ │
└────────────────────────────────────────┘
          ↓ layoutId перекрывает exit variant
          ↓ всё просто fade out

ПОСЛЕ (с отключенным layoutId):
┌────────────────────────────────────────┐
│ ┌──────────┐                ┌────────┐ │
│ │ Unit A   │  ← КРАСНАЯ     │ Unit C │ │
│ │ 🔴BORDER │    РАМКА       │ 🔴     │ │
│ └──────────┘                └────────┘ │
└────────────────────────────────────────┘
          ↓ exit variant применяется!
          ↓ блоки улетают за края
          ↓ zoom target расширяется
```

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `TreemapContainer.tsx` | Передать `isExitingNode={true}` в nodesForExit loop |
| `TreemapNode.tsx` | 1. Добавить проп `isExitingNode` |
| | 2. Условно убрать `layoutId` для exit non-target |
| | 3. Добавить красную рамку для визуальной идентификации |
| | 4. Добавить console.log для диагностики |

---

## После успешного теста

Если блоки полетят:
1. Убрать красную рамку (debug marker)
2. Оставить логику `shouldDisableLayout`
3. Вернуть нормальные длительности анимаций (3.0s → 0.6s)

