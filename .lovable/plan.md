

# Исправление: fade-out дочерних элементов при zoom-out

## Корневая проблема

Exit-анимация (`exit` variant) **никогда не срабатывает** при zoom-out. Framer Motion вызывает `exit` только когда ключ удаляется из `AnimatePresence`. При zoom-out ключи остаются — меняются только координаты. Дети анимируются к новым крошечным размерам (сжатие), а не исчезают плавно.

Именно поэтому изменение duration exit с 150мс до 200мс не дало никакого эффекта.

## Решение

Добавить проп `fadingOut` в `TreemapNode`. Когда `animationType` включает `navigate-up`, дочерние узлы получают `fadingOut={true}` и анимируют `opacity: 0` через свой `animate` variant (не `exit`). Это работает, потому что Framer Motion **выполняет** `animate` при каждом изменении.

## Поведение

```text
Zoom-out начинается:
  animationType = 'navigate-up'
  Родительский узел: анимирует x/y/width/height к новым (меньшим) координатам
  Дочерние узлы: получают fadingOut=true → animate.opacity = 0 за 250мс
  Результат: дети плавно растворяются, пока родитель сжимается

Zoom-in:
  fadingOut = false (по умолчанию)
  Поведение не меняется
```

## Технические изменения

### 1. `src/components/treemap/TreemapNode.tsx`

- Добавить проп `fadingOut?: boolean` в `TreemapNodeProps`
- В `animate` variant: если `fadingOut === true`, установить `opacity: 0` вместо `1`, с transition `duration: 0.25`
- При рекурсивном рендере дочерних узлов: передавать `fadingOut={true}` когда `animationType` включает `'navigate-up'` И текущий узел имеет глубину >= 1

### 2. Без изменений в `TreemapContainer.tsx`

Логика остается как есть. `animationType` уже корректно устанавливается в `'navigate-up'` при zoom-out.

### 3. Удалить неработающий exit для navigate-up

Вернуть единый `exit` variant (без условия на `navigate-up`), поскольку он не срабатывает при zoom-out. Оставить стандартный `{ opacity: 0, scale: 0.92, transition: { duration: 0.3 } }` для случаев фильтрации, когда exit действительно работает.

## Что НЕ меняется

- Анимация zoom-in (drilldown)
- Анимация фильтров
- Логика renderDepth
- Структура компонентов

## Результат

При zoom-out дочерние элементы плавно растворяются за 250мс через opacity, независимо от геометрического сжатия родителя. Больше нет эффекта "схлопывания в точку".

