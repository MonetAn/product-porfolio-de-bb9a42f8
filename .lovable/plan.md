
# Переписать анимацию с нуля: убрать layoutId

## Корневая причина (почему ничего не помогало)

`layoutId` на `motion.div` говорит Framer Motion: "я управляю позицией этого элемента". Когда в `exit` мы пишем `x: 500`, FM пытается совместить свою layout-систему с нашими координатами — и они конфликтуют. Именно поэтому `opacity: 0` работает (FM не управляет opacity), а `x/y` — нет.

Все предыдущие фиксы (stale props, variants, убрать animationType) были правильны по логике, но бесполезны, потому что проблема уровнем ниже.

## Решение

Убрать `layoutId` полностью. Использовать только `key` + явные `x/y` через variants. Без `layoutId` Framer Motion не будет перехватывать позиционирование, и exit-анимация с координатами заработает.

## Что изменится визуально

- **Drilldown**: соседние блоки разлетаются от точки клика (push) -- то, что хотели
- **Фильтрация/навигация назад**: fade + scale (как сейчас, работает)
- **Перерасчёт позиций** (смена фильтров): блоки плавно перемещаются к новым позициям через `animate` (variants.animate уже содержит `x, y, width, height` — FM будет интерполировать между старым и новым значениями)

## Изменения

### `src/components/treemap/TreemapNode.tsx`

1. Убрать `layoutId={node.key}` из `motion.div`
2. Убрать `custom={clickCenter}` из `motion.div` (не нужен без layoutId, custom будем передавать только через AnimatePresence в контейнере)
3. Оставить всё остальное как есть: `variants`, `initial`, `animate`, `exit="exit"`, `key`

Единственное реальное изменение — удаление одной строки `layoutId={node.key}`.

### `src/components/treemap/TreemapContainer.tsx`

Без изменений. `custom={lastClickCenter}` на `AnimatePresence` остаётся — именно через него FM передаёт актуальные координаты в exit-функцию.

### Вложенный `AnimatePresence` внутри `TreemapNode.tsx` (строка 220)

Добавить `custom={clickCenter}` на вложенный `AnimatePresence`, чтобы дочерние узлы тоже получали координаты клика при exit:

```typescript
<AnimatePresence mode="sync" custom={clickCenter}>
```

## Почему это сработает

Без `layoutId` Framer Motion не перехватывает позиционирование. Элементы позиционируются через `position: absolute` + `x/y` из variants. При exit FM честно анимирует `x` и `y` к указанным значениям — блоки физически двигаются.

## Почему перепозиционирование при фильтрах не сломается

Variants.animate уже содержит `x, y, width, height`. Когда D3 пересчитывает layout и компонент получает новые координаты, FM интерполирует от старых значений к новым через `animate` transition. Это стандартное поведение variants без layoutId.

## Риски

Единственный риск: без `layoutId` FM не "узнаёт" элемент между render-циклами по идентификатору, а только по React `key`. Но наши `key` уже уникальны и стабильны (`d0-Root/UnitA`), поэтому React сохраняет identity элементов корректно. По сути `layoutId` был избыточен.

## Файлы

| Файл | Что меняется |
|---|---|
| `src/components/treemap/TreemapNode.tsx` | Убрать `layoutId`, добавить `custom` на вложенный AnimatePresence |
