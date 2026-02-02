
# План: Исправление анимации и позиционирования тултипа

## Проблема 1: Мгновенная анимация при переключении галочек

### Диагноз
При включении/выключении галочек "Команды"/"Инициативы":
- `data.name` не меняется (остаётся "Root" или название юнита)
- `useEffect` в TreemapContainer не срабатывает
- `animationType` застревает на `'initial'` (duration = 0)
- Новые/удалённые узлы появляются/исчезают **мгновенно**

### Решение
Добавить отслеживание изменений `showTeams` и `showInitiatives` для определения типа анимации `'filter'`:

```typescript
// TreemapContainer.tsx - добавить в useEffect
const prevShowTeamsRef = useRef(showTeams);
const prevShowInitiativesRef = useRef(showInitiatives);

useEffect(() => {
  // ...existing logic...
  
  // Detect filter change (checkboxes)
  if (prevShowTeamsRef.current !== showTeams || 
      prevShowInitiativesRef.current !== showInitiatives) {
    newAnimationType = 'filter';
  }
  
  prevShowTeamsRef.current = showTeams;
  prevShowInitiativesRef.current = showInitiatives;
  
  // ...
}, [data.name, showTeams, showInitiatives, canNavigateBack, isEmpty, dimensions.width]);
```

---

## Проблема 2: Тултип уезжает за экран

### Диагноз
- Тултип использует `position: fixed`
- Начальная позиция (`left`, `top`) устанавливается только в `useEffect` 
- До срабатывания useEffect тултип рендерится без координат
- CSS `position: fixed` без left/top = браузер ставит куда попало

### Решение
Устанавливать позицию **сразу при рендере** через inline style, а не ждать useEffect:

```typescript
// TreemapTooltip.tsx
const TreemapTooltip = memo(({ data, ... }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Calculate position when data changes
  useLayoutEffect(() => {
    if (!tooltipRef.current || !data) {
      setPosition(null);
      return;
    }
    
    const rect = tooltipRef.current.getBoundingClientRect();
    const padding = 16;
    
    let x = data.position.x + padding;
    let y = data.position.y + padding;
    
    // Flip logic...
    
    setPosition({ x, y });
  }, [data]);
  
  // Apply position directly
  const style: React.CSSProperties = position ? {
    left: position.x,
    top: position.y,
  } : {
    visibility: 'hidden', // Hide until positioned
  };
  
  return (
    <div 
      ref={tooltipRef} 
      className={`treemap-tooltip ${data && position ? 'visible' : ''}`}
      style={style}
      ...
    />
  );
});
```

Ключевое: `visibility: 'hidden'` пока позиция не рассчитана — тултип не "мелькает" в неправильном месте.

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `TreemapContainer.tsx` | Отслеживать `showTeams`/`showInitiatives` для анимации `'filter'` |
| `TreemapTooltip.tsx` | Использовать `useLayoutEffect` + state для позиции, скрывать до расчёта |

---

## Ожидаемый результат

1. При переключении галочек — плавная анимация fade+scale (650ms)
2. Тултип появляется точно рядом с курсором без "прыжков"
3. Тултип не уезжает за экран

---

## Оценка

| Метрика | Значение |
|---------|----------|
| Сложность | Низкая |
| Файлов изменится | 2 |
| Риск регрессии | Минимальный |
