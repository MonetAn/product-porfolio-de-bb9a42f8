

# Полный рефакторинг Treemap-анимации: Framer Motion Layout Animations

## Диагноз текущей проблемы

Проанализировав код, я вижу **фундаментальную архитектурную проблему**:

### Почему CSS-транзишены не работают

```text
Текущий flow:
1. Клик на Unit
2. React обновляет state (selectedUnits)
3. Происходит rebuildTree() 
4. data меняется → React перерисовывает компонент
5. useEffect запускает renderTreemap()
6. JavaScript пытается анимировать DOM-элементы, но...
   → React уже удалил старые ноды из virtual DOM
   → Новая иерархия (teams) уже отрендерена
   → Старые элементы не существуют или уже заменены
```

**Результат:** Невозможно анимировать элементы, которых уже нет в DOM. Отсюда "глюки" и рассинхронизация.

### Почему D3 + CSS transitions — тупиковый путь

1. **Конфликт React и D3:** React управляет Virtual DOM, D3 — реальным DOM. Когда оба пытаются контролировать одни и те же элементы, возникают race conditions.

2. **Exit-анимации невозможны:** CSS transitions не могут анимировать элементы, которые удаляются — они просто исчезают.

3. **Layout sync:** Нельзя синхронизировать анимацию расширения одного элемента с "выталкиванием" других без единого координатора анимаций.

## Решение: Framer Motion

**Framer Motion** — это именно та библиотека, которая решает эти проблемы:

1. **AnimatePresence** — позволяет анимировать элементы при их удалении из DOM
2. **layout** prop — автоматически анимирует изменения позиции и размера
3. **LayoutGroup** — синхронизирует анимации между связанными элементами
4. **Единый координатор** — все анимации управляются централизованно

## Архитектура нового решения

```text
┌─────────────────────────────────────────────────────────────┐
│                    TreemapContainer                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  <LayoutGroup>                         │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │            <AnimatePresence mode="sync">         │  │  │
│  │  │                                                  │  │  │
│  │  │   ┌────────────────────────────────────────┐    │  │  │
│  │  │   │  <motion.div layout layoutId="unit-A">  │    │  │  │
│  │  │   │     initial, animate, exit              │    │  │  │
│  │  │   └────────────────────────────────────────┘    │  │  │
│  │  │                                                  │  │  │
│  │  │   ┌────────────────────────────────────────┐    │  │  │
│  │  │   │  <motion.div layout layoutId="unit-B">  │    │  │  │
│  │  │   │     (zoom target - expands)             │    │  │  │
│  │  │   │     ┌──────────────────────────────┐   │    │  │  │
│  │  │   │     │ Teams appear after zoom       │   │    │  │  │
│  │  │   │     │ with opacity fade-in          │   │    │  │  │
│  │  │   │     └──────────────────────────────┘   │    │  │  │
│  │  │   └────────────────────────────────────────┘    │  │  │
│  │  │                                                  │  │  │
│  │  │   ┌────────────────────────────────────────┐    │  │  │
│  │  │   │  <motion.div layout layoutId="unit-C">  │    │  │  │
│  │  │   │     exit animation (shrink + fly out)   │    │  │  │
│  │  │   └────────────────────────────────────────┘    │  │  │
│  │  │                                                  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Детальный план реализации

### 1. Установка Framer Motion

```bash
npm install framer-motion
```

### 2. Новый компонент TreemapNode

Создаём React-компонент для каждой ноды treemap:

```typescript
// src/components/treemap/TreemapNode.tsx
import { motion } from 'framer-motion';

interface TreemapNodeProps {
  node: TreemapLayoutNode;
  depth: number;
  onClick: () => void;
  isZoomTarget?: boolean;
}

