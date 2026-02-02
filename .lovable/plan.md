
# План: Надёжная логика тултипа с приоритетом по глубине

## Корневая причина

При быстром движении курсора на вложенные элементы браузер генерирует несколько `mouseEnter` событий синхронно (для всей цепочки Parent → Child → Grandchild). Текущая логика с `requestAnimationFrame` и `cancelAnimationFrame` не гарантирует, что победит самый глубокий элемент, потому что:
- Все события обновляют `hoveredNodeRef.current` в одном JS-тике
- rAF callback видит только последнее записанное значение
- Порядок событий зависит от порядка рендера DOM, а не от глубины

## Решение: Дебаунс + сравнение глубины

### A) Отслеживать глубину текущего hovered элемента

```typescript
// TreemapContainer.tsx - добавить ref для глубины
const hoveredDepthRef = useRef<number>(-1);
```

### B) Обновлять тултип только если пришёл более глубокий элемент

```typescript
const handleMouseEnter = useCallback((e: React.MouseEvent, node: TreemapLayoutNode) => {
  // Проверяем глубину - игнорируем родителей если уже есть более глубокий
  if (hoveredDepthRef.current >= 0 && node.depth < hoveredDepthRef.current) {
    return; // Игнорируем родительские события
  }
  
  // Обновляем ref-ы синхронно
  hoveredNodeRef.current = node;
  hoveredDepthRef.current = node.depth;
  
  // Отменяем предыдущий запланированный апдейт
  if (tooltipUpdateRef.current !== null) {
    cancelAnimationFrame(tooltipUpdateRef.current);
  }
  
  // Планируем обновление UI
  tooltipUpdateRef.current = requestAnimationFrame(() => {
    if (hoveredNodeRef.current === node) {
      setTooltipData({
        node,
        position: { x: e.clientX, y: e.clientY },
      });
    }
    tooltipUpdateRef.current = null;
  });
}, []);
```

### C) Сбрасывать глубину при выходе из контейнера

```typescript
const handleMouseLeave = useCallback(() => {
  if (tooltipUpdateRef.current !== null) {
    cancelAnimationFrame(tooltipUpdateRef.current);
    tooltipUpdateRef.current = null;
  }
  hoveredNodeRef.current = null;
  hoveredDepthRef.current = -1;  // Сбрасываем глубину
  setTooltipData(null);
}, []);
```

### D) Альтернативный подход: Дебаунс с setTimeout

Если rAF недостаточно, использовать короткий `setTimeout` (5-10ms):

```typescript
const tooltipTimeoutRef = useRef<number | null>(null);

const handleMouseEnter = useCallback((e: React.MouseEvent, node: TreemapLayoutNode) => {
  // Синхронно обновляем refs (всегда перезаписываем, последний побеждает)
  hoveredNodeRef.current = node;
  
  // Отменяем предыдущий таймаут
  if (tooltipTimeoutRef.current !== null) {
    clearTimeout(tooltipTimeoutRef.current);
  }
  
  // Планируем обновление через 5ms - гарантирует что все sync события пройдут
  tooltipTimeoutRef.current = window.setTimeout(() => {
    if (hoveredNodeRef.current === node) {
      setTooltipData({
        node,
        position: { x: e.clientX, y: e.clientY },
      });
    }
    tooltipTimeoutRef.current = null;
  }, 5);
}, []);
```

---

## Рекомендация

**Комбинация двух подходов**:
1. Проверка глубины (`depth`) — игнорировать родительские события, если уже зафиксирован более глубокий элемент
2. Короткий setTimeout (5ms) вместо rAF — даёт время всем синхронным событиям отработать

Это гарантирует, что при быстром наведении на вложенные элементы:
- Если курсор попадает на инициативу — показывается инициатива
- Если курсор попадает на шапку/паддинг команды (пустое место) — показывается команда
- Если курсор попадает на шапку/паддинг юнита — показывается юнит

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/treemap/TreemapContainer.tsx` | Добавить `hoveredDepthRef`, изменить логику `handleMouseEnter` с проверкой глубины и дебаунсом через setTimeout |

---

## Логика после изменений

```text
Сценарий: Курсор быстро входит в область Initiative (внутри Unit)

1. mouseEnter(Unit, depth=0) → hoveredDepthRef = 0, запланирован setTimeout
2. mouseEnter(Team, depth=1) → depth(1) > hoveredDepthRef(0) → hoveredDepthRef = 1, отменён старый timeout, запланирован новый
3. mouseEnter(Initiative, depth=2) → depth(2) > hoveredDepthRef(1) → hoveredDepthRef = 2, отменён старый timeout, запланирован новый
4. setTimeout (5ms) → проверка: hoveredNodeRef === Initiative? → ДА → показываем тултип Initiative

Результат: Всегда показывается самый глубокий элемент ✓
```

---

## Альтернативное решение: pointer-events: none на родителях

Если хотим полностью исключить родительские события (НЕ рекомендуется, т.к. тогда клик по шапке юнита не будет работать):

```typescript
// В TreemapNode.tsx - отключить события на родителях при наличии детей
style={{
  pointerEvents: hasChildren && showChildren ? 'none' : 'auto',
  // ... остальные стили
}}
```

Но это сломает drill-down при клике на заголовок юнита.

---

## Оценка

| Метрика | Значение |
|---------|----------|
| Сложность | Низкая |
| Файлов изменится | 1 |
| Риск регрессии | Низкий |
| Надёжность решения | Высокая (детерминированная логика вместо race condition) |
