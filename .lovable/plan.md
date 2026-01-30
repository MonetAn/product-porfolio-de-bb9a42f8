

# Полноценный Zoom-in/Zoom-out без исчезновения блоков

## Проблема

При drill-down блоки исчезают (fade out) вместо того, чтобы просто уезжать за границы экрана. Причины:

1. **Для не-depth-0 узлов** применяется класс `exiting` (opacity: 0)
2. **CSS анимирует opacity** даже когда мы не устанавливаем его явно
3. **Нет обратной анимации** при возврате наверх — блоки не "въезжают" обратно

## Решение

### Концепция: Физичная камера

```text
ZOOM-IN (drill-down):
┌─────────────────────────────────────┐
│  ┌─A─┐  ┌─B─┐  ┌─C─┐               │
│  └───┘  └───┘  └───┘               │  Клик на B
│  ┌─D─┐  ┌─E─┐  ┌─F─┐               │
│  └───┘  └───┘  └───┘               │
└─────────────────────────────────────┘
                 ↓ 500ms
    ←A уехал     B растягивается      C уехал→
    ←D уехал                          F уехал→
                                     ↑E уехал
                 ↓
┌─────────────────────────────────────┐
│                 B                    │  B на весь экран
│          (teams внутри)              │
└─────────────────────────────────────┘

ZOOM-OUT (navigate up):
┌─────────────────────────────────────┐
│                 B                    │  Клик "Наверх"
│          (teams внутри)              │
└─────────────────────────────────────┘
                 ↓ 600ms
    A въезжает→  B сжимается  ←C въезжает
    D въезжает→               ←F въезжает
                              E въезжает↓
                 ↓
┌─────────────────────────────────────┐
│  ┌─A─┐  ┌─B─┐  ┌─C─┐               │
│  └───┘  └───┘  └───┘               │
│  ┌─D─┐  ┌─E─┐  ┌─F─┐               │
│  └───┘  └───┘  └───┘               │
└─────────────────────────────────────┘
```

## Изменения по файлам

### 1. `src/styles/treemap.css`

**Удалить opacity из транзишенов для zoom и exiting:**

```css
/* Animated state - uses current duration */
/* ИЗМЕНЕНИЕ: Убираем opacity из общей анимации */
.treemap-node.animate {
  transition: 
    left var(--transition-current) ease-out,
    top var(--transition-current) ease-out,
    width var(--transition-current) ease-out,
    height var(--transition-current) ease-out;
  /* opacity убран - не нужен для zoom */
}

/* Enter animation - для НОВЫХ элементов fade-in */
.treemap-node.entering {
  opacity: 0;
  transition: opacity var(--transition-current) ease-out;
}

/* Exit animation - НЕ fade, только для pointer-events */
/* ИЗМЕНЕНИЕ: убираем opacity: 0 */
.treemap-node.exiting {
  pointer-events: none;
  /* opacity остаётся 1 - блок уезжает видимым */
}

/* Zoom-out - nodes that slide away (remain visible!) */
.treemap-node.zoom-out {
  z-index: 50;
  opacity: 1 !important;
  pointer-events: none;
}

/* Zoom-in target - expands to fullscreen */
.treemap-node.zoom-target {
  z-index: 100;
}
```

### 2. `src/components/BudgetTreemap.tsx`

**2.1. Исправить обработку не-depth-0 узлов (строки 484-488):**

Сейчас:
```typescript
if (!htmlEl.classList.contains('depth-0')) {
  htmlEl.classList.add('exiting', 'animate');  // fade!
  setTimeout(() => htmlEl.remove(), durationMs);
  return;
}
```

Нужно — дочерние элементы должны уезжать ВМЕСТЕ с родителем:
```typescript
// Дочерние узлы (depth > 0) — НЕ анимируем отдельно
// Они уедут вместе с родительским depth-0 блоком
if (!htmlEl.classList.contains('depth-0')) {
  // Не добавляем никаких классов — блок остаётся внутри родителя
  // и уедет вместе с ним
  setTimeout(() => htmlEl.remove(), durationMs);
  return;
}
```

**2.2. Добавить обратную zoom-out анимацию при navigate-up:**

Сейчас при возврате наверх используется обычный `filter` тип анимации. Нужно добавить специальную логику для `navigate-up`:

