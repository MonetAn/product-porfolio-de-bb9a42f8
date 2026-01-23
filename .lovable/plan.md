

# План: Двухстрочный лейбл для "% от бюджета"

## Визуальный результат

```
Бюджет ─────────────────── 45.2 млн ₽
% от Юнита ────────────────── 13.6%
% от бюджета ─────────────────  2.5%
  выбранного на экране
```

Основной лейбл: "% от бюджета" — стандартный размер (13px)
Подпись: "выбранного на экране" — мелкий шрифт (10px), светло-серый, отступ слева

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/styles/treemap.css` | Добавить стили для `.tooltip-label-sub` |
| `src/components/BudgetTreemap.tsx` | Изменить HTML структуру строки |
| `src/components/StakeholdersTreemap.tsx` | Аналогичные изменения |

## Техническая реализация

### 1. CSS (treemap.css)

Добавить новые стили после `.tooltip-label` (строка ~185):

```css
/* Two-line label with subtitle */
.tooltip-label-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tooltip-label-sub {
  font-size: 10px;
  color: hsl(var(--muted-foreground) / 0.7);
  padding-left: 2px;
}
```

### 2. BudgetTreemap.tsx (строки 179-182)

Изменить HTML с:
```typescript
html += `<div class="tooltip-row"><span class="tooltip-label">% от бюджета на экране</span><span class="tooltip-value">${percentOfTotal}%</span></div>`;
```

На:
```typescript
html += `<div class="tooltip-row">
  <span class="tooltip-label tooltip-label-group">
    <span>% от бюджета</span>
    <span class="tooltip-label-sub">выбранного на экране</span>
  </span>
  <span class="tooltip-value">${percentOfTotal}%</span>
</div>`;
```

### 3. StakeholdersTreemap.tsx

Аналогичные изменения в функции `showTooltip`.

## Альтернативные варианты текста подписи

Если "выбранного на экране" не подходит, можно использовать:
- "от выбранных юнитов"
- "отображаемого"
- "по фильтру"

