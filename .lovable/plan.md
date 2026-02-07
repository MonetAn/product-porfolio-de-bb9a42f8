

# Логика дочерних элементов при zoom in/out

## Текущая проблема

Сейчас `showTeams` и `showInitiatives` управляются только из FilterBar (Index.tsx), а внутренний зум тримапа (`focusedPath`) не влияет на галочки. Нужна двусторонняя связь: зум может автоматически включать галочки, но не должен их сбрасывать при возврате.

## Правила поведения (из запроса)

1. **Zoom in (клик на узел с детьми)**: Автоматически включить галочку "Команды", если она не была вручную выключена пользователем. Не трогать "Инициативы".
2. **Zoom out**: Никогда не убирать галочки автоматически. Если при возвращении галочки стояли -- они остаются.
3. **Ручное изменение галочки**: Запоминается. Автоматика больше не включает/выключает эту галочку до следующего полного сброса.
4. **renderDepth при зуме**: При zoom in на уровень Unit, если стоит только "Инициативы" без "Команды", показывать инициативы напрямую (Unit > Initiatives). Если стоит "Команды" -- показывать Unit > Teams.

## Изменения

### 1. `TreemapContainer.tsx` -- колбэк для автоматического включения галочек

Добавить новый проп `onAutoEnableTeams`:

```text
interface TreemapContainerProps {
  ...
  onAutoEnableTeams?: () => void;  // Called when zoom-in wants to auto-enable teams
}
```

В `handleNodeClick`, при зуме в узел с children (Unit/Stakeholder):
- Вызвать `onAutoEnableTeams?.()` если `!showTeams && !showInitiatives` (базовый вид без галочек)
- Если хотя бы одна галочка уже стоит -- не вызывать (пользователь сам настроил)

### 2. `Index.tsx` -- логика автоматического включения

Колбэк `handleAutoEnableTeams`:
- Проверяет `autoTeamsTriggeredRef` -- если уже сработал для текущего контекста, не включает повторно
- Устанавливает `showTeams = true`
- Помечает что автовключение произошло

Убрать старый `useEffect` который следил за `selectedUnits` для автовключения Teams (строки 132-151), так как теперь зум управляется внутри тримапа, а не через фильтры Unit.

### 3. `BudgetTreemap.tsx` и `StakeholdersTreemap.tsx` -- прокинуть проп

Добавить проп `onAutoEnableTeams` и передать его в `TreemapContainer`.

### 4. Render depth -- без изменений

Текущая логика уже корректна:
- `showInitiatives` -> depth 3 (Units + Teams + Initiatives)
- `showTeams` -> depth 2 (Units + Teams)
- Ни одна -> depth 1 (только Units)
- `Math.max(depth, focusedPath.length + 1)` гарантирует видимость при зуме

При zoom out галочки не снимаются, поэтому depth не уменьшается -- дочерние элементы остаются видимыми на всех уровнях.

## Файлы

| Файл | Что меняется |
|---|---|
| `src/components/treemap/TreemapContainer.tsx` | Добавить проп `onAutoEnableTeams`, вызывать его при zoom in если нет галочек |
| `src/components/BudgetTreemap.tsx` | Прокинуть `onAutoEnableTeams` |
| `src/components/StakeholdersTreemap.tsx` | Прокинуть `onAutoEnableTeams` |
| `src/pages/Index.tsx` | Добавить `handleAutoEnableTeams` колбэк, убрать старый auto-teams useEffect |

