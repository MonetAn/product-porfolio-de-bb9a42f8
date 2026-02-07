

# Исправление бага: клик на команду не срабатывает с первого раза

## Причина

Guard timeout (`isAnimatingRef`) установлен на **1450мс**, что блокирует любые клики на это время. При клике на юнит помимо анимации (1400мс) срабатывает `onAutoEnableTeams`, который пересчитывает layout. Пользователь кликает на команду раньше, чем истечёт guard, и клик "проглатывается".

## Решение

Вместо ускорения анимации -- сделать guard "умнее":

1. **Уменьшить guard timeout с 1450мс до 1100мс** в `TreemapContainer.tsx`. Анимация drilldown длится 1400мс, но визуально узлы уже на своих местах к ~70-80% длительности (easing `[0.4, 0, 0.2, 1]` завершает основное движение в первых 60% времени). Пользователь должен иметь возможность кликнуть, пока анимация ещё "дотягивается" последние миллисекунды.

2. **Добавить очередь кликов** (queue) -- если клик пришёл во время анимации, запомнить его и выполнить сразу после снятия guard. Это устраняет проблему полностью: пользователь кликает когда хочет, система обрабатывает запрос в правильный момент.

## Технические изменения

### `src/components/treemap/TreemapContainer.tsx`

- Добавить `pendingClickRef = useRef<TreemapLayoutNode | null>(null)` для хранения отложенного клика
- В `handleNodeClick`: если `isAnimatingRef.current === true`, сохранить узел в `pendingClickRef` вместо игнорирования
- В `setTimeout` (снятие guard): проверить `pendingClickRef` и вызвать `handleNodeClick` с сохранённым узлом
- Уменьшить timeout с `1450` до `1100`

```text
Было:
  if (isAnimatingRef.current) return;  // клик потерян
  ...
  setTimeout(() => { isAnimatingRef.current = false; }, 1450);

Станет:
  if (isAnimatingRef.current) {
    pendingClickRef.current = node;    // клик сохранён
    return;
  }
  ...
  setTimeout(() => {
    isAnimatingRef.current = false;
    if (pendingClickRef.current) {
      const pending = pendingClickRef.current;
      pendingClickRef.current = null;
      handleNodeClick(pending);        // клик выполнен
    }
  }, 1100);
```

### Результат

- Анимация drilldown остаётся 1400мс (плавная, как настроили)
- Пользователь может кликнуть на команду в любой момент -- клик не потеряется
- Визуально переход будет бесшовным: второй drill-down начнётся сразу после первого
