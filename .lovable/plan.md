
# План: Исправление drilldown анимации — "соседи улетают"

## Диагноз причины

Логи консоли показывают **две критические ошибки**:

### Ошибка 1: Поиск по `name` в плоском массиве
```
clickedNodeName: "Data Platform+Core Data" (это Team!)
prevLayoutNodesRef.current: [Unit1, Unit2, Unit3, Unit4] (только Units!)
→ find() не находит → zoomTarget = null → push-анимация не срабатывает
```

Код ищет кликнутый узел среди Units, но кликнули на Team.

### Ошибка 2: `layoutNodes` не содержит вложенные узлы

```typescript
// useTreemapLayout возвращает:
[{ name: "Unit1", children: [...] }, { name: "Unit2", children: [...] }]

// prevLayoutNodesRef.current сохраняет верхний уровень:
prevLayoutNodesRef.current = layoutNodes; // только 4 Units!
```

Но клик может быть на Team или Initiative — их нет в массиве.

---

## Почему у Flourish работает, а у нас нет

| Аспект | Flourish | Наша реализация |
|--------|----------|-----------------|
| **DOM-модель** | Все ноды в одном `<svg>` постоянно | React меняет данные → новые ноды |
| **Анимация exit** | D3 знает старые позиции | Старые ноды удалены до анимации |
| **Хранение state** | D3 хранит в DOM | React хранит в refs (race condition) |
| **Zoom** | Меняет viewport, не данные | Меняет данные → rebuild всего |

**Ключевая разница**: Flourish не "пересоздаёт" treemap при drilldown — он просто зумит viewport и меняет видимость. Мы полностью пересоздаём дерево.

---

## Решение: Исправить хранение и поиск узлов

### Шаг 1: Хранить ВСЕ узлы (с вложенностью)

**Файл**: `TreemapContainer.tsx`

```typescript
// Вместо:
prevLayoutNodesRef.current = layoutNodes;

// Нужно:
function flattenAllNodes(nodes: TreemapLayoutNode[]): TreemapLayoutNode[] {
  const result: TreemapLayoutNode[] = [];
  function traverse(node: TreemapLayoutNode) {
    result.push(node);
    if (node.children) node.children.forEach(traverse);
  }
  nodes.forEach(traverse);
  return result;
}

useEffect(() => {
  if (layoutNodes.length > 0) {
    prevLayoutNodesRef.current = flattenAllNodes(layoutNodes);
  }
}, [layoutNodes]);
```

### Шаг 2: Исправить поиск кликнутого узла

**Файл**: `TreemapContainer.tsx` (строка ~119)

```typescript
// Текущий код (неправильный):
const clickedNode = prevLayoutNodesRef.current.find(n => n.name === clickedNodeName);

// Исправленный код:
// Теперь prevLayoutNodesRef содержит ВСЕ узлы — поиск сработает
const clickedNode = prevLayoutNodesRef.current.find(n => n.name === clickedNodeName);
// Плюс добавить fallback для edge cases:
if (!clickedNode) {
  console.log('[DRILLDOWN] Node not found by name, searching in children...');
  // Дополнительный поиск
}
```

### Шаг 3: Убедиться, что exitingNodes содержит видимые ноды

**Файл**: `TreemapContainer.tsx`

При клике на Unit — exitingNodes должны быть Units (соседи).
При клике на Team — exitingNodes должны быть Teams (соседи внутри Unit).

```typescript
useEffect(() => {
  if (clickedNodeName && prevLayoutNodesRef.current.length > 0) {
    // Сохраняем snapshot
    exitingNodesRef.current = [...prevLayoutNodesRef.current];
    
    // Находим кликнутый узел (теперь он ВСЕГДА найдётся)
    const clickedNode = prevLayoutNodesRef.current.find(n => n.name === clickedNodeName);
    
    if (clickedNode) {
      // Определяем уровень и фильтруем siblings
      const depth = clickedNode.depth;
      exitingNodesRef.current = prevLayoutNodesRef.current.filter(
        n => n.depth === depth && n.parentName === clickedNode.parentName
      );
      // ... prepare zoomTarget
    }
  }
}, [clickedNodeName]);
```

---

## Итерации

### Итерация 1 (текущая): Исправить сохранение узлов
1. Добавить `flattenAllNodes()` 
2. Использовать её при сохранении `prevLayoutNodesRef`
3. Фильтровать `exitingNodesRef` по depth для siblings

### Итерация 2: Проверка и отладка
1. Добавить debug-логи для exitingNodes
2. Проверить что D3 получает корректные данные
3. Исправить edge cases

### Итерация 3: Cleanup
1. Удалить debug-логи
2. Удалить `TreemapNode.tsx`
3. Обновить memory проекта

---

## Оценка

| Аспект | Значение |
|--------|----------|
| Сложность | Средняя |
| Итерации | 2-3 |
| Кредиты | 8-15 |
| Вероятность успеха | **80%** |

### Риски
- **Средний**: Если depth/parentName не заполнены корректно в useTreemapLayout
- **Низкий**: Performance при большом количестве узлов (маловероятно)

### Почему 80%, а не 95%?
Архитектура "React управляет данными" создаёт принципиальное ограничение: мы НЕ можем оставить старые DOM-элементы для анимации — React их удаляет. Решение через exitingNodes — это workaround, а не нативный подход как у Flourish.

---

## Альтернатива: Принять текущую реализацию

Если 2-3 итерации не дадут результата, можно:

1. **Оставить fade-out** — визуально понятно, хоть и не "вытесняет"
2. **Добавить scale-down** — старые ноды уменьшаются (вместо push)
3. **Ускорить переход** — 300ms вместо 600ms, меньше заметен недостаток

Это не "camera zoom" как у Flourish, но приемлемый UX.

---

## Рекомендация

**Продолжить 1-2 итерации** — исправление хранения узлов должно решить проблему. Логи ясно показывают где ошибка (поиск по name не находит Teams/Initiatives).

Если после 2 итераций push-анимация всё ещё не работает — принять альтернативу с fade+scale.

## Шаги диагностики для пользователя

1. Открыть DevTools → Console
2. Кликнуть на Unit (не Team!) — например "FAP"
3. Проверить логи:
   - `[DRILLDOWN] Found clicked node` → хорошо
   - `[D3] Drilldown with exitingNodes: 4` → хорошо
4. Если логов `[D3]` нет — проблема в передаче данных в D3 layer
5. Если логи есть но нет анимации — проблема в D3 transition

## Изменяемые файлы

| Файл | Изменения |
|------|-----------|
| `TreemapContainer.tsx` | flattenAllNodes(), фильтрация siblings |
| `TreemapD3Layer.tsx` | Возможно debug-логи для exitingNodes |
| `types.ts` | Нет изменений |
