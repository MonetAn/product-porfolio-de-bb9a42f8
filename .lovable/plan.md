

# План: Исправление 4-го уровня вложенности Stakeholders и повторной установки галочки

## Проблемы

### Проблема 1: Четвёртый уровень вложенности в Stakeholders не показывается

**Причина:** В `useTreemapLayout.ts` `renderDepth` максимум 3, но иерархия Stakeholders имеет 4 уровня:
- Stakeholder (depth 0)
- Unit (depth 1)  
- Team (depth 2)
- Initiative (depth 3)

Условие `depth < maxDepth` означает, что при `renderDepth = 3` узлы с `depth === 3` не рендерятся.

### Проблема 2: Галочка «Команды» проставляется повторно после ручного снятия

**Причина:** `useEffect` в `Index.tsx` срабатывает каждый раз, когда `selectedUnits.length === 1 && !showTeams`. После ручного снятия галочки условие снова true → галочка включается снова.

---

## Решение

### A) Увеличить renderDepth для Stakeholders treemap

**Файл:** `src/components/treemap/useTreemapLayout.ts`

Добавить параметр `extraDepth` (или `isStakeholdersView`), который увеличивает глубину рендеринга на 1 для Stakeholders.

Либо проще — передавать `renderDepth` напрямую из компонента:
- Budget: `renderDepth = 3` (Unit → Team → Initiative)
- Stakeholders: `renderDepth = 4` (Stakeholder → Unit → Team → Initiative)

**Изменения:**
1. Добавить опциональный параметр `extraDepth?: number` в `UseTreemapLayoutOptions`
2. При расчёте `renderDepth` прибавлять `extraDepth` (по умолчанию 0)
3. В `StakeholdersTreemap.tsx` передавать `extraDepth={1}`

**Файл:** `src/components/treemap/TreemapContainer.tsx`
- Прокинуть новый проп `extraDepth` в `useTreemapLayout`

**Файл:** `src/components/StakeholdersTreemap.tsx`
- Передать `extraDepth={1}` в `TreemapContainer`

### B) Исправить логику автоматического включения галочки «Команды»

**Файл:** `src/pages/Index.tsx`

Использовать `useRef` для отслеживания, было ли уже выполнено автоматическое включение для текущего выбора Unit:

```typescript
const autoTeamsTriggeredRef = useRef<string | null>(null);

useEffect(() => {
  if (selectedUnits.length === 1) {
    const unitName = selectedUnits[0];
    // Только если это новый Unit (не тот, для которого уже включили)
    if (autoTeamsTriggeredRef.current !== unitName && !showTeams) {
      setShowTeams(true);
      autoTeamsTriggeredRef.current = unitName;
    }
  } else {
    // Сбросить флаг при изменении выбора
    autoTeamsTriggeredRef.current = null;
  }
}, [selectedUnits, showTeams]);
```

Таким образом:
1. При выборе Unit → галочка включается один раз
2. Если пользователь снимает галочку → `autoTeamsTriggeredRef` уже содержит имя Unit → повторно не включается
3. При выборе другого Unit или сбросе → ref сбрасывается, готов к следующему drilldown

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/components/treemap/useTreemapLayout.ts` | Добавить параметр `extraDepth` для увеличения глубины рендеринга |
| `src/components/treemap/TreemapContainer.tsx` | Прокинуть `extraDepth` в хук |
| `src/components/StakeholdersTreemap.tsx` | Передать `extraDepth={1}` |
| `src/pages/Index.tsx` | Исправить логику auto-enable с помощью ref-флага |

---

## Ожидаемый результат

1. **Stakeholders:** При включённых галочках «Команды» и «Инициативы» показываются все 4 уровня (Stakeholder → Unit → Team → Initiative)
2. **Галочка «Команды»:** Автоматически включается при выборе Unit только один раз. Пользователь может её снять, и она не будет включаться повторно до выбора другого Unit

---

## Оценка

| Метрика | Значение |
|---------|----------|
| Сложность | Низкая |
| Файлов изменится | 4 |
| Риск регрессии | Минимальный |

