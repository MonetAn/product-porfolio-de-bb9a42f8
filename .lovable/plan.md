

# Исправление text fade: обработка входящих узлов

## Проблема

Fade текста не срабатывает для **новых узлов**, которые появляются во время анимации (drill-down, включение фильтров Teams/Initiatives). `useRef` инициализируется текущими координатами, поэтому `displacement = 0` и текст показывается мгновенно, хотя блок ещё анимируется.

Это касается всех дочерних узлов, которые монтируются впервые при drill-down — Teams и Initiatives.

## Решение

### Файл: `src/components/treemap/TreemapNode.tsx`

Добавить определение "первого маунта" компонента. Если компонент монтируется во время активной анимации (`animationType !== 'initial'`), то текст тоже должен скрыться и появиться с fade.

**Изменения:**

1. Добавить `isFirstMountRef` для определения первого рендера:

```typescript
const isFirstMountRef = useRef(true);
useEffect(() => { 
  isFirstMountRef.current = false; 
}, []);
```

2. Расширить условие `needsTextFade`:

```typescript
const needsTextFade = animationType !== 'initial' && (
  displacement > 50 || sizeChange > 0.3 || categoryChanged || isFirstMountRef.current
);
```

Логика: если узел только что смонтировался И это не начальная загрузка — значит он появился в результате drill-down/фильтра и его текст должен появиться с задержкой.

3. Для entering nodes нужно убедиться что fade `key` тоже меняется при первом маунте. Текущая логика `fadeKey = needsTextFade ? 'fade-...' : 'stable'` уже это обеспечивает — при `isFirstMountRef.current = true` `needsTextFade` станет true, `animIdRef` инкрементируется, ключ будет уникальным.

## Что это НЕ затрагивает

- Начальная загрузка (`animationType === 'initial'`) — текст появляется сразу, как и раньше
- Мелкие перемещения (displacement < 50 и sizeChange < 0.3) — текст остаётся видимым
- Тайминги анимации, variants, exit-анимации — всё без изменений

## Итого

- 1 файл: `src/components/treemap/TreemapNode.tsx`
- Добавить ~3 строки (useRef + useEffect + расширение условия)
- Исправляет корневую причину "летающего текста" при drill-down

