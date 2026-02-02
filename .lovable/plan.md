

# План: Исправление double-nesting бага координат

## Корневая причина

При рекурсивном рендеринге в `TreemapNode.tsx` мы **мутируем координаты** в объекте `node`, передавая их детям:

```typescript
// Первый уровень: Unit → Team
node={{
  ...child,
  x0: child.x0 - node.x0,  // child.x0 абсолютный, node.x0 абсолютный → ОК
  y0: child.y0 - node.y0,
}}

// Второй уровень: Team → Initiative  
node={{
  ...child,
  x0: child.x0 - node.x0,  // child.x0 абсолютный, но node.x0 УЖЕ ОТНОСИТЕЛЬНЫЙ!
  y0: child.y0 - node.y0,
}}
```

Результат: инициативы получают некорректные координаты и "улетают" за границы видимости.

---

## Решение: передавать parentX/parentY отдельно

Вместо мутации координат в объекте `node`, будем:
1. Хранить в `node` всегда **абсолютные** координаты (как даёт D3)
2. Передавать `parentX` и `parentY` как отдельные props
3. Вычислять относительную позицию только в момент рендера `motion.div`

---

## Изменения в файлах

### 1. `TreemapNode.tsx` — новый подход к координатам

Добавить props:
```typescript
interface TreemapNodeProps {
  node: TreemapLayoutNode;
  parentX?: number;  // Абсолютная X родителя (default 0)
  parentY?: number;  // Абсолютная Y родителя (default 0)
  // ... остальные props
}
```

В `motion.div` вычислять позицию:
```typescript
const TreemapNode = memo(({
  node,
  parentX = 0,
  parentY = 0,
  // ...
}) => {
  // Вычисляем относительную позицию
  const x = node.x0 - parentX;
  const y = node.y0 - parentY;

  return (
    <motion.div
      animate={{ 
        opacity: 1,
        x,           // Относительная позиция
        y,           // Относительная позиция
        width: node.width,
        height: node.height,
      }}
      // ...
    >
      {/* Дети получают абсолютные координаты родителя */}
      {node.children?.map(child => (
        <TreemapNode
          key={child.key}
          node={child}  // Без мутации! Координаты остаются абсолютными
          parentX={node.x0}  // Передаём абсолютную позицию текущего узла
          parentY={node.y0}
          // ...
        />
      ))}
    </motion.div>
  );
});
```

### 2. `useTreemapLayout.ts` — динамический paddingTop

Заменить фиксированный padding на функцию от глубины:

```typescript
const treemap = d3.treemap<TreeNode>()
  .size([dimensions.width, dimensions.height])
  .paddingOuter(2)
  .paddingTop(d => {
    if (renderDepth <= 1) return 2;
    // Unit (depth 1): 18px
    // Team (depth 2): 14px  
    // Остальные: 2px
    if (d.depth === 1) return 18;
    if (d.depth === 2) return 14;
    return 2;
  })
  .paddingInner(2)
  .round(true);
```

### 3. `types.ts` — увеличить длительности анимаций

```typescript
export const ANIMATION_DURATIONS: Record<AnimationType, number> = {
  'initial': 0,
  'filter': 650,      // Было 550
  'drilldown': 800,   // Было 600
  'navigate-up': 650, // Было 550
  'resize': 420       // Было 350
};
```

---

## Визуализация исправления

```text
БЫЛО (мутация координат):
┌─────────────────────────────────────┐
│ Unit (x0=100)                       │
│  ┌───────────────────────────────┐  │
│  │ Team (x0=20 ← относительный)  │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ Init (x0=105 ← ОШИБКА!) │  │  │ ← Улетает за границы
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘

СТАНЕТ (parentX/parentY):
┌─────────────────────────────────────┐
│ Unit (x0=100, parentX=0)            │
│  ┌───────────────────────────────┐  │
│  │ Team (x0=120, parentX=100)    │  │ ← x = 120-100 = 20 ✓
│  │  ┌─────────────────────────┐  │  │
│  │  │ Init (x0=125, pX=120)   │  │  │ ← x = 125-120 = 5 ✓
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## Итоговые изменения

| Файл | Что меняется |
|------|--------------|
| `TreemapNode.tsx` | Добавить `parentX/parentY` props, убрать мутацию координат |
| `useTreemapLayout.ts` | Динамический `paddingTop` по глубине |
| `types.ts` | Увеличить длительности анимаций |

---

## Ожидаемый результат

1. Инициативы отображаются корректно на всех уровнях вложенности
2. Команды получают меньший отступ сверху (14px вместо 20px)
3. Анимации становятся плавнее и легче для восприятия

---

## Оценка

| Метрика | Значение |
|---------|----------|
| Сложность | Низкая |
| Файлов изменится | 3 |
| Вероятность успеха | 98% |

