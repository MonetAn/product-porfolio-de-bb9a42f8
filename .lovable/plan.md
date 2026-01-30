

# Zoom-in эффект для Treemap + исправление бага с Teams

## Проблемы

### Баг 1: Галочка "Команды" не включается при клике на Unit

В `handleNodeClick` (Index.tsx, строка 241) галочка "Teams" уже включается:
```typescript
if (!showTeams) setShowTeams(true);
```

Но проблема в том, что **дерево перестраивается до применения нового состояния showTeams**. React батчит обновления, но `rebuildTree` срабатывает с задержкой.

**Решение**: Добавить проверку в useEffect для `rebuildTree` — если выбран один Unit и showTeams=false, форсировать включение Teams.

### Проблема 2: Fade-out вместо Zoom-in

Сейчас при drill-down:
- Кликнутый Unit растягивается на весь экран ✓
- Остальные юниты просто исчезают (opacity: 0) ✗

**Ожидаемый эффект**: Остальные юниты должны "сжиматься" к краям или скользить за пределы экрана.

## Решение: Camera Zoom Effect

### Визуальная концепция

```text
Before click:              During animation (500ms):       After:
┌───┬───┬───┐             ┌─────────────────────────┐     ┌─────────────────────────┐
│ A │ B │ C │             │           B             │     │           B             │
├───┼───┼───┤   ──────>   │                         │     │  (Teams внутри)         │
│ D │ E │ F │             │                         │     │                         │
└───┴───┴───┘             └─────────────────────────┘     └─────────────────────────┘

- B растягивается до размера контейнера
- A, C, D, E, F сжимаются к краям и исчезают
```

### Техническая реализация

Для "zoom-in" эффекта нужно знать:
1. Какой именно узел был кликнут
2. Его начальные координаты (до перестройки)

Затем:
1. Кликнутый узел анимируется от своих координат к `(0, 0, width, height)`
2. Остальные узлы анимируются к координатам "за экраном" (пропорционально удаляясь от кликнутого)

## Изменения по файлам

### 1. `src/pages/Index.tsx`

**Исправление бага: Синхронизация showTeams при выборе Unit**

В функции `handleNodeClick` добавить немедленный вызов `rebuildTree` или использовать useEffect для синхронизации:

```typescript
// Добавить useEffect для автоматического включения Teams
useEffect(() => {
  // Если выбран один Unit и Teams выключены, включаем автоматически
  if (selectedUnits.length === 1 && !showTeams) {
    setShowTeams(true);
  }
}, [selectedUnits, showTeams]);
```

### 2. `src/components/BudgetTreemap.tsx`

**Добавление zoom-in анимации:**

**2.1. Новый prop для передачи информации о кликнутом узле:**
```typescript
interface BudgetTreemapProps {
  // ... existing props
  clickedNodeName?: string | null; // Имя узла, на который кликнули
}
```

**2.2. Хранение позиций узлов перед рендером:**
```typescript
const prevNodePositionsRef = useRef<Map<string, DOMRect>>(new Map());
```

**2.3. Модификация renderTreemap для zoom-in:**

Для drilldown анимации:
```typescript
if (animationType === 'drilldown' && clickedNodeName) {
  // Найти DOM-элемент кликнутого узла
  const clickedEl = container.querySelector(`[data-name="${clickedNodeName}"]`);
  
  if (clickedEl) {
    // Сохранить начальную позицию
    const startRect = clickedEl.getBoundingClientRect();
    
    // Анимировать к полному размеру контейнера
    clickedEl.classList.add('zoom-target');
    
    // Остальные узлы — анимировать к краям
    container.querySelectorAll('.treemap-node.depth-0:not([data-name="${clickedNodeName}"])').forEach(el => {
      el.classList.add('zoom-out');
      // Рассчитать направление "выталкивания"
    });
  }
}
```

**Альтернативный подход (проще и надёжнее):**

Использовать CSS transform scale + translate для создания эффекта "наезда камеры":

1. При клике на узел:
   - Установить CSS-переменные с координатами кликнутого узла
   - Применить `transform: scale()` к контейнеру, центрируя на кликнутом узле
2. После анимации:
   - Сбросить transform
   - Отрендерить новое состояние

### 3. `src/styles/treemap.css`

**Добавление стилей для zoom-эффекта:**

