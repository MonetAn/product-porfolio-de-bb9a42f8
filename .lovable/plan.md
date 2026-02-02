
# План: Возврат к Framer Motion с чистыми fade-анимациями

## Что сейчас есть

Текущая реализация использует D3 для рендеринга и анимаций с:
- Сложной логикой `exit-layer` / `enter-layer`
- `zoomTargetSnapshot` и `exitingNodesSnapshot` для drilldown push-эффекта
- Race condition между useState и D3 рендерингом
- ~548 строк кода в `TreemapD3Layer.tsx`

## Что будет после рефакторинга

Простая Framer Motion реализация с:
- `AnimatePresence` для enter/exit анимаций
- `layoutId` для плавных transitions позиций
- Только fade-анимации (никакого push-эффекта)
- ~150 строк кода в новом компоненте

---

## Архитектура

```text
┌─────────────────────────────────────────────────────────────────┐
│  TreemapContainer                                               │
│  ├── AnimatePresence                                            │
│  │   └── TreemapNode (для каждого узла с layoutId)              │
│  │       ├── motion.div с позицией и размером                   │
│  │       ├── Контент (название, бюджет)                         │
│  │       └── Вложенные TreemapNode (если есть children)         │
│  └── TreemapTooltip                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Какие анимации останутся

| Тип | Поведение |
|-----|-----------|
| **initial** | Без анимации — блоки появляются сразу |
| **filter** | fade-out уходящих, fade-in новых, плавное перестроение позиций (layoutId) |
| **drilldown** | fade-out старых блоков, fade-in новых |
| **navigate-up** | fade-out + плавное появление родительских блоков |

---

## Файлы для изменения

### 1. Удалить `TreemapD3Layer.tsx` (548 строк)
Этот файл больше не нужен — D3 используется только для расчёта layout в `useTreemapLayout.ts`.

### 2. Переписать `TreemapNode.tsx` (~150 строк)
Упростить до чистого Framer Motion компонента без push-логики:

```typescript
const TreemapNode = memo(({
  node,
  animationType,
  onClick,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  showChildren,
  renderDepth,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const shouldRenderChildren = hasChildren && node.depth < renderDepth - 1;
  
  return (
    <motion.div
      layoutId={node.key}
      initial={{ opacity: 0 }}
      animate={{ 
        opacity: 1,
        x: node.x0,
        y: node.y0,
        width: node.width,
        height: node.height,
      }}
      exit={{ opacity: 0 }}
      transition={{ duration: animationType === 'initial' ? 0 : 0.4 }}
      // ... остальные props
    >
      <TreemapNodeContent node={node} />
      
      {shouldRenderChildren && showChildren && (
        <AnimatePresence mode="sync">
          {node.children!.map(child => (
            <TreemapNode key={child.key} node={child} ... />
          ))}
        </AnimatePresence>
      )}
    </motion.div>
  );
});
```

### 3. Упростить `TreemapContainer.tsx` (~150 строк удалить)

**Удалить:**
- `exitingNodesSnapshot`, `zoomTargetSnapshot` состояния
- `flattenAllNodes` функцию
- useEffect для `clickedNodeName` (строки 120-156)
- `handleAnimationComplete` callback
- Props для `zoomTarget`, `exitingNodes`

**Упростить:**
- useEffect для определения `animationType` — простая логика без snapshot

**Заменить:**
- `<TreemapD3Layer>` на рендеринг `<TreemapNode>` компонентов через `AnimatePresence`

### 4. Обновить `types.ts`

**Удалить:**
- `ZoomTargetInfo` interface
- `ExitDirection` interface

### 5. Обновить `index.ts`

**Удалить:**
- Экспорт `TreemapD3Layer`

---

## Структура нового TreemapContainer

```typescript
const TreemapContainer = ({ data, showTeams, showInitiatives, ... }) => {
  const [animationType, setAnimationType] = useState<AnimationType>('initial');
  const prevDataNameRef = useRef<string | null>(null);
  const isFirstRenderRef = useRef(true);
  
  // Compute layout (без изменений)
  const layoutNodes = useTreemapLayout({ data, dimensions, showTeams, showInitiatives, getColor });
  
  // Определение типа анимации (упрощённо)
  useEffect(() => {
    if (isEmpty) return;
    
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      setAnimationType('initial');
    } else if (prevDataNameRef.current !== data.name) {
      setAnimationType(canNavigateBack ? 'drilldown' : 'navigate-up');
    } else {
      setAnimationType('filter');
    }
    
    prevDataNameRef.current = data.name;
  }, [data.name, canNavigateBack, isEmpty, layoutNodes]);
  
  // Рендеринг
  return (
    <div ref={containerRef} className="treemap-container">
      <AnimatePresence mode="sync">
        {layoutNodes.map(node => (
          <TreemapNode
            key={node.key}
            node={node}
            animationType={animationType}
            onClick={handleNodeClick}
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            showChildren={true}
            renderDepth={renderDepth}
          />
        ))}
      </AnimatePresence>
      
      <TreemapTooltip ... />
      {/* Empty states... */}
    </div>
  );
};
```

---

## Итоговая разница в коде

| Файл | Было | Станет | Разница |
|------|------|--------|---------|
| `TreemapD3Layer.tsx` | 548 строк | **Удалён** | -548 |
| `TreemapNode.tsx` | 482 строки | ~150 строк | -332 |
| `TreemapContainer.tsx` | 371 строка | ~220 строк | -151 |
| `types.ts` | 87 строк | ~60 строк | -27 |
| **Итого** | | | **-1058 строк** |

---

## Критерии готовности

1. Никаких прозрачных/пропадающих блоков при любых фильтрах
2. Плавный fade-out/fade-in при drilldown и navigate-up
3. Плавные transitions позиций при изменении фильтров (благодаря layoutId)
4. Корректная работа при быстром переключении фильтров
5. Никаких console warnings/errors

---

## Оценка

| Метрика | Значение |
|---------|----------|
| Сложность | Низкая |
| Удаление кода | ~1000+ строк |
| Стабильность | Высокая |
| Вероятность успеха | 95% |
