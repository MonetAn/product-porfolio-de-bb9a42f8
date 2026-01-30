
# Плавные переходы для Treemap (Morphing Animation)

## Цель

Добавить "вау-эффект" при смене фильтров: элементы плавно перемещаются, меняют размер и исчезают/появляются. Глаз пользователя должен следить за конкретным квадратом.

## Тайминги для разных действий

| Действие | Длительность | Easing | Почему |
|----------|--------------|--------|--------|
| Смена фильтра | 800ms | ease-out | "Storytelling" — время рассмотреть куда уехали элементы |
| Drill-down (клик) | 500ms | ease-out | Быстрый отклик на действие пользователя |
| Navigate Up | 600ms | ease-out | Чуть медленнее drill-down, но быстрее фильтра |
| Resize окна | 300ms | ease-out | Техническое действие, не отвлекать |

## Техническое решение

### Проблема сейчас

```javascript
// Строки 107-110 в BudgetTreemap.tsx
while (container.firstChild) {
  container.removeChild(container.firstChild);  // ← Полная очистка DOM
}
```

Все элементы удаляются и создаются заново — нет возможности анимировать.

### Решение: D3 Data Join + Transitions

Используем паттерн **enter/update/exit** с ключами по имени:

```text
┌────────────────────────────────────────────────────────────┐
│  Было:                         Станет:                     │
│                                                            │
│  1. Удалить все элементы       1. Сравнить старые/новые    │
│  2. Создать новые              2. Enter: opacity 0 → 1     │
│  3. Мгновенное переключение    3. Update: animate pos/size │
│                                4. Exit: opacity 1 → 0      │
└────────────────────────────────────────────────────────────┘
```

## Изменения по файлам

### 1. `src/styles/treemap.css`

**Добавить CSS-переменные и классы для анимаций:**

```css
/* Animation durations as CSS variables */
.treemap-container {
  --transition-filter: 800ms;
  --transition-drilldown: 500ms;
  --transition-navigate-up: 600ms;
  --transition-resize: 300ms;
  --transition-current: var(--transition-filter);
}

/* Animated state - uses current duration */
.treemap-node.animate {
  transition: 
    left var(--transition-current) ease-out,
    top var(--transition-current) ease-out,
    width var(--transition-current) ease-out,
    height var(--transition-current) ease-out,
    opacity var(--transition-current) ease-out;
}

/* Enter animation - fade in */
.treemap-node.entering {
  opacity: 0;
}

/* Exit animation - fade out */
.treemap-node.exiting {
  opacity: 0;
  pointer-events: none;
}
```

### 2. `src/components/BudgetTreemap.tsx`

**Основные изменения:**

**2.1. Добавить тип анимации:**
```typescript
type AnimationType = 'filter' | 'drilldown' | 'navigate-up' | 'resize';
```

**2.2. Ref для хранения предыдущих позиций:**
```typescript
const prevPositionsRef = useRef<Map<string, DOMRect>>(new Map());
```

**2.3. Новая функция `renderTreemapAnimated()`:**

Вместо полной очистки DOM:

```typescript
const renderTreemapAnimated = (animationType: AnimationType = 'filter') => {
  const container = d3ContainerRef.current;
  if (!container || isEmpty) return;

  // Set animation duration via CSS variable
  const durations = {
    'filter': '800ms',
    'drilldown': '500ms', 
    'navigate-up': '600ms',
    'resize': '300ms'
  };
  container.style.setProperty('--transition-current', durations[animationType]);

  // ... treemap layout calculation (same as before) ...

  // Build node map: name -> new position data
  const newNodesMap = new Map<string, NodeData>();
  root.descendants().forEach(node => {
    if (node.depth > 0) {
      newNodesMap.set(node.data.name, { node, ... });
    }
  });

  // Get existing DOM nodes
  const existingNodes = container.querySelectorAll('.treemap-node[data-name]');
  const existingNames = new Set<string>();
  
  existingNodes.forEach(el => {
    const name = el.getAttribute('data-name');
    existingNames.add(name);
    
    if (newNodesMap.has(name)) {
      // UPDATE: animate to new position
      const newData = newNodesMap.get(name);
      el.classList.add('animate');
      el.style.left = newData.x + 'px';
      el.style.top = newData.y + 'px';
      el.style.width = newData.width + 'px';
      el.style.height = newData.height + 'px';
    } else {
      // EXIT: fade out and remove
      el.classList.add('exiting');
      setTimeout(() => el.remove(), durations[animationType]);
    }
  });

  // ENTER: create new nodes with fade-in
  newNodesMap.forEach((data, name) => {
    if (!existingNames.has(name)) {
      const div = createNode(data);
      div.classList.add('entering', 'animate');
      container.appendChild(div);
      // Trigger reflow, then remove entering class
      requestAnimationFrame(() => {
        div.classList.remove('entering');
      });
    }
  });
};
```

