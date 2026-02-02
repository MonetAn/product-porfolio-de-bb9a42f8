
# План: Исправление тултипа при быстром наведении на вложенные элементы

## Проблема

При быстром перемещении курсора с родительского элемента (Unit) на дочерний (Initiative), тултип показывает данные родителя вместо дочернего из-за race condition между событиями `mouseEnter` и `mouseLeave`.

**Последовательность событий:**
```text
1. Курсор на FAP → tooltip = FAP
2. Курсор быстро на инициативу внутри FAP:
   - onMouseLeave(FAP) → setTooltipData(null)
   - onMouseEnter(initiative) → setTooltipData(initiative)
3. React batching может нарушить порядок
```

---

## Решение

Использовать **отложенный сброс тултипа** с проверкой актуальности:

### A) Добавить ref для отслеживания текущего hovered node

```typescript
// В TreemapContainer.tsx
const hoveredNodeRef = useRef<TreemapLayoutNode | null>(null);
```

### B) Изменить handleMouseEnter

```typescript
const handleMouseEnter = useCallback((e: React.MouseEvent, node: TreemapLayoutNode) => {
  hoveredNodeRef.current = node;  // Запоминаем текущий node
  setTooltipData({
    node,
    position: { x: e.clientX, y: e.clientY },
  });
}, []);
```

### C) Изменить handleMouseLeave с задержкой

```typescript
const handleMouseLeave = useCallback(() => {
  hoveredNodeRef.current = null;
  
  // Отложенный сброс - даём время на mouseEnter дочернего
  setTimeout(() => {
    // Сбрасываем только если никто новый не появился
    if (hoveredNodeRef.current === null) {
      setTooltipData(null);
    }
  }, 10);  // Минимальная задержка для race condition
}, []);
```

### D) Альтернатива: Использовать pointer-events на контейнере

Добавить общий `onMouseLeave` на весь контейнер treemap, а не на каждый node:

```typescript
// TreemapContainer.tsx
<div 
  className="treemap-container" 
  ref={containerRef}
  onMouseLeave={() => setTooltipData(null)}  // Только при выходе из всего контейнера
>
```

И убрать `onMouseLeave` из отдельных nodes — тогда `mouseEnter` будет просто перезаписывать tooltip данными нового node.

---

## Рекомендуемое решение: Вариант D (контейнерный onMouseLeave)

Это самое простое и надёжное решение:

### Изменения в TreemapNode.tsx

```typescript
// Убрать onMouseLeave с отдельных nodes
onMouseEnter={(e) => {
  e.stopPropagation();
  onMouseEnter?.(e, node);
}}
onMouseMove={onMouseMove}
// onMouseLeave убираем отсюда
```

### Изменения в TreemapContainer.tsx

```typescript
// Добавить onMouseLeave на контейнер
<div 
  className="treemap-container" 
  ref={containerRef}
  onMouseLeave={handleMouseLeave}
>
```

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/treemap/TreemapNode.tsx` | Убрать передачу `onMouseLeave` в дочерние nodes, убрать `onMouseLeave` с motion.div |
| `src/components/treemap/TreemapContainer.tsx` | Добавить `onMouseLeave` на контейнер `div`, передавать `undefined` для `onMouseLeave` в TreemapNode |

---

## Логика после изменений

```text
1. Курсор на FAP → onMouseEnter(FAP) → tooltip = FAP
2. Курсор на инициативу → onMouseEnter(initiative) → tooltip = initiative (перезапись)
3. Курсор выходит из всего treemap → onMouseLeave контейнера → tooltip = null
```

**Преимущества:**
- Нет race condition между enter/leave
- Простая и понятная логика
- Минимальные изменения кода

---

## Оценка

| Метрика | Значение |
|---------|----------|
| Сложность | Низкая |
| Файлов изменится | 2 |
| Риск регрессии | Низкий |
| Время реализации | ~5 минут |