```css
/* Zoom-in target - node that expands to fullscreen */
.treemap-node.zoom-target {
  z-index: 100;
  transition: 
    left var(--transition-current) ease-out,
    top var(--transition-current) ease-out,
    width var(--transition-current) ease-out,
    height var(--transition-current) ease-out !important;
}

/* Zoom-out - nodes that slide away */
.treemap-node.zoom-out {
  transition: 
    left var(--transition-current) ease-out,
    top var(--transition-current) ease-out,
    width var(--transition-current) ease-out,
    height var(--transition-current) ease-out,
    opacity var(--transition-current) ease-out !important;
}

/* Direction-based exit animations */
.treemap-node.zoom-out.exit-left {
  transform: translateX(-100%);
  opacity: 0;
}

.treemap-node.zoom-out.exit-right {
  transform: translateX(100%);
  opacity: 0;
}

.treemap-node.zoom-out.exit-top {
  transform: translateY(-100%);
  opacity: 0;
}

.treemap-node.zoom-out.exit-bottom {
  transform: translateY(100%);
  opacity: 0;
}
```

### 4. Детальная логика zoom-in в `renderTreemap()`

```typescript
const renderTreemap = useCallback((animationType, clickedNodeName?) => {
  // ... existing setup ...

  if (animationType === 'drilldown' && clickedNodeName) {
    // PHASE 1: Animate existing nodes OUT
    const clickedEl = container.querySelector(`[data-name="${clickedNodeName}"]`) as HTMLElement;
    
    if (clickedEl) {
      const containerRect = container.getBoundingClientRect();
      const clickedRect = clickedEl.getBoundingClientRect();
      
      // Центр кликнутого элемента
      const clickedCenterX = clickedRect.left + clickedRect.width / 2 - containerRect.left;
      const clickedCenterY = clickedRect.top + clickedRect.height / 2 - containerRect.top;
      
      // Анимировать все depth-0 узлы
      container.querySelectorAll('.treemap-node.depth-0').forEach((el: HTMLElement) => {
        if (el.getAttribute('data-name') === clickedNodeName) {
          // Кликнутый узел — анимировать к полному размеру
          el.classList.add('animate', 'zoom-target');
          el.style.left = '0px';
          el.style.top = '0px';
          el.style.width = containerRect.width + 'px';
          el.style.height = containerRect.height + 'px';
        } else {
          // Остальные — "выталкивать" от центра кликнутого
          const elRect = el.getBoundingClientRect();
          const elCenterX = elRect.left + elRect.width / 2 - containerRect.left;
          const elCenterY = elRect.top + elRect.height / 2 - containerRect.top;
          
          // Направление выталкивания
          const dx = elCenterX - clickedCenterX;
          const dy = elCenterY - clickedCenterY;
          
          // Нормализуем и усиливаем
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const pushFactor = containerRect.width; // Выталкиваем за границы
          
          el.classList.add('animate', 'zoom-out');
          el.style.left = (parseFloat(el.style.left) + (dx / distance) * pushFactor) + 'px';
          el.style.top = (parseFloat(el.style.top) + (dy / distance) * pushFactor) + 'px';
          el.style.opacity = '0';
        }
      });
      
      // После анимации — очистить и отрендерить новое состояние
      setTimeout(() => {
        // Удалить старые узлы
        container.querySelectorAll('.treemap-node').forEach(el => el.remove());
        // Рендер нового состояния без анимации
        // ... render new tree ...
      }, durationMs);
      
      return; // Не рендерить сразу
    }
  }
  
  // ... existing render logic for non-drilldown ...
}, [...]);
```

### 5. StakeholdersTreemap.tsx

Аналогичные изменения для Stakeholder drill-down.

## Порядок реализации

**Шаг 1**: Исправить баг с showTeams — добавить useEffect синхронизацию

**Шаг 2**: Добавить prop `clickedNodeName` в BudgetTreemap

**Шаг 3**: Реализовать zoom-in анимацию:
   - Сохранять позиции перед кликом
   - При drilldown: анимировать кликнутый узел к fullscreen
   - Остальные узлы: выталкивать от центра кликнутого

**Шаг 4**: Добавить CSS стили для zoom-эффектов

**Шаг 5**: Применить те же изменения к StakeholdersTreemap

## Ожидаемый результат

1. **Баг исправлен**: При клике на Unit галочка "Команды" включается, и внутри сразу видны команды

2. **Zoom-in эффект**:
   - Кликнутый Unit плавно "наезжает" на весь экран
   - Соседние юниты "разлетаются" к краям экрана
   - Создаётся ощущение физического приближения к объекту

3. **Время анимации**: 500ms для drilldown (как было заложено ранее)