export const TreemapNode = ({ node, depth, onClick, isZoomTarget }: TreemapNodeProps) => {
  const calculateExitAnimation = () => {
    // Вычисляем направление "выталкивания" от центра zoom target
    const containerCenter = { x: containerWidth / 2, y: containerHeight / 2 };
    const nodeCenter = { x: node.x0 + node.width / 2, y: node.y0 + node.height / 2 };
    
    const dx = nodeCenter.x - containerCenter.x;
    const dy = nodeCenter.y - containerCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const pushFactor = Math.max(containerWidth, containerHeight) * 1.5;
    
    return {
      x: node.x0 + (dx / distance) * pushFactor,
      y: node.y0 + (dy / distance) * pushFactor,
      scale: 0,
      opacity: 0.6,
    };
  };

  return (
    <motion.div
      layoutId={`node-${node.path}`}  // Уникальный ID для layout animations
      layout                           // Автоматически анимирует position/size
      
      initial={{ opacity: 0, scale: 0.8 }}
      
      animate={{
        x: node.x0,
        y: node.y0,
        width: node.width,
        height: node.height,
        opacity: 1,
        scale: 1,
      }}
      
      exit={calculateExitAnimation()}
      
      transition={{
        layout: {
          type: "tween",
          ease: [0.4, 0, 0.2, 1],  // ease-in-out cubic-bezier
          duration: 0.5,
        },
        opacity: { duration: 0.3, delay: 0.2 },
      }}
      
      className={`treemap-node depth-${depth}`}
      style={{ backgroundColor: node.color }}
      onClick={onClick}
    >
      <TreemapNodeContent node={node} />
      
      {/* Вложенные ноды */}
      {node.children && (
        <AnimatePresence mode="wait">
          {node.children.map(child => (
            <TreemapNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </AnimatePresence>
      )}
    </motion.div>
  );
};
```

### 3. Рефакторинг BudgetTreemap

```typescript
// src/components/BudgetTreemap.tsx (новая версия)
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { TreemapNode } from './treemap/TreemapNode';

const BudgetTreemap = ({ data, onNodeClick, ... }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<TreemapLayoutNode[]>([]);
  const [zoomTargetId, setZoomTargetId] = useState<string | null>(null);
  
  // Вычисляем layout с помощью D3 (только расчёт, без DOM)
  useEffect(() => {
    if (!containerRef.current || !data.children) return;
    
    const { width, height } = containerRef.current.getBoundingClientRect();
    
    const root = d3.hierarchy(data)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));
    
    const treemapLayout = d3.treemap<TreeNode>()
      .size([width, height])
      .paddingOuter(2)
      .paddingTop(24)
      .paddingInner(2)
      .round(true);
    
    treemapLayout(root);
    
    // Преобразуем в плоский массив нодов с позициями
    const nodes = flattenHierarchy(root);
    setLayout(nodes);
  }, [data, containerRef.current?.clientWidth, containerRef.current?.clientHeight]);
  
  const handleNodeClick = (node: TreemapLayoutNode) => {
    setZoomTargetId(node.path);
    onNodeClick?.(node.data);
  };
  
  return (
    <div ref={containerRef} className="treemap-container">
      <LayoutGroup>
        <AnimatePresence mode="sync">
          {layout.map(node => (
            <TreemapNode
              key={node.path}
              node={node}
              depth={node.depth}
              onClick={() => handleNodeClick(node)}
              isZoomTarget={node.path === zoomTargetId}
            />
          ))}
        </AnimatePresence>
      </LayoutGroup>
      
      {/* Tooltip и кнопка "Наверх" — без изменений */}
    </div>
  );
};
```

### 4. Анимация Zoom-In (drill-down)

```typescript
// Логика в TreemapNode при drill-down:

// Когда data меняется (выбран один Unit):
// 1. Все ноды, кроме zoomTarget, получают exit animation
// 2. zoomTarget расширяется на весь экран (layout animation)
// 3. После завершения (onAnimationComplete) показываем Teams

const zoomTargetVariants = {
  initial: { opacity: 1 },
  zoomed: {
    x: 0,
    y: 0,
    width: '100%',
    height: '100%',
    transition: {
      type: "tween",
      ease: [0.4, 0, 0.2, 1],
      duration: 0.5,
    }
  }
};

const exitVariants = {
  exit: (exitDirection: { x: number, y: number }) => ({
    x: exitDirection.x,
    y: exitDirection.y,
    scale: 0,
    opacity: 0.6,
    transition: {
      type: "tween",
      ease: [0.4, 0, 0.2, 1],
      duration: 0.5,
    }
  })
};
```

### 5. Анимация Zoom-Out (navigate up)

```typescript
// Обратная анимация:
// 1. Текущий fullscreen Unit сжимается к своей позиции
// 2. Остальные Units "въезжают" с краёв (initial state = за экраном)
// 3. AnimatePresence mode="sync" синхронизирует всё

const enterFromOutsideVariants = {
  initial: (direction: { x: number, y: number }) => ({
    x: direction.x,
    y: direction.y,
    scale: 0,
    opacity: 0.6,
  }),
  animate: {
    x: 0,
    y: 0,
    scale: 1,
    opacity: 1,
    transition: {
      type: "tween",
      ease: [0.4, 0, 0.2, 1],
      duration: 0.6,
    }
  }
};
```

### 6. Появление вложенного уровня (Teams/Initiatives)

```typescript
// После завершения zoom:
// Teams появляются с лёгким fade-in

const childrenVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delay: 0.5,  // Ждём завершения zoom
      duration: 0.3,
      staggerChildren: 0.05,  // Последовательное появление
    }
  }
};

