
# Итерация 2: Исправление Drilldown анимации

## Статус: ✅ ВЫПОЛНЕНО

## Что было сделано

### TreemapContainer.tsx
1. **Добавлены новые refs:**
   - `exitingNodesRef` — хранит snapshot узлов до смены данных
   - `pendingZoomTargetRef` — хранит информацию о кликнутом узле

2. **Изменен порядок эффектов:**
   - Первый `useEffect` срабатывает на `clickedNodeName` — захватывает snapshot ДО смены данных
   - Второй `useEffect` срабатывает на `data.name` — использует уже подготовленный zoomTarget

3. **Передача exitingNodes в D3:**
   - Добавлен prop `exitingNodes={exitingNodesRef.current}`

### TreemapD3Layer.tsx
1. **Новый prop `exitingNodes`:**
   ```typescript
   exitingNodes?: TreemapLayoutNode[];
   ```

2. **Логика drilldown через exitingNodes:**
   - При `animationType === 'drilldown'` создаём временные группы из `exitingNodes`
   - Кликнутый узел (zoom target) расширяется на весь экран
   - Соседи "улетают" за границы экрана по edge-based push логике

3. **Добавлены debug-логи:**
   - `[DRILLDOWN] clickedNodeName changed`
   - `[D3] Drilldown with exitingNodes`

## Ожидаемый результат

При клике на юнит:
1. Соседние юниты улетают за границы экрана (push-анимация)
2. Кликнутый юнит расширяется на весь экран
3. После завершения анимации появляются вложенные команды

## Следующие шаги (Итерация 3)

1. Удалить debug console.log
2. Удалить deprecated `TreemapNode.tsx`
3. Тонкая настройка easing и timing
4. Обновить память проекта

## Диагностика

Откройте консоль браузера и посмотрите логи при клике на юнит:
- `[DRILLDOWN] clickedNodeName changed: <имя юнита>`
- `[DRILLDOWN] prevLayoutNodesRef has nodes: <число>`
- `[D3] Drilldown with exitingNodes: <число> zoomTarget: <имя>`

Если логи не появляются — проблема в передаче `clickedNodeName` из родительского компонента.
