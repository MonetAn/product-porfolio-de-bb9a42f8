

# Исправление Zoom-in анимации: блоки должны уезжать, а не пропадать

## Проблема

При drill-down остальные блоки остаются статичными и просто пропадают. Причина:

**Неправильный порядок операций:**
1. Сначала вызывается `renderNodeAnimated` → создаются НОВЫЕ узлы для нового дерева
2. Потом ищем `unprocessedNodes` → старые узлы
3. Но `zoomTargetEl` ищется среди `unprocessedNodes` — если кликнутый Unit уже обработан (как часть нового дерева), он НЕ будет найден!

**Результат:** `zoomTargetEl = null` → срабатывает fallback → блоки просто исчезают.

## Решение

Изменить порядок: **СНАЧАЛА анимировать старые узлы, ПОТОМ рендерить новые**.

```text
Сейчас:                          Нужно:
1. Render new tree               1. Save old nodes positions  
2. Find unprocessed (old)        2. Calculate exit animations
3. Animate old → FAIL!           3. Start exit animations
                                 4. Render new tree (delayed)
                                 5. New tree appears over animated old
```

## Изменения по файлам

### 1. `src/components/BudgetTreemap.tsx`

**Ключевое изменение: Сохранить старые узлы ДО рендера новых**

```typescript
const renderTreemap = useCallback((animationType: AnimationType = 'filter', zoomTargetName?: string | null) => {
  const container = d3ContainerRef.current;
  if (!container || isEmpty) return;

  const width = container.clientWidth;
  const height = container.clientHeight;
  const durationMs = ANIMATION_DURATIONS[animationType];
  container.style.setProperty('--transition-current', `${durationMs}ms`);

  // ... hierarchy setup ...

  // ===== DRILLDOWN: Animate BEFORE rendering new tree =====
  if (animationType === 'drilldown' && zoomTargetName) {
    // PHASE 1: Find and animate ALL current depth-0 nodes BEFORE any rendering
    const existingNodes = container.querySelectorAll('.treemap-node.depth-0');
    const containerRect = container.getBoundingClientRect();
    
    // Find the clicked node among EXISTING nodes
    const zoomTargetEl = Array.from(existingNodes).find(
      el => el.getAttribute('data-key')?.includes(zoomTargetName)
    ) as HTMLElement | null;
    
    if (zoomTargetEl) {
      const zoomTargetRect = zoomTargetEl.getBoundingClientRect();
      const clickedCenterX = zoomTargetRect.left + zoomTargetRect.width / 2 - containerRect.left;
      const clickedCenterY = zoomTargetRect.top + zoomTargetRect.height / 2 - containerRect.top;
      
      // PHASE 2: Animate zoom target to fullscreen
      zoomTargetEl.classList.add('animate', 'zoom-target');
      zoomTargetEl.style.left = '0px';
      zoomTargetEl.style.top = '0px';
      zoomTargetEl.style.width = width + 'px';
      zoomTargetEl.style.height = height + 'px';
      zoomTargetEl.style.zIndex = '100';
      
      // PHASE 3: Push OTHER nodes away (shrink + slide)
      existingNodes.forEach((el: Element) => {
        const htmlEl = el as HTMLElement;
        if (htmlEl === zoomTargetEl) return;
        
        const elRect = htmlEl.getBoundingClientRect();
        const elCenterX = elRect.left + elRect.width / 2 - containerRect.left;
        const elCenterY = elRect.top + elRect.height / 2 - containerRect.top;
        
        // Direction from clicked node center
        const dx = elCenterX - clickedCenterX;
        const dy = elCenterY - clickedCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const pushFactor = Math.max(width, height) * 1.5;
        
        // Calculate exit position
        const currentLeft = parseFloat(htmlEl.style.left) || 0;
        const currentTop = parseFloat(htmlEl.style.top) || 0;
        const newLeft = currentLeft + (dx / distance) * pushFactor;
        const newTop = currentTop + (dy / distance) * pushFactor;
        
        // Shrink to 0 while moving away
        htmlEl.classList.add('animate', 'zoom-out');
        htmlEl.style.left = newLeft + 'px';
        htmlEl.style.top = newTop + 'px';
        htmlEl.style.width = '0px';      // ← Сжимаются!
        htmlEl.style.height = '0px';     // ← Сжимаются!
        htmlEl.style.overflow = 'hidden'; // Скрыть содержимое при сжатии
      });
      
      // PHASE 4: After animation, remove old nodes and render new tree
      setTimeout(() => {
        // Remove all old nodes
        existingNodes.forEach(el => el.remove());
        
        // Now render the new tree (teams inside the unit)
        // ... call standard render logic ...
        renderNewTree();
      }, durationMs);
      
      return; // Don't render immediately
    }
  }
  
  // ... existing standard render logic ...
}, [...]);
```

