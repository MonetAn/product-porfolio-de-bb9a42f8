

# План: Push-анимация при drill-down в тримапе (финальный)

## Как это работает

При клике на Unit "Fintech":

1. Сохраняем центр кликнутого узла и его `key`
2. Стейт меняется: `selectedUnits=["Fintech"]`, `showTeams=true`
3. Framer Motion видит:
   - `d0-Root/Fintech` остался -- layoutId morphing (растягивается)
   - `d0-Root/UnitB`, `d0-Root/UnitC` исчезли -- exit animation (разлетаются от точки клика)
   - Новые дочерние узлы -- enter animation (fade in)

## Изменения

### 1. `src/components/treemap/TreemapContainer.tsx`

**Добавить стейт:**

```typescript
const [lastClickCenter, setLastClickCenter] = useState<{ x: number; y: number } | null>(null);
const [clickedNodeKey, setClickedNodeKey] = useState<string | null>(null);
```

**Обновить handleNodeClick:**

```typescript
const handleNodeClick = useCallback((node: TreemapLayoutNode) => {
  setLastClickCenter({
    x: node.x0 + node.width / 2,
    y: node.y0 + node.height / 2,
  });
  setClickedNodeKey(node.key);

  if (node.data.isInitiative && onInitiativeClick) {
    onInitiativeClick(node.data.name);
  } else if (onNodeClick) {
    onNodeClick(node.data);
  }
}, [onNodeClick, onInitiativeClick]);
```

**Сбрасывать при filter/navigate-up** (в useLayoutEffect где детектится animationType):

```typescript
if (newAnimationType === 'navigate-up' || newAnimationType === 'filter') {
  setLastClickCenter(null);
  setClickedNodeKey(null);
}
```

**Передать в AnimatePresence и TreemapNode:**

```tsx
<AnimatePresence mode="sync" custom={lastClickCenter}>
  {layoutNodes.map(node => (
    <TreemapNode
      key={node.key}
      node={node}
      animationType={animationType}
      clickCenter={lastClickCenter}
      isHero={node.key === clickedNodeKey}
      containerDimensions={dimensions}
      // ... остальные пропсы без изменений
    />
  ))}
</AnimatePresence>
```

**Overflow: убрать обрезку при drilldown:**

На `ref={containerRef}` div добавить условный стиль:

```tsx
<div
  className="treemap-container"
  ref={containerRef}
  style={{ overflow: animationType === 'drilldown' ? 'visible' : 'hidden' }}
  onMouseLeave={() => handleMouseLeave()}
>
```

---

### 2. `src/components/treemap/TreemapNode.tsx`

**Добавить пропсы:**

```typescript
interface TreemapNodeProps {
  // ... существующие
  clickCenter?: { x: number; y: number } | null;
  isHero?: boolean;
  containerDimensions?: { width: number; height: number };
}
```

**Заменить exit на функцию:**

```typescript
// Было:
exit={{ opacity: 0, scale: 0.92 }}

// Станет:
exit={(() => {
  if (animationType === 'drilldown' && clickCenter && containerDimensions && !isHero) {
    const nodeCenterX = node.x0 + node.width / 2;
    const nodeCenterY = node.y0 + node.height / 2;
    const dx = nodeCenterX - clickCenter.x;
    const dy = nodeCenterY - clickCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = Math.max(containerDimensions.width, containerDimensions.height) * 1.5;

    return {
      x: x + (dx / distance) * force,
      y: y + (dy / distance) * force,
      opacity: 0,
      scale: 0.8,
      transition: { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] },
    };
  }
  return { opacity: 0, scale: 0.92 };
})()}
```

**zIndex для hero:**

```typescript
style={{
  // ... существующие стили
  zIndex: isHero ? 10 : 1,
}}
```

**Прокинуть пропсы в рекурсивные дочерние узлы:**

```tsx
<TreemapNode
  key={child.key}
  node={child}
  animationType={animationType}
  clickCenter={clickCenter}
  isHero={false}
  containerDimensions={containerDimensions}
  // ... остальные пропсы
/>
```

---

## Что изменилось vs предыдущий план

| Изменение | Источник | Почему |
|---|---|---|
| Hero проверяется по `key`, а не по `name` | Gemini | Имена могут дублироваться ("Прочее", "Support") |
| Overflow: visible при drilldown | Gemini | Иначе вылетающие узлы обрезаются границей контейнера |

## Файлы для изменения

| Файл | Изменение |
|---|---|
| `src/components/treemap/TreemapContainer.tsx` | Стейт `lastClickCenter` + `clickedNodeKey`, overflow, передача пропсов |
| `src/components/treemap/TreemapNode.tsx` | Новые пропсы, exit-функция, zIndex |

## Риски

| Риск | Митигация |
|---|---|
| overflow: visible может показать артефакты за пределами контейнера | Overflow включается только на время drilldown анимации |
| Быстрые переключения | Стейт сбрасывается при filter/navigate-up |

## Оценка

| Метрика | Значение |
|---|---|
| Сложность | Средняя |
| Файлов | 2 |
| Риск регрессии | Средний |
