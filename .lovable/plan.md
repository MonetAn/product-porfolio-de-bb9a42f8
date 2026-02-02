

# План: Исправление вложенности, размеров и анимаций тремапа

## Выявленные проблемы

### Проблема 1: Инициативы не отображаются на части юнитов/команд

**Причина:** В `TreemapNode.tsx` при рендеринге вложенных детей координаты пересчитываются с жёстким смещением:
```tsx
x0: child.x0 - node.x0 - 4,
y0: child.y0 - node.y0 - 24,  // ← жёсткий header offset
```

Но D3 layout уже учитывает `paddingTop: 24` в расчётах. Когда эти смещения применяются повторно, маленькие блоки получают отрицательные координаты или выходят за границы родителя, становясь невидимыми.

**Решение:** Убрать двойное смещение — D3 уже рассчитал правильные позиции с учётом padding. Нужно только преобразовать абсолютные координаты в относительные (внутри родительского контейнера).

### Проблема 2: Заголовки занимают слишком много места

**Сравнение скриншотов:**
- **Было:** Компактные заголовки ~16-18px
- **Сейчас:** `paddingTop: 24px` в D3 + дополнительный padding в CSS

**Решение:** Уменьшить paddingTop до 20px и оптимизировать вёрстку заголовков.

### Проблема 3: Анимации слишком быстрые

**Текущие значения:**
```typescript
'filter': 400ms
'drilldown': 400ms
'navigate-up': 400ms
```

**Оптимальные значения для плавных анимаций:**
- 500-600ms для основных transition
- Более мягкий easing для комфорта глаз

---

## Изменения по файлам

### 1. `TreemapNode.tsx` — Исправление координат вложенных узлов

**Проблема в коде (строки 147-158):**
```tsx
<div className="absolute inset-0" style={{ padding: hasChildren ? '24px 4px 4px 4px' : '4px' }}>
  {node.children!.map(child => (
    <TreemapNode
      node={{
        ...child,
        x0: child.x0 - node.x0 - 4,       // ← двойной offset
        y0: child.y0 - node.y0 - 24,      // ← двойной offset
        x1: child.x1 - node.x0 - 4,
        y1: child.y1 - node.y0 - 24,
      }}
      ...
    />
  ))}
</div>
```

**Решение:** D3 treemap уже рассчитал координаты с учётом `paddingTop`. Смещение должно быть только относительно родителя:
```tsx
<div className="absolute inset-0">
  {node.children!.map(child => (
    <TreemapNode
      node={{
        ...child,
        x0: child.x0 - node.x0,    // Только относительно родителя
        y0: child.y0 - node.y0,    // D3 уже учёл padding!
        x1: child.x1 - node.x0,
        y1: child.y1 - node.y0,
      }}
      ...
    />
  ))}
</div>
```

### 2. `useTreemapLayout.ts` — Оптимизация padding

**Было (строки 112-117):**
```typescript
const treemap = d3.treemap<TreeNode>()
  .size([dimensions.width, dimensions.height])
  .paddingOuter(2)
  .paddingTop(renderDepth > 1 ? 24 : 2)  // ← 24px слишком много
  .paddingInner(2)
  .round(true);
```

**Станет:**
```typescript
const treemap = d3.treemap<TreeNode>()
  .size([dimensions.width, dimensions.height])
  .paddingOuter(2)
  .paddingTop(renderDepth > 1 ? 20 : 2)  // ← 20px — компактнее
  .paddingInner(2)
  .round(true);
```

### 3. `TreemapNode.tsx` — Компактный заголовок

**Было (строки 29-42):**
```tsx
if (hasChildren) {
  return (
    <div 
      className={`absolute top-1 left-1 right-1 font-semibold text-white ...`}
    >
      {node.name}
    </div>
  );
}
```

**Станет (компактнее):**
```tsx
if (hasChildren) {
  return (
    <div 
      className={`absolute top-0.5 left-1 right-1 font-semibold text-white ...`}
      style={{ 
        lineHeight: '1.2',  // Компактнее
        ...
      }}
    >
      {node.name}
    </div>
  );
}
```

### 4. `types.ts` — Оптимизация скорости анимаций

**Было (строки 51-57):**
```typescript
export const ANIMATION_DURATIONS: Record<AnimationType, number> = {
  'initial': 0,
  'filter': 400,
  'drilldown': 400,
  'navigate-up': 400,
  'resize': 300
};
```

**Станет:**
```typescript
export const ANIMATION_DURATIONS: Record<AnimationType, number> = {
  'initial': 0,
  'filter': 550,       // Плавнее
  'drilldown': 600,    // Плавнее для drilldown
  'navigate-up': 550,  // Чуть быстрее при возврате
  'resize': 350        // Для ресайза
};
```

### 5. `TreemapNode.tsx` — Оптимизация easing

**Было (строки 118-121):**
```tsx
transition={{ 
  duration,
  ease: [0.4, 0, 0.2, 1],  // Стандартный ease-out
}}
```

**Станет:**
```tsx
transition={{ 
  duration,
  ease: [0.25, 0.1, 0.25, 1],  // Более плавный (ease-in-out)
}}
```

---

## Итоговые изменения

| Файл | Изменения |
|------|-----------|
| `TreemapNode.tsx` | Убрать двойной offset при пересчёте координат, компактный заголовок, плавный easing |
| `useTreemapLayout.ts` | Уменьшить `paddingTop` с 24 до 20 |
| `types.ts` | Увеличить длительности анимаций (400 → 550-600ms) |

---

## Ожидаемый результат

1. **Инициативы видны везде** — все вложенные блоки отображаются корректно
2. **Больше места для контента** — ~20% больше площади для дочерних элементов
3. **Плавные анимации** — глаз успевает следить за переходами

---

## Оценка

| Метрика | Значение |
|---------|----------|
| Сложность | Низкая |
| Файлов изменится | 3 |
| Вероятность успеха | 95% |