**Структура кода с отложенным рендером:**

```typescript
// Helper function to render new tree (extracted from main logic)
const renderNewTree = () => {
  // Clear processed flags
  container.querySelectorAll('[data-processed]').forEach(el => {
    el.removeAttribute('data-processed');
  });

  // Render all top-level nodes
  root.children?.forEach((node, index) => {
    renderNodeAnimated(node, container, 0, index, 0, 0);
  });
  
  // Handle any remaining unprocessed nodes (standard filter behavior)
  // ...
};

// In renderTreemap:
if (animationType === 'drilldown' && zoomTargetName) {
  // ... animate existing nodes ...
  setTimeout(() => {
    existingNodes.forEach(el => el.remove());
    renderNewTree(); // ← Delayed render
  }, durationMs);
  return;
}

// Standard path (filter, resize, etc.)
renderNewTree();
```

### 2. `src/components/StakeholdersTreemap.tsx`

Те же изменения:
- Сохранять старые узлы ДО рендера
- Анимировать их (zoom-target растёт, остальные сжимаются + уезжают)
- Рендерить новое дерево ПОСЛЕ анимации

### 3. `src/styles/treemap.css`

Добавить стиль для сжатия содержимого:

```css
/* Nodes shrinking during zoom-out should hide content overflow */
.treemap-node.zoom-out {
  z-index: 50;
  opacity: 1 !important;
  pointer-events: none;
  overflow: hidden;
}
```

## Визуальный результат

```text
t=0ms:   Клик на Unit B
         ┌─A─┐ ┌─B─┐ ┌─C─┐
         └───┘ └───┘ └───┘
         ┌─D─┐ ┌─E─┐ ┌─F─┐
         └───┘ └───┘ └───┘

t=100ms: B начинает расти
         A,C,D,E,F начинают сжиматься и уезжать
         ┌A┐    ┌─────B─────┐    ┌C┐
          ↑                       ↑
       уезжает                уезжает

t=250ms: B на полпути к fullscreen
         A,C,D,E,F почти за экраном (сжаты до минимума)

t=500ms: B заполняет экран
         A,C,D,E,F удалены из DOM
         Рендерятся Teams внутри B
         
         ┌─────────────────────────┐
         │           B             │
         │  ┌Team1┐ ┌Team2┐        │
         │  └─────┘ └─────┘        │
         └─────────────────────────┘
```

## Обратная анимация (Navigate Up)

Аналогичная логика в обратном направлении:

1. Текущий fullscreen Unit B начинает сжиматься к своей будущей позиции
2. Новые узлы A,C,D,E,F появляются за экраном (размер 0) и растут + въезжают
3. После анимации — финальное состояние

```typescript
if (animationType === 'navigate-up') {
  // Current fullscreen node shrinks
  const currentFullscreen = container.querySelector('.treemap-node.depth-0');
  if (currentFullscreen) {
    // Find its new position in the new layout
    const newNode = root.children?.find(n => n.data.name === currentFullscreen.getAttribute('data-name'));
    if (newNode) {
      currentFullscreen.style.left = newNode.x0 + 'px';
      currentFullscreen.style.top = newNode.y0 + 'px';
      currentFullscreen.style.width = (newNode.x1 - newNode.x0) + 'px';
      currentFullscreen.style.height = (newNode.y1 - newNode.y0) + 'px';
    }
  }
  
  // New nodes fly in from outside
  root.children?.forEach(node => {
    if (node.data.name === currentFullscreen?.getAttribute('data-name')) return;
    
    // Create at position 0,0 with size 0, then animate to final
    const div = createNode(node);
    div.style.left = centerX + 'px';
    div.style.top = centerY + 'px';
    div.style.width = '0px';
    div.style.height = '0px';
    
    requestAnimationFrame(() => {
      div.classList.add('animate');
      div.style.left = node.x0 + 'px';
      div.style.top = node.y0 + 'px';
      div.style.width = (node.x1 - node.x0) + 'px';
      div.style.height = (node.y1 - node.y0) + 'px';
    });
  });
}
```

## Порядок реализации

1. Рефакторинг BudgetTreemap: вынести рендер в отдельную функцию
2. Добавить логику drilldown с отложенным рендером
3. Добавить сжатие + уезжание для соседних блоков
4. Протестировать на Budget
5. Применить те же изменения к StakeholdersTreemap
6. Добавить обратную анимацию для navigate-up