**2.4. Добавить `data-name` атрибут для идентификации:**

```typescript
const renderNode = (...) => {
  const div = document.createElement('div');
  div.setAttribute('data-name', node.data.name);  // ← Ключ для matching
  // ...
};
```

**2.5. Определение типа анимации:**

```typescript
// В useEffect - отслеживаем что изменилось
const prevDataRef = useRef(data);
const prevShowTeamsRef = useRef(showTeams);

useEffect(() => {
  if (!isEmpty) {
    let animationType: AnimationType = 'filter';
    
    // Drill-down: data root changed
    if (prevDataRef.current?.name !== data?.name) {
      animationType = 'drilldown';
    }
    
    prevDataRef.current = data;
    prevShowTeamsRef.current = showTeams;
    
    renderTreemapAnimated(animationType);
  }
}, [data, showTeams, showInitiatives, ...]);
```

**2.6. Сохранить старую функцию для отката:**

```typescript
// Fallback - immediate render without animations
const renderTreemapImmediate = () => { /* original code */ };

// Main render function - with animations
const renderTreemap = renderTreemapAnimated;
```

### 3. `src/components/StakeholdersTreemap.tsx`

Аналогичные изменения:
- Добавить `data-name` атрибуты
- Заменить полную очистку на data join pattern
- Использовать те же CSS-переменные для анимаций

### 4. Обработка вложенных элементов

Для иерархии (Unit → Team → Initiative) рекурсивно обновляем позиции:

```typescript
function updateNestedNodes(
  parentEl: HTMLElement, 
  parentNode: HierarchyNode,
  depth: number
) {
  const childNodes = parentNode.children || [];
  const existingChildren = parentEl.querySelectorAll(
    `:scope > .treemap-node.depth-${depth}`
  );
  
  // Same enter/update/exit logic for children
  // ...
  
  // Recurse for grandchildren
  childNodes.forEach(child => {
    const childEl = parentEl.querySelector(`[data-name="${child.data.name}"]`);
    if (childEl && child.children) {
      updateNestedNodes(childEl, child, depth + 1);
    }
  });
}
```

## Визуальный результат

```text
Фильтр изменён: "Отключить Support"

Before:                      After (800ms transition):
┌─────┬─────┬───┐           ┌───────────┬─────────┐
│ A   │ B   │ C │    →→→    │     A     │    B    │
│     │(sup)│   │   800ms   │           │         │
├─────┼─────┤   │           ├───────────┤         │
│ D   │ E   │   │           │     D     │         │
└─────┴─────┴───┘           └───────────┴─────────┘

- B (support) плавно растворяется (opacity 0)
- A, D увеличиваются и занимают освободившееся место
- C исчезает (был support)
- Глаз следит за перемещением A и D
```

## Откат

Для безопасности сохраняем возможность мгновенного переключения:

```typescript
// В компоненте - флаг для отключения анимаций
const useAnimations = true; // Можно сделать prop или config

const renderTreemap = useAnimations 
  ? renderTreemapAnimated 
  : renderTreemapImmediate;
```

## Итерации реализации

**Итерация 1: BudgetTreemap**
- CSS-переменные для таймингов
- Data join pattern с enter/update/exit
- Тестирование на Budget табе

**Итерация 2: StakeholdersTreemap**  
- Применение того же паттерна
- Тестирование на Stakeholders табе

## Потенциальные сложности

1. **Вложенность**: Дочерние элементы позиционируются относительно родителя — нужно корректно пересчитывать координаты
2. **Уникальность имён**: Если два элемента называются одинаково, нужен составной ключ (unit-team-name)
3. **Производительность**: При большом количестве элементов (100+) анимации могут тормозить — возможно отключение для resize

## Ожидаемый результат

- Смена фильтров → плавный morphing за 800ms
- Drill-down → быстрый zoom за 500ms  
- Navigate up → комфортный возврат за 600ms
- "Проект X" визуально перемещается на новое место
- Исчезающие элементы плавно растворяются
- Появляющиеся элементы плавно проявляются
