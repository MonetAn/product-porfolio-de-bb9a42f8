

# Исправление fadingOut: неверное условие глубины

## Проблема

На строке 202 в TreemapNode.tsx условие `node.depth >= 1` не покрывает основной сценарий: когда юнит (depth 0) должен передать `fadingOut=true` своим дочерним узлам (командам, инициативам) при zoom-out. Поэтому анимация fade-out никогда не срабатывает для детей первого уровня.

## Исправление

**Файл**: `src/components/treemap/TreemapNode.tsx`, строка 202

Заменить:
```
node.depth >= 1
```
на:
```
node.depth >= 0
```

Итоговая строка:
```typescript
fadingOut={fadingOut || (animationType.includes('navigate-up') && node.depth >= 0)}
```

## Почему это безопасно

- Сами юниты (top-level) получают `fadingOut=false` из TreemapContainer (там этот проп не передается, используется default).
- Условие срабатывает только внутри рекурсивного рендера TreemapNode, то есть только для вложенных детей.
- Zoom-in, фильтры и прочие анимации не затрагиваются, так как условие привязано к `animationType.includes('navigate-up')`.

## Объем изменений

Одна строка в одном файле.