// В TreemapNode:
<motion.div
  variants={childrenVariants}
  initial="hidden"
  animate="visible"
>
  {node.children?.map(child => (
    <TreemapNode key={child.path} node={child} />
  ))}
</motion.div>
```

## Структура файлов

```text
src/components/
├── treemap/
│   ├── TreemapNode.tsx          # Новый: motion-компонент ноды
│   ├── TreemapContainer.tsx     # Новый: контейнер с LayoutGroup
│   ├── TreemapTooltip.tsx       # Вынесен из BudgetTreemap
│   ├── TreemapEmptyState.tsx    # Вынесен из BudgetTreemap
│   └── useTreemapLayout.ts      # Новый: хук для D3 layout расчётов
├── BudgetTreemap.tsx            # Рефакторинг: использует новые компоненты
└── StakeholdersTreemap.tsx      # Рефакторинг: аналогично
```

## Миграционная стратегия

### Фаза 1: Создание новых компонентов (без удаления старых)
1. Установить framer-motion
2. Создать `src/components/treemap/` директорию
3. Создать `TreemapNode.tsx` с Framer Motion
4. Создать `useTreemapLayout.ts` хук

### Фаза 2: Интеграция в BudgetTreemap
1. Заменить D3 DOM-манипуляции на React-рендеринг
2. Использовать D3 только для layout-расчётов
3. Протестировать все сценарии анимации

### Фаза 3: Применить к StakeholdersTreemap
1. Переиспользовать компоненты из `treemap/`
2. Адаптировать цветовую схему

### Фаза 4: Очистка
1. Удалить старый код D3 DOM-манипуляций
2. Упростить CSS (убрать анимационные классы)

## CSS изменения

```css
/* Упрощённый treemap.css */

.treemap-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;  /* Важно для exit-анимаций */
}

.treemap-node {
  position: absolute;
  overflow: hidden;
  cursor: pointer;
  /* transition убираем — Framer Motion управляет анимациями */
}

.treemap-node:hover {
  filter: brightness(1.05);
}

/* Остальные стили (цвета, tooltip, etc.) остаются */
```

## Ожидаемый результат

```text
ZOOM-IN (идеальный сценарий):

t=0ms:    Клик на Unit B
          ┌─A─┐ ┌─B─┐ ┌─C─┐
          └───┘ └───┘ └───┘

t=100ms:  B начинает расширяться
          A,C СИНХРОННО начинают сжиматься и улетать
          ←┌A┐ ┌────B────┐ ┌C┐→

t=250ms:  B почти fullscreen
          A,C почти за экраном (сжаты + прозрачны 60%)

t=500ms:  B занимает 100% экрана
          A,C полностью за экраном, удаляются AnimatePresence

t=500ms+: Teams появляются внутри B с fade-in
          ┌─────────────────────────┐
          │  ┌Team1┐ ┌Team2┐        │
          │  └─────┘ └─────┘        │
          └─────────────────────────┘

ZOOM-OUT:  Обратный процесс — Teams fade-out,
           B сжимается, A,C въезжают с краёв
```

## Преимущества нового подхода

1. **Гарантированная синхронизация** — Framer Motion координирует все анимации
2. **Exit-анимации работают** — AnimatePresence удерживает элементы в DOM до завершения
3. **Физичность** — ease-in-out создаёт ощущение реальной камеры
4. **Maintainability** — React-way вместо императивного D3
5. **Переиспользуемость** — компоненты подходят и для Budget, и для Stakeholders

## Технические риски и митигация

| Риск | Митигация |
|------|-----------|
| Производительность при 100+ нодах | Использовать `layoutId` только для top-level, virtualization для глубоких уровней |
| Конфликт с существующим CSS | Удалить transition из `.treemap-node`, Framer Motion полностью заменяет |
| D3 layout может конфликтовать | D3 только считает позиции (pure function), не трогает DOM |

