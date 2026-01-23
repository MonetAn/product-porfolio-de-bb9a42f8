

# План: Улучшение отображения процентов в Treemap

## Изменения

### 1. Скрыть "% от Юнита" когда значение = 100%

Добавить условие: показывать строку "% от Юнита" только если `nodeValue !== unitValue`:

```typescript
// Показывать только для дочерних элементов (не для самих юнитов)
if (nodeValue !== unitValue) {
  const percentOfUnit = ((nodeValue / unitValue) * 100).toFixed(1);
  html += `<div class="tooltip-row"><span class="tooltip-label">% от Юнита</span><span class="tooltip-value">${percentOfUnit}%</span></div>`;
}
```

### 2. Переименовать лейбл

Изменить `"% от Всего"` → `"% от бюджета на экране"`

---

## Файлы для изменения

| Файл | Строки | Изменение |
|------|--------|-----------|
| `src/components/BudgetTreemap.tsx` | 168-170 | Обернуть в условие `if (nodeValue !== unitValue)` |
| `src/components/BudgetTreemap.tsx` | 173 | Изменить лейбл на "% от бюджета на экране" |
| `src/components/StakeholdersTreemap.tsx` | 103-105 | Обернуть в условие `if (nodeValue !== stakeholderValue)` |
| `src/components/StakeholdersTreemap.tsx` | 108 | Изменить лейбл на "% от бюджета на экране" |

---

## Результат

**До (для юнита):**
```
Бюджет           331.4 млн ₽
% от Юнита       100.0%        ← лишняя информация
% от Всего       18.7%
```

**После (для юнита):**
```
Бюджет                      331.4 млн ₽
% от бюджета на экране      18.7%
```

**После (для инициативы внутри юнита):**
```
Бюджет                      45.2 млн ₽
% от Юнита                  13.6%
% от бюджета на экране      2.5%
```

