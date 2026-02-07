

# Полная переработка fade-out при zoom-out

## Почему текущее решение не работает

Проблема `fadingOut` через `isFadingOut` состояние: дочерние узлы одновременно получают **и fade opacity, и изменение координат/размеров**. Два конкурирующих типа анимации (прозрачность + геометрия) создают дерганье и визуальные артефакты.

## Новый подход: использовать Framer Motion `exit` как задумано

Идея простая: вместо ручного управления opacity, **позволить AnimatePresence корректно запускать exit-анимацию** при удалении дочерних узлов из DOM.

Сейчас `exit` не срабатывает, потому что `AnimatePresence` обернут в условие `{shouldRenderChildren && ...}` — когда условие становится false, весь блок вместе с `AnimatePresence` удаляется, и exit-анимации не успевают запуститься.

## Конкретные изменения

### 1. `src/components/treemap/TreemapNode.tsx`

**Убрать** пропсы `fadingOut` и `childrenFadingOut` полностью. Убрать всю логику opacity через fadingOut из `animate` variant. Вернуть чистый `animate: { opacity: 1, ... }`.

**Ключевое изменение** — вынести `AnimatePresence` за пределы условия:

Было:
```text
{shouldRenderChildren && showChildren && (
  <div>
    <AnimatePresence>
      {children.map(...)}
    </AnimatePresence>
  </div>
)}
```

Станет:
```text
<AnimatePresence mode="sync">
  {shouldRenderChildren && showChildren && 
    children.map(child => <TreemapNode .../>)
  }
</AnimatePresence>
```

Теперь `AnimatePresence` всегда смонтирован, а дочерние элементы добавляются/удаляются внутри него. При удалении Framer Motion корректно запустит `exit` variant.

### 2. `src/components/treemap/TreemapContainer.tsx`

**Убрать** состояние `isFadingOut`, `setIsFadingOut`, useEffect для авто-сброса, и проп `childrenFadingOut` из `TreemapNode`.

**Убрать задержку 600мс** при уменьшении renderDepth. Сделать немедленное обновление: `setRenderDepth(targetRenderDepth)` всегда. `AnimatePresence` теперь сам отвечает за плавный exit.

Убрать `setIsFadingOut(true)` из `handleNavigateBack`.

### 3. Без изменений

- Zoom-in (drilldown) — работает как прежде
- Фильтры — работают как прежде
- Логика focusedPath — без изменений
- Тултипы — без изменений

## Как это работает

```text
Пользователь нажимает "Наверх":
  1. focusedPath сокращается → targetRenderDepth уменьшается
  2. renderDepth обновляется немедленно
  3. shouldRenderChildren = false для глубоких узлов
  4. AnimatePresence (всегда смонтирован) видит, что дети удалены → запускает exit
  5. exit: { opacity: 0, scale: 0.92, duration: 0.3 } — дети плавно исчезают
  6. Параллельно родители анимируют x/y/width/height к новым координатам
  
Результат: дети fade-out, родители плавно перестраиваются — без конфликтов
```

## Почему это лучше

- Нет ручного управления opacity — используем Framer Motion как задумано
- Нет временных состояний (`isFadingOut`) с таймерами
- Нет конкурирующих анимаций (opacity vs геометрия)
- Меньше кода, проще отладка

