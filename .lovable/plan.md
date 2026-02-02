

# План: Улучшение UX при переключении вкладок

## Диагноз проблемы

При переходе с Timeline на Budget/Stakeholders происходит:
1. Компонент `TreemapContainer` монтируется заново
2. В первый момент `dimensions = { width: 0, height: 0 }` (до ResizeObserver)
3. Затем размеры обновляются, D3 пересчитывает layout
4. `initial={{ opacity: 0 }}` создаёт fade-in эффект даже при `duration: 0`
5. Всё это вместе создаёт "мигание" и визуальные артефакты

Круги на скриншоте — вероятно артефакт промежуточного рендера или кэширование предыдущего состояния браузером.

---

## Решение: мгновенный первый рендер без fade

### Изменение 1: `TreemapNode.tsx` — отключить initial анимацию при initial render

Вместо:
```typescript
initial={{ opacity: 0 }}
```

Сделать conditional:
```typescript
initial={animationType === 'initial' ? false : { opacity: 0 }}
```

При `initial: false` Framer Motion **не анимирует** первое появление — элемент сразу рендерится в `animate` состоянии.

### Изменение 2: `TreemapContainer.tsx` — синхронный первый рендер

Текущая проблема: `dimensions = { width: 0, height: 0 }` → `layoutNodes = []` → ничего не рендерится → потом dimensions обновляются → рендер с fade.

Решение: использовать `useLayoutEffect` вместо `useEffect` для измерения, чтобы размеры были известны **до первой отрисовки**:

```typescript
// Было: useEffect + setTimeout
useEffect(() => {
  const updateDimensions = () => {...};
  updateDimensions();
  const resizeObserver = new ResizeObserver(() => {
    setTimeout(updateDimensions, 100);
  });
  ...
}, []);

// Станет: useLayoutEffect для синхронного измерения
import { useLayoutEffect } from 'react';

useLayoutEffect(() => {
  const updateDimensions = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    }
  };
  
  updateDimensions(); // Синхронно до paint!
  
  const resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(updateDimensions); // Для ресайзов — через RAF
  });
  ...
}, []);
```

### Изменение 3: Добавить CSS для предотвращения "вспышки"

В `treemap.css` добавить:
```css
.treemap-container {
  /* Предотвратить белую вспышку при смене вкладок */
  contain: layout style paint;
}
```

`contain: layout style paint` говорит браузеру, что внутреннее содержимое не влияет на внешний layout, что ускоряет рендеринг и предотвращает reflow.

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `TreemapNode.tsx` | `initial={animationType === 'initial' ? false : { opacity: 0 }}` |
| `TreemapContainer.tsx` | Заменить `useEffect` на `useLayoutEffect` для измерения, убрать `setTimeout` |
| `treemap.css` | Добавить `contain: layout style paint` |

---

## Ожидаемый результат

1. При переключении вкладок тремап **появляется мгновенно** без fade
2. Нет промежуточных "пустых" состояний с нулевыми размерами
3. Нет визуальных артефактов или "кругов"
4. Анимации работают только при фильтрации и drilldown (когда это уместно)

---

## Оценка

| Метрика | Значение |
|---------|----------|
| Сложность | Низкая |
| Файлов изменится | 3 |
| Риск регрессии | Минимальный |
| Улучшение UX | Значительное |

