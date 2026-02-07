

# Логика галочек "Команды" и "Инициативы" -- текущее состояние и предложение

## Текущая логика (как есть сейчас)

1. **Галочки "Команды" и "Инициативы"** -- управляются из FilterBar, состояние в Index.tsx (`showTeams`, `showInitiatives`)
2. **Zoom in (клик на Unit/Team)** -- вызывает `onAutoEnableTeams`, который включает "Команды", но **только один раз** за всю сессию (`autoTeamsTriggeredRef === 'zoom'` -- никогда не сбрасывается)
3. **Zoom out** -- не трогает галочки
4. **Дерево данных** -- строится с учетом текущих галочек (если "Команды" выключены, дерево плоское Unit-only)

## Проблема

- `autoTeamsTriggeredRef` ставится в `'zoom'` при первом клике и никогда не сбрасывается, поэтому повторные zoom-in не включают команды
- Условие `!showTeams && !showInitiatives` -- если пользователь вручную выключил "Команды" и кликнул снова, автовключение не срабатывает повторно

## Предложение по UX

**Простая модель: zoom in всегда показывает детей**

Каждый клик на Unit/Team/Stakeholder -- это запрос "покажи мне что внутри". Поэтому:

1. **Клик на Unit** -- всегда включает "Команды" (если выключена) и делает zoom. Пользователь видит команды внутри юнита
2. **Клик на Team** -- всегда включает "Инициативы" (если выключена) и делает zoom. Пользователь видит инициативы внутри команды
3. **Клик на Stakeholder** -- аналогично Unit, включает "Команды"
4. **Ручное выключение галочки** -- работает как обычно. Пользователь может убрать "Команды" и видеть только юниты внутри зума. Следующий клик на узел снова включит нужную галочку
5. **Zoom out** -- галочки не трогает

Никакого `autoTeamsTriggeredRef` -- каждый клик на узел умно включает нужный уровень. Это интуитивно: "я кликнул -- покажи детей".

## Технические изменения

### 1. `Index.tsx` -- упростить `handleAutoEnableTeams`

Убрать `autoTeamsTriggeredRef` и guard. Колбэк просто включает галочку:

```typescript
const handleAutoEnableTeams = useCallback(() => {
  setShowTeams(true);
}, []);
```

Добавить аналогичный колбэк для инициатив:

```typescript
const handleAutoEnableInitiatives = useCallback(() => {
  setShowInitiatives(true);
}, []);
```

Прокинуть оба колбэка в `BudgetTreemap` и `StakeholdersTreemap`.

### 2. `TreemapContainer.tsx` -- добавить `onAutoEnableInitiatives` и умную логику

Новый проп: `onAutoEnableInitiatives?: () => void`

В `handleNodeClick`:
- Клик на **Unit/Stakeholder** -- вызвать `onAutoEnableTeams?.()` (если `!showTeams`)
- Клик на **Team** -- вызвать `onAutoEnableInitiatives?.()` (если `!showInitiatives`)

```typescript
if (isNonLeaf) {
  if (node.data.isUnit || node.data.isStakeholder) {
    if (!showTeams) onAutoEnableTeams?.();
  } else if (node.data.isTeam) {
    if (!showInitiatives) onAutoEnableInitiatives?.();
  }
  // ... zoom logic
}
```

### 3. `BudgetTreemap.tsx` и `StakeholdersTreemap.tsx` -- прокинуть новый проп

Добавить `onAutoEnableInitiatives` в интерфейс и передать в `TreemapContainer`.

### 4. `Index.tsx` -- удалить `autoTeamsTriggeredRef`

Убрать ref и всю связанную логику.

## Файлы

| Файл | Изменение |
|---|---|
| `src/pages/Index.tsx` | Упростить `handleAutoEnableTeams`, добавить `handleAutoEnableInitiatives`, удалить `autoTeamsTriggeredRef`, прокинуть оба колбэка |
| `src/components/treemap/TreemapContainer.tsx` | Добавить проп `onAutoEnableInitiatives`, умная логика в `handleNodeClick` по типу узла |
| `src/components/BudgetTreemap.tsx` | Прокинуть `onAutoEnableInitiatives` |
| `src/components/StakeholdersTreemap.tsx` | Прокинуть `onAutoEnableInitiatives` |

