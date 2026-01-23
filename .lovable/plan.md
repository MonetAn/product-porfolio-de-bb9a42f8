

# План: Скрыть "% от бюджета на экране" при выборе одного юнита

## Почему это нужно

Когда выбран только 1 юнит:
- Для самого юнита: "% от бюджета на экране" = 100% (бесполезно)
- Для дочерних элементов: "% от бюджета на экране" = "% от Юнита" (дублирование)

В обоих случаях эта метрика не несёт дополнительной информации.

## Решение

Передать количество выбранных юнитов в компонент и показывать "% от бюджета на экране" только если выбрано 0 (все) или больше 1 юнита.

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/BudgetTreemap.tsx` | Добавить prop `selectedUnitsCount`, условие отображения |
| `src/components/StakeholdersTreemap.tsx` | Аналогичные изменения |
| `src/pages/Index.tsx` | Передать `selectedUnitsCount={selectedUnits.length}` в оба treemap |

## Техническая реализация

### 1. BudgetTreemap.tsx

**Добавить prop:**
```typescript
interface BudgetTreemapProps {
  // ... существующие props
  selectedUnitsCount?: number; // Количество выбранных юнитов
}
```

**Изменить условие отображения (строки 175-176):**
```typescript
// Показывать "% от бюджета на экране" только если выбрано 0 или >1 юнитов
const showPercentOfTotal = selectedUnitsCount === undefined || 
                           selectedUnitsCount === 0 || 
                           selectedUnitsCount > 1;

if (showPercentOfTotal) {
  const percentOfTotal = totalValue > 0 ? ((nodeValue / totalValue) * 100).toFixed(1) : '0.0';
  html += `<div class="tooltip-row"><span class="tooltip-label">% от бюджета на экране</span><span class="tooltip-value">${percentOfTotal}%</span></div>`;
}
```

### 2. StakeholdersTreemap.tsx

Аналогичные изменения с учётом того, что там группировка по стейкхолдерам, но логика та же.

### 3. Index.tsx

**Передать prop в BudgetTreemap (строка ~455):**
```typescript
<BudgetTreemap
  // ... существующие props
  selectedUnitsCount={selectedUnits.length}
/>
```

**Передать prop в StakeholdersTreemap (строка ~476):**
```typescript
<StakeholdersTreemap
  // ... существующие props
  selectedUnitsCount={selectedUnits.length}
/>
```

## Логика отображения (итоговая)

| Выбрано юнитов | % от Юнита | % от бюджета на экране |
|----------------|------------|------------------------|
| 0 (все) | Показать (если не 100%) | Показать |
| 1 | Показать (если не 100%) | Скрыть |
| 2+ | Показать (если не 100%) | Показать |

## Результат

**При выборе 1 юнита — tooltip инициативы:**
```
Бюджет           45.2 млн ₽
% от Юнита       13.6%
```

**При выборе нескольких юнитов — tooltip инициативы:**
```
Бюджет                      45.2 млн ₽
% от Юнита                  13.6%
% от бюджета на экране      2.5%
```

