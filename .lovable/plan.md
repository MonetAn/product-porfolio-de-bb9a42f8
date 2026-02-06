

# Фикс: убрать stale `animationType` из exit-условия

## Проблема

Код уже использует `variants` — Gemini ошибся, старые inline-пропсы давно удалены. Настоящая причина: строка 163 проверяет `animationType === 'drilldown'`, но эта переменная — часть замыкания exiting-узла, который видит предыдущее значение (например, `'filter'` или `'initial'`). Механизм `custom` в `AnimatePresence` прокидывает только `clickCenter`, а `animationType` остаётся stale.

## Решение

Убрать `animationType === 'drilldown'` из условия. Наличие `customClickCenter !== null` уже является надёжным индикатором drilldown, потому что `lastClickCenter` сбрасывается в `null` при `filter` и `navigate-up` в `TreemapContainer.tsx`.

## Изменение

### `src/components/treemap/TreemapNode.tsx`, строка 163

Было:
```typescript
if (animationType === 'drilldown' && customClickCenter && containerDimensions && !isHero) {
```

Станет:
```typescript
if (customClickCenter && containerDimensions && !isHero) {
```

Одна строка. Больше ничего не меняется.

## Почему это безопасно

В `TreemapContainer.tsx` (строки ~140-141) при `navigate-up` и `filter` выполняется:
```typescript
setLastClickCenter(null);
setClickedNodeKey(null);
```
Это значение передаётся как `custom` в `AnimatePresence`, поэтому `customClickCenter` будет `null` для всех не-drilldown сценариев -- fallback `{ opacity: 0, scale: 0.92 }` сработает корректно.

