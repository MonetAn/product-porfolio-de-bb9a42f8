
# План: Переход на D3 Transitions для анимаций Treemap

## Резюме
Переписать анимации treemap с Framer Motion на D3 transitions — **промышленный стандарт** для таких визуализаций (Flourish, Observable, DataWrapper используют этот подход).

---

## Оценка объёма работ

### Количество итераций: **4–6 итераций**

| Этап | Итерации | Описание |
|------|----------|----------|
| 1. Подготовка | 1 | Рефакторинг структуры, создание нового компонента |
| 2. Базовый рендеринг | 1 | D3 рендеринг прямоугольников без анимаций |
| 3. Drilldown анимация | 1–2 | Target zoom + соседи улетают |
| 4. Navigate-up + Filter | 1 | Обратная анимация + фильтрация |
| 5. Polish + Cleanup | 1 | Удаление старого кода, финальная отладка |

### Примерное количество кредитов: **15–25 кредитов**
(зависит от количества корректировок и отладки)

---

## Риски и их митигация

### Риск 1: Потеря интерактивности (tooltip, hover) — **Средний**
**Проблема**: D3 рендерит напрямую в DOM, React не контролирует элементы
**Митигация**: 
- Сохраним React для container, tooltip, back-button
- D3 управляет только `<rect>` элементами внутри `<svg>`
- Event handlers через D3 `.on('mouseenter', ...)` пробрасывают в React state

### Риск 2: Потеря существующей функциональности — **Низкий**
**Проблема**: Сложная логика (вложенные ноды, цвета, off-track индикатор)
**Митигация**:
- Сохраним `useTreemapLayout.ts` — он уже вычисляет D3 layout
- Переиспользуем `types.ts`, `TreemapTooltip.tsx`
- Меняем только слой "рендеринга + анимации"

### Риск 3: Визуальные различия (шрифты, padding) — **Низкий**
**Проблема**: SVG text vs DOM text могут отличаться
**Митигация**: Можем использовать `<foreignObject>` для HTML-контента внутри SVG, либо рендерить labels как DOM overlay поверх SVG

### Риск 4: Время на отладку exit-анимаций — **Средний**
**Проблема**: D3 `.exit().transition()` требует аккуратной работы с data joins
**Митигация**: 
- Используем паттерн "general update pattern" от Майка Бостока
- Ключевание по `node.key` (уже есть!)

---

## Архитектура решения

```text
┌─────────────────────────────────────────────────────────────┐
│                    TreemapContainer.tsx                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  React: Container, Tooltip, Back Button, Empty State    ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    TreemapD3Layer.tsx                   ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │           <svg ref={svgRef}>                        │││
│  │  │   D3 manages: rect elements, transitions, text      │││
│  │  │   Events → React callbacks (onClick, onHover)       │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │  useTreemapLayout.ts (БЕЗ ИЗМЕНЕНИЙ)                    ││
│  │  D3 hierarchy + treemap layout calculation              ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Детальный план по этапам

### Этап 1: Подготовка (1 итерация)
**Файлы:**
- Создать `src/components/treemap/TreemapD3Layer.tsx`
- Модифицировать `TreemapContainer.tsx` — заменить Framer Motion на D3 layer

**Изменения:**
1. Удалить импорты `AnimatePresence`, `LayoutGroup` из `TreemapContainer`
2. Создать SVG контейнер с ref
3. Сохранить всю логику tooltip, back button, empty state

### Этап 2: Базовый D3 рендеринг (1 итерация)
**Цель:** Рендерить прямоугольники без анимаций

**Код (концепция):**
```typescript
// TreemapD3Layer.tsx
useEffect(() => {
  const svg = d3.select(svgRef.current);
  
  // Data join with key function
  const rects = svg.selectAll<SVGRectElement, TreemapLayoutNode>('rect')
    .data(layoutNodes, d => d.key);  // KEY!
  
  // Enter: new nodes
  rects.enter()
    .append('rect')
    .attr('x', d => d.x0)
    .attr('y', d => d.y0)
    .attr('width', d => d.width)
    .attr('height', d => d.height)
    .attr('fill', d => d.color);
  
  // Update: existing nodes
  rects
    .attr('x', d => d.x0)
    .attr('y', d => d.y0)
    .attr('width', d => d.width)
    .attr('height', d => d.height);
  
  // Exit: removed nodes
  rects.exit().remove();
}, [layoutNodes]);
```

### Этап 3: Drilldown анимация (1–2 итерации)
**Цель:** Target zoom + соседи улетают

**Алгоритм:**
1. При drilldown сохранить "старые" позиции нод
2. Zoom target: анимировать к fullscreen (x: 0, y: 0, width: containerWidth, height: containerHeight)
3. Соседи: вычислить push-direction, анимировать за пределы экрана
4. После завершения — удалить exit-ноды, показать новые

**Код (концепция):**
```typescript
// Drilldown animation
if (animationType === 'drilldown' && zoomTarget) {
  // Exit: push neighbors off-screen
  rects.exit()
    .transition()
    .duration(600)
    .attr('x', d => calculatePushX(d, zoomTarget, containerWidth))
    .attr('y', d => calculatePushY(d, zoomTarget, containerHeight))
    .remove();
  
  // Zoom target: expand to fullscreen
  rects.filter(d => d.key === zoomTarget.key)
    .transition()
    .duration(600)
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', containerWidth)
    .attr('height', containerHeight);
}
```

### Этап 4: Navigate-up + Filter (1 итерация)
**Navigate-up:** Обратная анимация (ноды прилетают с краёв)
**Filter:** Простой морфинг позиций (уже работает в D3 через update)

### Этап 5: Polish (1 итерация)
1. Удалить `TreemapNode.tsx` (весь Framer Motion код)
2. Удалить debug-логи
3. Проверить производительность
4. Убедиться, что все edge cases работают (пустые данные, resize)

---

## Что сохраняется без изменений
- `useTreemapLayout.ts` — вычисление layout
- `types.ts` — типы
- `TreemapTooltip.tsx` — React tooltip
- `treemap.css` — стили (минимальные правки)
- Вся логика в `Index.tsx` (clickedNodeName, handleNodeClick)

---

## Что удаляется/заменяется
- `TreemapNode.tsx` — полностью удаляется
- Framer Motion imports в `TreemapContainer.tsx`
- AnimatePresence, LayoutGroup, variants, exit animations

---

## Вероятность успеха: **90–95%**

**Почему высокая:**
1. D3 transitions — это **тот же подход, что использует Flourish**
2. У нас уже есть D3 layout (`useTreemapLayout.ts`)
3. Exit-анимации в D3 — это просто `.exit().transition().attr(...)`, без React reconciliation
4. Полный контроль над жизненным циклом элементов

**Сравнение с текущим Framer Motion:**
| Аспект | Framer Motion | D3 Transitions |
|--------|---------------|----------------|
| Exit control | Через AnimatePresence (косвенный) | Прямой через .exit() |
| Sync timing | Сложно (custom, onExitComplete) | Просто (transition chaining) |
| Layout conflicts | Layout Projection | Нет (ручные координаты) |
| Debugging | Сложно (React lifecycle) | Просто (DOM инспектор) |

---

## Рекомендация
**Переходить на D3 transitions**. Это промышленный стандарт для сложных визуализаций с "camera zoom" эффектом. Текущий подход с Framer Motion упирается в архитектурное ограничение: AnimatePresence не даёт прямого контроля над exit-анимациями, а Layout Projection конфликтует с ручными координатами.
