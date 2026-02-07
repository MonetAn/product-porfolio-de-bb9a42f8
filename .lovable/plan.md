
# Исправить 3 бага анимации treemap

## Корневые причины

### Баг 1: "Инициативы" показывает команды
Дерево теперь всегда строится полным (Unit > Team > Initiative). Но `useTreemapLayout` до сих пор использует `showTeams`/`showInitiatives` для расчёта `renderDepth`, ограничивая глубину `flattenHierarchy`. При `showInitiatives=true, showTeams=false` renderDepth=2, что показывает depth 0 (units) и depth 1 (teams), а не инициативы.

### Баг 2: Зависание при быстрых кликах
Убрана защита `isZooming` (была в CSS zoom подходе). Каждый клик ставит `setFocusedPath`, вызывая пересчёт layout. Быстрые клики создают каскад пересчётов. Плюс `useEffect` на `data` сбрасывает `focusedPath` в `[]`, что может вызвать цикл.

### Баг 3: Зум не работает с включёнными чекбоксами
Связан с багом 1. Layout hook вычисляет позиции только до глубины 2, поэтому `findNodeByPath` находит узел, но его children не включены в layout nodes. Framer Motion не может анимировать то, что не вычислено.

## Решение

### 1. `src/components/treemap/useTreemapLayout.ts`

Убрать `showTeams`/`showInitiatives` из расчёта `renderDepth`. Всегда вычислять layout на полную глубину дерева (3 + extraDepth). Визуальный контроль глубины — только через `renderDepth` в `TreemapNode`.

```text
// Было:
let renderDepth = 1;
if (showTeams && showInitiatives) renderDepth = 3;
else if (showTeams) renderDepth = 2;
else if (showInitiatives) renderDepth = 2;

// Станет:
const renderDepth = 3 + extraDepth; // Always compute full depth
```

Убрать `showTeams` и `showInitiatives` из интерфейса и из зависимостей `useMemo`.

### 2. `src/components/treemap/TreemapContainer.tsx`

**RenderDepth**: Поскольку дерево всегда полное, чекбокс "инициативы" без "команды" должен показывать все 3 уровня (units + teams + initiatives):

```text
// Было:
let depth = 1;
if (showTeams && showInitiatives) depth = 3;
else if (showTeams || showInitiatives) depth = 2;

// Станет:
let depth = 1;
if (showInitiatives) depth = 3;  // initiatives implies teams visible
else if (showTeams) depth = 2;
```

**Защита от быстрых кликов**: Добавить `isAnimating` ref с таймером:

```text
const isAnimatingRef = useRef(false);

const handleNodeClick = useCallback((node) => {
  if (isAnimatingRef.current) return; // Блокировать клики во время анимации
  
  // ... existing logic ...
  
  isAnimatingRef.current = true;
  setTimeout(() => { isAnimatingRef.current = false; }, 700);
}, [...]);
```

**Сброс focusedPath**: Использовать стабильную ссылку на `data` вместо объекта:

```text
// Было (вызывает сброс при каждом ре-рендере из-за нового объекта):
useEffect(() => { setFocusedPath([]); }, [data]);

// Станет (сброс только при реальной смене корня):
const dataIdRef = useRef(data.name + (data.children?.length || 0));
useEffect(() => {
  const newId = data.name + (data.children?.length || 0);
  if (dataIdRef.current !== newId) {
    dataIdRef.current = newId;
    setFocusedPath([]);
  }
}, [data]);
```

### 3. Файлы

| Файл | Что меняется |
|---|---|
| `src/components/treemap/useTreemapLayout.ts` | Убрать showTeams/showInitiatives, всегда full depth |
| `src/components/treemap/TreemapContainer.tsx` | Исправить renderDepth, добавить isAnimating guard, стабильный сброс focusedPath |
