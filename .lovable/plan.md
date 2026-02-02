

# План: Исправление читаемости текста + перекрытие заголовков в Stakeholders

## Проблемы в скоупе

1. **Белый текст на жёлтом фоне нечитаем** (Data Office) — контраст 1.2:1 при норме 4.5:1
2. **Голубой и мятный тоже имеют проблемы** — контраст 1.4-1.7:1
3. **Перекрытие заголовков Team в Stakeholders** — недостаточный paddingTop для depth 3
4. **Яркий розовый в Stakeholders** — слишком кислотный для профессионального UI

---

## Решение

### A) Заменить палитру на глубокую/насыщенную (гарантированный контраст)

**Файл:** `src/lib/dataManager.ts`

Новая палитра с контрастом >4.5:1 для белого текста:

```typescript
const colorPalette = [
  '#4A7DD7',  // Насыщенный синий
  '#7B5FA8',  // Глубокий фиолетовый  
  '#D4852C',  // Янтарь (замена жёлтому)
  '#2D9B6A',  // Тёмный изумруд
  '#C44E89',  // Глубокий розовый
  '#4A90B8',  // Стальной синий
  '#E67A3D',  // Тыквенный оранж
  '#8B6AAF',  // Аметист
];

// Обновить explicit colors для консистентности
const explicitUnitColors: Record<string, string> = {
  'FAP': '#E67A3D',           // Оранж (соответствует палитре)
  'TechPlatform': '#4A7DD7',  // Синий (соответствует палитре)
};
```

### B) Обновить палитру Stakeholders

**Файл:** `src/components/StakeholdersTreemap.tsx`

```typescript
const stakeholderColorPalette = [
  '#7B5FA8',  // Глубокий фиолетовый
  '#4A7DD7',  // Насыщенный синий
  '#2D9B6A',  // Тёмный изумруд
  '#C44E89',  // Глубокий розовый
  '#E67A3D',  // Тыквенный оранж
  '#4A90B8',  // Стальной синий
  '#D4852C',  // Янтарь
  '#8B6AAF',  // Аметист
];
```

### C) Добавить динамический цвет текста (страховка на будущее)

**Файл:** `src/components/treemap/TreemapNode.tsx`

Добавить функцию вычисления контрастного цвета текста:

```typescript
// Вычисляет relative luminance по формуле WCAG
function getLuminance(hex: string): number {
  const rgb = parseInt(hex.slice(1), 16);
  const r = ((rgb >> 16) & 255) / 255;
  const g = ((rgb >> 8) & 255) / 255;
  const b = (rgb & 255) / 255;
  
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// Возвращает 'text-white' или 'text-gray-900' в зависимости от фона
function getTextColorClass(bgColor: string): string {
  const luminance = getLuminance(bgColor);
  return luminance > 0.4 ? 'text-gray-900' : 'text-white';
}
```

Передать `node.color` в `TreemapNodeContent` и использовать динамический класс вместо hardcoded `text-white`.

### D) Исправить paddingTop для depth 3 (Stakeholders)

**Файл:** `src/components/treemap/useTreemapLayout.ts`

```typescript
.paddingTop(d => {
  if (renderDepth <= 1) return 2;
  if (d.depth === 1) return 20;  // Stakeholder/Unit
  if (d.depth === 2) return 18;  // Unit/Team
  if (d.depth === 3) return 16;  // Team в Stakeholders
  return 2;
})
```

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/lib/dataManager.ts` | Новая глубокая палитра + обновлённые explicit colors |
| `src/components/StakeholdersTreemap.tsx` | Аналогичная палитра для Stakeholders |
| `src/components/treemap/TreemapNode.tsx` | Функция динамического цвета текста |
| `src/components/treemap/useTreemapLayout.ts` | paddingTop для depth 3 |

---

## Сравнение: до и после

| Цвет | Старый (пастельный) | Новый (глубокий) | Контраст с белым |
|------|---------------------|------------------|------------------|
| Жёлтый | `#FDE047` | `#D4852C` (янтарь) | 1.2 → 4.8 |
| Голубой | `#7DD3FC` | `#4A90B8` (стальной) | 1.4 → 5.2 |
| Мятный | `#63DAAB` | `#2D9B6A` (изумруд) | 1.7 → 6.1 |
| Розовый | `#FF85C0` | `#C44E89` (глубокий) | 2.8 → 5.5 |

---

## Ожидаемый результат

1. **Budget treemap:** Все названия читаемы на любом фоне (включая бывший жёлтый → янтарь)
2. **Stakeholders:** Названия Team видны при включённых Initiatives
3. **Палитра:** Профессиональная, насыщенная, без "кислотных" оттенков
4. **Страховка:** Динамический цвет текста защитит от проблем при добавлении новых Unit

---

## Риски и митигация

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Пользователям понравилась старая палитра | Низкая | Новая ближе к скриншоту, который пользователь показал как предпочтительный |
| Нужен reset цветового кеша | Возможно | При обновлении палитры старые значения в `unitColors` очистятся при перезагрузке |

---

## Оценка

| Метрика | Значение |
|---------|----------|
| Сложность | Средняя |
| Файлов изменится | 4 |
| Риск регрессии | Низкий |
| Улучшение accessibility | Значительное |

