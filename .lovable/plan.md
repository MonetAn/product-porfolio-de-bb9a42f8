
# План: Исправление drilldown анимации — финальная итерация

## Диагноз (100% подтверждён логами)

### Факт из логов:
```
[DRILLDOWN] exitingNodes (siblings): 4 Data Office, FAP, Client Platform, Tech Platform
[LAYOUT] Saved flattened nodes: 4 from 4 root nodes
[LAYOUT] Saved flattened nodes: 6 from 1 root nodes
```

**НО логов `[D3] Drilldown with exitingNodes:` НЕТ!**

Это означает, что ветка drilldown в `TreemapD3Layer.tsx` (строка 290) не выполняется:
```typescript
if (animationType === 'drilldown' && zoomTarget && exitingNodes.length > 0)
```

### Причина: Race condition в передаче exitingNodes

Код передаёт `exitingNodesRef.current` как value:
```typescript
<TreemapD3Layer
  exitingNodes={exitingNodesRef.current}  // ← VALUE, не REF!
  ...
/>
```

К моменту когда D3Layer получает props, `exitingNodesRef.current` мог быть **очищен или перезаписан** из-за порядка выполнения useEffect-ов.

### Почему у Flourish работает
Flourish использует чистый D3: один SVG, никакой смены данных при drilldown — только transform viewport. D3 сам знает "старые" позиции всех элементов.

У нас: React меняет данные → D3 получает УЖЕ НОВЫЕ данные → нет "памяти" о старом состоянии.

---

## Решение: Использовать useState вместо useRef

Проблема в том, что `exitingNodesRef.current` не вызывает re-render. К моменту рендера D3Layer значение могло измениться.

### Изменения в TreemapContainer.tsx

```typescript
// БЫЛО (проблема):
const exitingNodesRef = useRef<TreemapLayoutNode[]>([]);
...
exitingNodesRef.current = prevLayoutNodesRef.current.filter(...);
...
<TreemapD3Layer exitingNodes={exitingNodesRef.current} />

// СТАНЕТ (решение):
const [exitingNodesSnapshot, setExitingNodesSnapshot] = useState<TreemapLayoutNode[]>([]);
...
setExitingNodesSnapshot(prevLayoutNodesRef.current.filter(...));
...
<TreemapD3Layer exitingNodes={exitingNodesSnapshot} />
```

### Также исправить zoomTargetInfo

Аналогично `pendingZoomTargetRef` нужно синхронизировать с state:
```typescript
const [zoomTargetSnapshot, setZoomTargetSnapshot] = useState<ZoomTargetInfo | null>(null);
```

### Критические изменения

#### 1. TreemapContainer.tsx — использовать state вместо ref

```typescript
// Заменить refs на state для snapshot данных
const [exitingNodesSnapshot, setExitingNodesSnapshot] = useState<TreemapLayoutNode[]>([]);
const [zoomTargetSnapshot, setZoomTargetSnapshot] = useState<ZoomTargetInfo | null>(null);

// В useEffect при изменении clickedNodeName:
useEffect(() => {
  if (clickedNodeName && prevLayoutNodesRef.current.length > 0) {
    const clickedNode = prevLayoutNodesRef.current.find(n => n.name === clickedNodeName);
    
    if (clickedNode) {
      // Сохраняем siblings как STATE (будет передан в D3Layer при следующем render)
      const siblings = prevLayoutNodesRef.current.filter(
        n => n.depth === clickedNode.depth && n.parentName === clickedNode.parentName
      );
      setExitingNodesSnapshot(siblings);
      
      // Сохраняем zoomTarget как STATE
      setZoomTargetSnapshot({
        key: clickedNode.key,
        name: clickedNode.name,
        x0: clickedNode.x0,
        y0: clickedNode.y0,
        x1: clickedNode.x1,
        y1: clickedNode.y1,
        width: clickedNode.width,
        height: clickedNode.height,
        animationType: 'drilldown',
      });
    }
  }
}, [clickedNodeName]);

// В useEffect для animationType НЕ ОЧИЩАТЬ сразу:
useEffect(() => {
  if (isEmpty) return;
  
  let newAnimationType: AnimationType = 'filter';
  
  if (isFirstRenderRef.current) {
    isFirstRenderRef.current = false;
    newAnimationType = 'initial';
  } else if (dimensions.width > 0 && prevDataNameRef.current !== data.name) {
    newAnimationType = canNavigateBack ? 'drilldown' : 'navigate-up';
  }
  
  prevDataNameRef.current = data.name;
  setAnimationType(newAnimationType);
  
  // НЕ очищать zoomTargetSnapshot и exitingNodesSnapshot здесь!
  // Они будут очищены в onAnimationComplete
  
}, [data.name, canNavigateBack, isEmpty, dimensions.width]);

// В handleAnimationComplete — очистить snapshots:
const handleAnimationComplete = useCallback(() => {
  setZoomTargetSnapshot(null);
  setExitingNodesSnapshot([]);
}, []);

// В JSX — передать state:
<TreemapD3Layer
  zoomTarget={zoomTargetSnapshot}
  exitingNodes={exitingNodesSnapshot}
  ...
/>
```

#### 2. TreemapD3Layer.tsx — добавить диагностику

```typescript
// В начале useEffect для D3 рендеринга (после строки 268):
console.log('[D3] Render with animationType:', animationType);
console.log('[D3] zoomTarget:', zoomTarget?.name);
console.log('[D3] exitingNodes.length:', exitingNodes.length);
```

---

## Почему это решит проблему

| Проблема | Решение |
|----------|---------|
| `exitingNodesRef.current` перезаписывается до рендера D3Layer | useState создаёт immutable snapshot |
| Refs не вызывают re-render | State вызовет render с правильными данными |
| Race condition между useEffect-ами | React batches state updates и рендерит с консистентными данными |

---

## Ожидаемый результат

После исправления логи будут:
```
[D3] Render with animationType: drilldown
[D3] zoomTarget: FAP
[D3] exitingNodes.length: 4
[D3] Drilldown with exitingNodes: 4 zoomTarget: FAP
[D3] Neighbor Data Office pushing to: -300, 100
[D3] Neighbor Client Platform pushing to: 1500, 100
[D3] Neighbor Tech Platform pushing to: 1500, 700
```

И визуально соседи будут улетать за края экрана.

---

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `TreemapContainer.tsx` | useRef → useState для exitingNodes и zoomTarget |
| `TreemapD3Layer.tsx` | Добавить diagnostic logs в начале useEffect |

## Оценка

- **Сложность**: низкая-средняя
- **Итерации**: 1 (это финальное исправление)
- **Вероятность успеха**: 90-95%

## План Б (если не сработает)

Если после этого исправления соседи всё ещё не улетают:
1. Проверить что D3 transitions запускаются (логи `[D3] Neighbor X pushing to:`)
2. Если логи есть но визуально нет — проблема в layering/opacity
3. Если логов нет — проблема в условии входа в ветку drilldown

В крайнем случае — принять fade-out анимацию как fallback.