```typescript
// В renderTreemap, после расчёта layout
if (animationType === 'navigate-up') {
  // PHASE 1: Показать все новые узлы в "разлетевшемся" состоянии
  // (как будто камера только начинает отъезжать)
  
  const containerRect = container.getBoundingClientRect();
  const centerX = containerRect.width / 2;
  const centerY = containerRect.height / 2;
  
  // Создаём узлы в позициях "за экраном"
  root.children.forEach((node, index) => {
    const nodeKey = getNodeKey(node, 0);
    let div = container.querySelector(`[data-key="${nodeKey}"]`) as HTMLElement | null;
    
    if (!div) {
      // Новый узел — создаём за экраном
      div = createNodeElement(node, 0, index);
      
      // Рассчитываем направление "откуда въезжать"
      const finalLeft = node.x0;
      const finalTop = node.y0;
      const nodeCenterX = finalLeft + (node.x1 - node.x0) / 2;
      const nodeCenterY = finalTop + (node.y1 - node.y0) / 2;
      
      // Вектор от центра к узлу
      const dx = nodeCenterX - centerX;
      const dy = nodeCenterY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const pushFactor = Math.max(containerRect.width, containerRect.height);
      
      // Стартовая позиция — за экраном
      const startLeft = finalLeft + (dx / distance) * pushFactor;
      const startTop = finalTop + (dy / distance) * pushFactor;
      
      div.style.left = startLeft + 'px';
      div.style.top = startTop + 'px';
      div.style.width = (node.x1 - node.x0) + 'px';
      div.style.height = (node.y1 - node.y0) + 'px';
      
      container.appendChild(div);
      
      // PHASE 2: Анимируем к финальной позиции
      requestAnimationFrame(() => {
        div.classList.add('animate');
        div.style.left = finalLeft + 'px';
        div.style.top = finalTop + 'px';
      });
    }
  });
  
  // Текущий развёрнутый узел — сжимается к своей новой позиции
  // (уже обрабатывается стандартной UPDATE логикой)
}
```

**2.3. Рефактор: Вынести создание элемента в отдельную функцию:**

Для переиспользования между enter и navigate-up:

```typescript
const createNodeElement = (
  node: d3.HierarchyRectangularNode<TreeNode>,
  depth: number,
  colorIndex: number
): HTMLElement => {
  const div = document.createElement('div');
  div.setAttribute('data-key', getNodeKey(node, depth));
  div.className = 'treemap-node depth-' + depth;
  
  // Цвет
  const unitName = getUnitName(node);
  const baseColor = getUnitColor(unitName);
  div.style.backgroundColor = depth === 0 ? baseColor : adjustBrightness(baseColor, -15 * depth);
  
  // События (клики, тултипы)
  // ... (переносим код из renderNodeAnimated)
  
  return div;
};
```

### 3. `src/components/StakeholdersTreemap.tsx`

Аналогичные изменения:
- Убрать `exiting` класс с дочерних узлов
- Добавить navigate-up анимацию "въезда"

### 4. `src/pages/Index.tsx`

**Передавать информацию о типе навигации:**

Нужно различать "откуда пришли" для правильной анимации:

```typescript
// Добавить ref для отслеживания предыдущего состояния
const prevSelectedUnitsRef = useRef<string[]>([]);

// При вызове onNavigateBack
const handleNavigateBack = () => {
  // Сохраняем текущий выбранный Unit для анимации "из центра"
  const currentUnit = selectedUnits[0];
  setLastClickedNode(currentUnit); // или отдельный state
  
  // Сбрасываем фильтры...
};
```

## Технические детали

### Почему дочерние узлы должны уезжать с родителем

Дочерние узлы (Teams, Initiatives) позиционированы **относительно родителя**. Когда родительский depth-0 блок уезжает за экран, дочерние элементы внутри него автоматически уедут вместе с ним. 

Не нужно анимировать их отдельно — это только создаёт визуальный хаос и fade-эффект.

### Overflow: hidden — наш друг

Контейнер с `overflow: hidden` обрезает всё, что выходит за границы. Это и создаёт эффект "камеры" — блоки уезжают и скрываются за краем, а не исчезают в никуда.

### Таймлайн анимации

```text
t=0ms:   Клик на Unit B
         B: начинает расти к (0,0,W,H)
         A,C,D,E,F: начинают уезжать от центра B
         
t=250ms: B: на полпути
         A,C,D,E,F: уже частично скрыты overflow:hidden
         
t=500ms: B: заполняет весь экран
         A,C,D,E,F: полностью за границами, удаляются из DOM
         Рендерятся Teams внутри B
```

## Порядок реализации

1. **CSS**: Убрать opacity из `.exiting` и `.animate`
2. **BudgetTreemap**: Не добавлять `exiting` дочерним узлам
3. **BudgetTreemap**: Добавить navigate-up анимацию въезда
4. **StakeholdersTreemap**: Те же изменения
5. **Тестирование**: Проверить оба направления на обоих табах

## Ожидаемый результат

- **Zoom-in**: Кликаю на Unit → он плавно растягивается, остальные уезжают к краям (не исчезают!) → ощущение приближения камеры
- **Zoom-out**: Кликаю "Наверх" → текущий Unit сжимается, остальные въезжают с краёв → ощущение отдаления камеры
- **Без fade**: Ни один блок не исчезает плавно — только физическое перемещение

