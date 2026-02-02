
# План: Исправление D3 Treemap (названия + анимации)

## Проблемы выявленные при анализе

### Проблема 1: Потеряны названия юнитов/команд при вложенности
**Причина**: В D3 layer контент центрируется (`justify-content: center`), нет логики "sticky header" для узлов с детьми.

**Решение**: 
- Если у узла есть `children` → рендерить label как **header вверху** (position: absolute, top: 0)
- Если узел leaf → рендерить по центру как сейчас

### Проблема 2: Drilldown анимация не срабатывает
**Причина**: Race condition в `TreemapContainer.tsx`:
- `prevLayoutNodesRef.current` обновляется в `useEffect` после рендера
- К моменту exit-анимации, D3 уже получил новые данные
- `zoomTarget.key` не находится среди exiting nodes (разные ключи)

**Решение**:
- Хранить snapshot предыдущих узлов ДО изменения данных
- Передавать в D3 layer как отдельный prop `exitingNodes`
- D3 сначала анимирует exit старых узлов, потом enter новых

## Итерации

### Итерация 1 (текущая): Header для вложенных узлов
1. Изменить `TreemapD3Layer.tsx`:
   - Если `d.children && d.children.length > 0` → header вверху
   - Если leaf → контент по центру
   
### Итерация 2: Исправление drilldown анимации
1. Изменить `TreemapContainer.tsx`:
   - Хранить `exitingNodesRef` отдельно
   - Обновлять его ПЕРЕД изменением `layoutNodes`
   - Передавать в `TreemapD3Layer` как prop
2. Изменить `TreemapD3Layer.tsx`:
   - При drilldown: сначала анимировать exit из `exitingNodes`, потом enter новых
   - Добавить диагностические логи

### Итерация 3: Polish и cleanup
1. Удалить debug-код из `TreemapNode.tsx`
2. Удалить сам `TreemapNode.tsx` (deprecated)
3. Тонкая настройка timing и easing

## Оценка

| Аспект | Значение |
|--------|----------|
| Оставшиеся итерации | 2-3 |
| Кредиты | 8-15 |
| Вероятность успеха push-анимации | 80-85% |

## Риски
- **Средний**: Timing между exit и enter может потребовать отладки
- **Низкий**: Визуальные отличия header-ов от старого Framer Motion кода

## Технические детали

### Изменения в TreemapD3Layer.tsx для header:
```typescript
.html(d => {
  const hasChildren = d.children && d.children.length > 0;
  
  if (hasChildren) {
    // Header style for parent nodes
    return `<div style="
      position: absolute;
      top: 4px;
      left: 8px;
      right: 8px;
      font-weight: 600;
      color: white;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    ">${d.name}</div>`;
  }
  
  // Centered content for leaf nodes
  return `<div style="...centered...">${d.name}</div>`;
})
```

### Изменения в TreemapContainer.tsx для exit tracking:
```typescript
// Новый ref для хранения exiting nodes
const exitingNodesRef = useRef<TreemapLayoutNode[]>([]);

// При смене данных - сохранить текущие как exiting
useEffect(() => {
  if (prevDataNameRef.current !== data.name) {
    exitingNodesRef.current = prevLayoutNodesRef.current;
  }
}, [data.name]);

// Передать в D3 layer
<TreemapD3Layer
  exitingNodes={exitingNodesRef.current}
  ...
/>
```
