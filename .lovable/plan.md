

# Автоматический сброс уровней вложенности при zoom-out

## Идея

При drill-down система автоматически включает уровни вложенности (Teams, Initiatives). При zoom-out она должна симметрично их выключать -- но только те, что были включены автоматически, а не вручную пользователем.

## Поведение

```text
Drill-down в юнит:
  autoEnabled = { teams: true }
  showTeams = true

Drill-down в команду:
  autoEnabled = { teams: true, initiatives: true }
  showTeams = true, showInitiatives = true

Zoom-out на уровень юнита:
  autoEnabled.initiatives было true → выключаем showInitiatives
  autoEnabled = { teams: true }

Zoom-out на корень:
  autoEnabled.teams было true → выключаем showTeams
  autoEnabled = {}

Если пользователь вручную включил "Команды" (через чекбокс):
  autoEnabled.teams = false (не помечено как авто)
  При zoom-out "Команды" НЕ выключаются
```

## Технические изменения

### 1. `src/pages/Index.tsx`

- Добавить ref `autoEnabledRef = useRef({ teams: false, initiatives: false })`
- Изменить `handleAutoEnableTeams`:
  - Если `showTeams` уже true (пользователь включил вручную) -- не помечать как auto
  - Иначе: `setShowTeams(true)` + `autoEnabledRef.current.teams = true`
- Аналогично `handleAutoEnableInitiatives`
- Добавить `handleAutoDisableTeams` и `handleAutoDisableInitiatives`:
  - Если `autoEnabledRef.current.teams === true` → `setShowTeams(false)`, сбросить флаг
  - Аналогично для initiatives
- При ручном переключении чекбокса Teams/Initiatives пользователем -- сбросить соответствующий `autoEnabledRef` флаг в `false`
- Передать `onAutoDisableTeams` и `onAutoDisableInitiatives` в тримапы

### 2. `src/components/treemap/TreemapContainer.tsx`

- Добавить пропсы `onAutoDisableTeams?: () => void` и `onAutoDisableInitiatives?: () => void`
- В `handleNavigateBack`: после изменения `focusedPath`, определить какой уровень покидаем:
  - Если уходим с глубины 2+ на 1 (покидаем команду) → `onAutoDisableInitiatives?.()`
  - Если уходим с глубины 1 на 0 (покидаем юнит/стейкхолдер) → `onAutoDisableTeams?.()`
- Логика определения: сравнить `focusedPath.length` до и после (oldLength vs newLength)

### 3. `src/components/BudgetTreemap.tsx` и `src/components/StakeholdersTreemap.tsx`

- Прокинуть новые пропсы `onAutoDisableTeams` и `onAutoDisableInitiatives`

### 4. Сброс autoEnabled при ручном переключении

- В Index.tsx, при ручном переключении `showTeams` через FilterBar:
  - `autoEnabledRef.current.teams = false`
- Аналогично для `showInitiatives`
- Это гарантирует, что ручной выбор не будет отменён при zoom-out

## Что НЕ меняется

- Анимации zoom-in/out
- Логика auto-enable при drill-down (только добавляется tracking)
- Визуальное поведение фильтров как breadcrumbs
- Кнопка "Наверх"

## Результат

- При drill-down уровни появляются автоматически (как сейчас)
- При zoom-out автоматически включённые уровни убираются -- тримап не перегружается
- Если пользователь сам включил уровень через чекбокс -- он сохраняется при zoom-out

