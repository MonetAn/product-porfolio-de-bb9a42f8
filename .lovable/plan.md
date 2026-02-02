
# План: Исправление архитектуры тултипа — mouseLeave на каждой ноде

## Проблема

Текущая архитектура полагается только на `mouseEnter` для смены тултипа. `mouseLeave` обрабатывается только на уровне контейнера, поэтому при переходе между элементами старый тултип "прилипает".

**Симптом**: Навёлся на элемент A → увидел тултип A → перешёл на элемент B → тултип A всё ещё показывается (иногда с обновлённой позицией).

## Решение

### 1. Добавить `onMouseLeave` на каждую ноду

Когда курсор покидает конкретную ноду, нужно:
- Проверить, что эта нода действительно была "активной" (`hoveredNodeRef.current === node`)
- Если да — сбросить тултип и refs

```typescript
// TreemapNode.tsx — добавить onMouseLeave в пропсы
onMouseLeave={(e) => {
  e.stopPropagation();
  onMouseLeave?.(node); // Передаём ноду для проверки
}}
```

### 2. Изменить сигнатуру `onMouseLeave`

Текущая сигнатура: `() => void`
Новая сигнатура: `(node?: TreemapLayoutNode) => void`

Если вызывается с нодой — это leave конкретного элемента.
Если без ноды — это leave всего контейнера.

### 3. Логика в `handleMouseLeave`

```typescript
const handleMouseLeave = useCallback((node?: TreemapLayoutNode) => {
  // Cancel pending updates
  if (tooltipTimeoutRef.current !== null) {
    clearTimeout(tooltipTimeoutRef.current);
    tooltipTimeoutRef.current = null;
  }
  
  // If leaving a specific node, only clear if it's the active one
  if (node) {
    if (hoveredNodeRef.current?.key === node.key) {
      hoveredNodeRef.current = null;
      hoveredDepthRef.current = -1;
      setTooltipData(null);
    }
    // Otherwise ignore — cursor moved to a deeper child
    return;
  }
  
  // Leaving container — always clear
  hoveredNodeRef.current = null;
  hoveredDepthRef.current = -1;
  setTooltipData(null);
}, []);
```

### 4. Прокинуть `onMouseLeave` в дочерние ноды

```typescript
// TreemapNode.tsx — в рекурсивном рендере
{node.children!.map(child => (
  <TreemapNode
    ...
    onMouseLeave={onMouseLeave}  // ← Добавить!
  />
))}
```

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `TreemapContainer.tsx` | Изменить `handleMouseLeave` для приёма опциональной ноды |
| `TreemapNode.tsx` | 1) Добавить `onMouseLeave` в рекурсивный вызов детей<br>2) Изменить обработчик `onMouseLeave` на ноде для передачи `node` |
| `types.ts` (опционально) | Обновить тип callback если используется |

---

## Итоговый flow событий

```text
Сценарий: Курсор переходит с Node A на Node B

1. mouseLeave(A) → проверка: hoveredNodeRef === A? 
   - Да → сбросить тултип, refs
   
2. mouseEnter(B) → обновить refs, запланировать новый тултип

Результат: Тултип A исчезает мгновенно, тултип B появляется через 5ms ✓
```

---

## Почему это сработает

1. **Каждая нода отвечает за свой leave** — не полагаемся на порядок enter-событий
2. **Проверка `hoveredNodeRef.current?.key === node.key`** — предотвращает ложные срабатывания при bubbling
3. **`e.stopPropagation()`** — предотвращает всплытие leave-события к родителям

---

## Альтернатива: CSS pointer-events

Можно также добавить небольшой `gap` между нодами, чтобы курсор технически "выходил" на пустое пространство между ними. Но это изменит визуал treemap.

---

## Оценка

| Метрика | Значение |
|---------|----------|
| Сложность | Низкая |
| Файлов изменится | 2 |
| Риск регрессии | Низкий |
| Надёжность | Высокая — детерминированная логика |
