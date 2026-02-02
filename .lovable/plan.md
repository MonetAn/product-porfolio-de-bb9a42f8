
# Итерация 2: Исправление Drilldown анимации

## Диагноз проблемы

**Текущий порядок выполнения (неправильный):**
```text
1. data.name меняется → useEffect срабатывает
2. Ищем clickedNode в prevLayoutNodesRef.current → НЕ НАХОДИМ (пустой или устаревший)
3. zoomTargetInfo = null
4. D3 не получает zoomTarget → делает fade-out вместо push
5. layoutNodes обновляется → prevLayoutNodesRef сохраняется (слишком поздно!)
```

**Требуемый порядок (правильный):**
```text
1. clickedNodeName приходит ДО изменения data.name
2. Сохраняем snapshot prevLayoutNodesRef + zoomTargetInfo
3. data.name меняется → useEffect срабатывает
4. zoomTargetInfo уже готов → D3 получает zoomTarget → делает push-анимацию
```

## Решение

### Изменения в TreemapContainer.tsx

1. **Добавить `exitingNodesRef`** — отдельный ref для хранения нод, которые должны уйти
2. **Изменить порядок эффектов** — сохранять exiting nodes ДО смены данных
3. **Передать `exitingNodes` в D3 layer** — как отдельный prop

```typescript
// Новые refs
const exitingNodesRef = useRef<TreemapLayoutNode[]>([]);
const pendingZoomTargetRef = useRef<ZoomTargetInfo | null>(null);

// КРИТИЧНО: Сохранять exiting nodes при клике, ДО смены данных
useEffect(() => {
  if (clickedNodeName && prevLayoutNodesRef.current.length > 0) {
    // Сохраняем snapshot СЕЙЧАС, пока данные актуальны
    exitingNodesRef.current = [...prevLayoutNodesRef.current];
    
    const clickedNode = prevLayoutNodesRef.current.find(n => n.name === clickedNodeName);
    if (clickedNode) {
      pendingZoomTargetRef.current = {
        key: clickedNode.key,
        name: clickedNode.name,
        x0: clickedNode.x0,
        y0: clickedNode.y0,
        x1: clickedNode.x1,
        y1: clickedNode.y1,
        width: clickedNode.width,
        height: clickedNode.height,
        animationType: 'drilldown',
      };
    }
  }
}, [clickedNodeName]); // Срабатывает РАНЬШЕ, чем смена data.name

// В эффекте определения анимации:
useEffect(() => {
  if (newAnimationType === 'drilldown') {
    // Используем заранее подготовленный zoomTarget
    setZoomTargetInfo(pendingZoomTargetRef.current);
    pendingZoomTargetRef.current = null;
  }
}, [data.name, ...]);
```

### Изменения в TreemapD3Layer.tsx

1. **Добавить prop `exitingNodes`** — ноды для exit-анимации
2. **При drilldown использовать `exitingNodes`** вместо `groups.exit()`

```typescript
interface TreemapD3LayerProps {
  // ... existing
  exitingNodes?: TreemapLayoutNode[]; // НОВЫЙ PROP
}

// В useEffect:
if (animationType === 'drilldown' && zoomTarget && exitingNodes.length > 0) {
  // Создаём временные группы для exiting nodes
  const exitGroups = svg.selectAll<SVGGElement, TreemapLayoutNode>('g.exiting-node')
    .data(exitingNodes, d => d.key);
  
  // Анимируем exit с push
  exitGroups.enter()
    .append('g')
    .attr('class', 'exiting-node')
    // ... рендерим rect и foreignObject ...
    .each(function(d) {
      const isZoomTarget = d.key === zoomTarget.key;
      // ... анимация push или zoom ...
    });
}
```

## Диагностика

Добавлю временные console.log для отладки:
```typescript
console.log('[DRILLDOWN] clickedNodeName changed:', clickedNodeName);
console.log('[DRILLDOWN] prevLayoutNodesRef:', prevLayoutNodesRef.current.length);
console.log('[DRILLDOWN] pendingZoomTarget:', pendingZoomTargetRef.current);
```

## Изменяемые файлы

| Файл | Изменения |
|------|-----------|
| TreemapContainer.tsx | + exitingNodesRef, + pendingZoomTargetRef, изменить порядок эффектов |
| TreemapD3Layer.tsx | + prop exitingNodes, логика exit через exitingNodes |
| types.ts | Нет изменений |

## Оценка

| Аспект | Значение |
|--------|----------|
| Сложность | Средняя |
| Время | 1 итерация |
| Вероятность успеха | 85% |
| Риски | Timing между эффектами может потребовать отладки |

## Ожидаемый результат

После этой итерации:
- При клике на юнит, соседи будут улетать за рамки экрана
- Кликнутый юнит будет расширяться на весь экран
- После завершения анимации появятся вложенные ноды (команды)
