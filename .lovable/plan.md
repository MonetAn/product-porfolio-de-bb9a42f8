

# Убрать Fade при Zoom-in анимации

## Проблема

При drill-down (клике на Unit) блоки, которые должны "уехать" за экран, сейчас **одновременно уезжают И исчезают (fade)**.

Это происходит из-за:
1. Явного `style.opacity = '0'` в JavaScript
2. CSS transition для `opacity` в классе `.animate`

## Решение

Убрать fade-эффект только для zoom-out блоков при drill-down. Они должны просто уезжать за границы экрана, оставаясь полностью видимыми.

## Изменения

### 1. `src/components/BudgetTreemap.tsx`

**Строка 511 — удалить установку opacity:**

```typescript
// Было:
htmlEl.classList.add('animate', 'zoom-out');
htmlEl.style.left = newLeft + 'px';
htmlEl.style.top = newTop + 'px';
htmlEl.style.opacity = '0';  // ← Удалить эту строку

// Станет:
htmlEl.classList.add('animate', 'zoom-out');
htmlEl.style.left = newLeft + 'px';
htmlEl.style.top = newTop + 'px';
// opacity остаётся 1 — блоки просто уезжают
```

### 2. `src/components/StakeholdersTreemap.tsx`

**Строка 450 — аналогичное удаление:**

```typescript
// Было:
htmlEl.classList.add('animate', 'zoom-out');
htmlEl.style.left = newLeft + 'px';
htmlEl.style.top = newTop + 'px';
htmlEl.style.opacity = '0';  // ← Удалить эту строку

// Станет:
htmlEl.classList.add('animate', 'zoom-out');
htmlEl.style.left = newLeft + 'px';
htmlEl.style.top = newTop + 'px';
```

### 3. `src/styles/treemap.css`

**Опционально: исключить opacity из transition для zoom-out**

Если нужна дополнительная гарантия, добавить правило:

```css
/* Zoom-out - nodes that are pushed away during drill-down */
.treemap-node.zoom-out {
  z-index: 50;
  opacity: 1 !important; /* Блоки остаются видимыми */
}
```

## Визуальный результат

```text
Before (сейчас):               After (будет):
┌───┬───┬───┐                 ┌───┬───┬───┐
│ A │ B │ C │                 │ A │ B │ C │
├───┼───┼───┤                 ├───┼───┼───┤
│ D │ E │ F │                 │ D │ E │ F │
└───┴───┴───┘                 └───┴───┴───┘
      ↓ клик на B                   ↓ клик на B
      
A,C,D,E,F уезжают              A,C,D,E,F уезжают
  + исчезают (fade)            БЕЗ fade (остаются
                               видимыми до края)
```

## Порядок реализации

1. Удалить `style.opacity = '0'` в BudgetTreemap.tsx
2. Удалить `style.opacity = '0'` в StakeholdersTreemap.tsx  
3. Протестировать на Budget вкладке
4. Если всё ОК — оценить, применять ли такой же подход к фильтрам

