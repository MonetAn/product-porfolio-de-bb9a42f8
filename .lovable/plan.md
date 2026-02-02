
# План: Исправление приоритета дочерних элементов при быстром наведении

## Диагноз проблемы

Текущая логика корректна **теоретически**, но на практике возникает race condition из-за особенностей браузера:

### Сценарий проблемы

```text
Курсор быстро входит в область Child (внутри Parent)

Ожидание:
1. mouseEnter(Parent) → depth=0
2. mouseEnter(Child) → depth=1 > 0 → Child побеждает ✓

Реальность (при быстром движении):
1. mouseEnter(Parent) → depth=0, setTimeout запланирован
2. mouseEnter(Child) → НЕ СРАБАТЫВАЕТ (курсор "перепрыгнул" или событие не успело)
3. setTimeout → показывает Parent ✗
```

### Корневая причина

Браузер может **не генерировать mouseEnter** на дочернем элементе, если:
- Курсор движется слишком быстро
- Между событиями прошло слишком мало времени
- Дочерний элемент слишком маленький

### Дополнительная проблема: Event Bubbling

События `mouseEnter` **не bubble** (это non-bubbling event), но `mouseover` — bubble. Возможно, нужно использовать `mouseover` + `target` для точного определения.

---

## Решение: Использовать `mouseover` с проверкой `e.target`

`mouseover` bubbles от самого глубокого элемента вверх, что гарантирует получение события от правильного элемента.

### A) Изменить TreemapNode — использовать onMouseOver вместо onMouseEnter

```typescript
// TreemapNode.tsx
onMouseOver={(e) => {
  e.stopPropagation(); // Предотвращаем bubbling к родителям
  onMouseEnter?.(e, node);
}}
```

### B) Убрать проверку глубины — не нужна с stopPropagation

Если `stopPropagation()` корректно останавливает bubbling, проверка глубины становится избыточной. Самый глубокий элемент получает событие первым и останавливает его.

```typescript
// TreemapContainer.tsx - упрощённый handleMouseEnter
const handleMouseEnter = useCallback((e: React.MouseEvent, node: TreemapLayoutNode) => {
  hoveredNodeRef.current = node;
  hoveredDepthRef.current = node.depth;

  // Скрыть старый тултип мгновенно
  setTooltipData(prev => (prev && prev.node.key !== node.key ? null : prev));
  
  // Отменить предыдущий timeout
  if (tooltipTimeoutRef.current !== null) {
    clearTimeout(tooltipTimeoutRef.current);
  }
  
  // Показать новый тултип с небольшой задержкой
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

### C) Аналогично для onMouseOut вместо onMouseLeave

`mouseout` bubbles, `mouseleave` — нет. Но здесь сложнее, т.к. `mouseout` срабатывает при переходе на дочерний элемент.

Лучше оставить `onMouseLeave` на ноде как есть — он уже работает корректно.

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `TreemapNode.tsx` | Заменить `onMouseEnter` на `onMouseOver` с `stopPropagation()` |
| `TreemapContainer.tsx` | Убрать проверку глубины (станет не нужна) |

---

## Почему `mouseover` + `stopPropagation` лучше

| Аспект | `mouseEnter` | `mouseover` + stopPropagation |
|--------|--------------|-------------------------------|
| Bubbling | Не bubbles | Bubbles (но мы останавливаем) |
| Порядок | Зависит от DOM | Сначала самый глубокий элемент |
| Надёжность | Может "пропустить" элементы | Гарантированно срабатывает |
| Быстрое движение | Проблемы | Надёжно |

---

## Альтернативное решение: Pointer Capture

Более "тяжёлое" решение — использовать `setPointerCapture` для "захвата" курсора на конкретном элементе. Но это избыточно для нашего случая.

---

## Итоговый flow

```text
Сценарий: Курсор быстро входит в область Child

1. mouseover срабатывает на Child (самый глубокий)
2. stopPropagation() — событие не доходит до Parent
3. handleMouseEnter получает Child
4. setTimeout → показывает тултип Child ✓

Результат: Всегда показывается самый глубокий элемент
```

---

## Техническая реализация

### TreemapNode.tsx

```typescript
// Заменить onMouseEnter на onMouseOver
<motion.div
  ...
  onMouseOver={(e) => {
    e.stopPropagation();
    onMouseEnter?.(e, node);
  }}
  onMouseMove={onMouseMove}
  onMouseLeave={(e) => {
    e.stopPropagation();
    onMouseLeave?.(node);
  }}
>
```

### TreemapContainer.tsx

```typescript
// Убрать проверку глубины — теперь не нужна
const handleMouseEnter = useCallback((e: React.MouseEvent, node: TreemapLayoutNode) => {
  // Обновляем refs синхронно
  hoveredNodeRef.current = node;
  hoveredDepthRef.current = node.depth;

  // Скрыть старый тултип мгновенно если это другая нода
  setTooltipData(prev => (prev && prev.node.key !== node.key ? null : prev));
  
  // Отменить предыдущий запланированный апдейт
  if (tooltipTimeoutRef.current !== null) {
    clearTimeout(tooltipTimeoutRef.current);
  }
  
  // Показать новый тултип через 5ms
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

## Оценка

| Метрика | Значение |
|---------|----------|
| Сложность | Низкая |
| Файлов изменится | 2 |
| Риск регрессии | Минимальный |
| Надёжность | Высокая — использует гарантированный порядок событий браузера |
