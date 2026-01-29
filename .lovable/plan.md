

# Изменения в Product Dashboard

## 1. Переименование "ProductDashboard" → "Product Portfolio"

### Файлы для изменения:

| Файл | Изменение |
|------|-----------|
| `src/components/Header.tsx` | Изменить текст лого с "ProductDashboard" на "Product Portfolio" |
| `index.html` | Обновить `<title>`, мета-теги `og:title`, `og:description` |

### Конкретные изменения:

**Header.tsx** (строка 29):
```tsx
// Было:
<span>ProductDashboard</span>

// Станет:
<span>Product Portfolio</span>
```

**index.html**:
- `<title>` → "Product Portfolio - Управление портфелем"
- `og:title` → "Product Portfolio"
- `og:description` → "Управление портфелем продуктов с визуализацией бюджетов..."

---

## 2. Улучшение шестерёнки для интуитивности

Сейчас шестерёнка выглядит как обычная иконка и ведёт в админку. Проблема — неочевидно, что там можно **редактировать данные**.

### Варианты решения:

**Вариант A: Кнопка с текстом**
```text
[ ✏️ Редактировать ]  или  [ ⚙️ Управление ]
```
Плюс: максимально понятно
Минус: занимает место

**Вариант B: Tooltip + подсветка**
При наведении на шестерёнку показывать:
- Tooltip "Редактирование данных"
- Изменить иконку с Settings на Database или Edit

**Вариант C: Dropdown вместо перехода**
Шестерёнка открывает дропдаун:
```text
⚙️ ▾
├── 📊 Управление инициативами
├── 👥 Управление людьми
└── 📁 Импорт/Экспорт CSV
```

### Рекомендация: Вариант A + B

Заменить иконку Settings на **явную кнопку**:
```tsx
<Button variant="outline" size="sm" className="gap-2">
  <Settings size={16} />
  <span>Управление</span>
</Button>
```

Дополнительно добавить Tooltip с пояснением "Редактировать инициативы, людей и настройки".

### Файлы для изменения:

| Файл | Изменение |
|------|-----------|
| `src/components/Header.tsx` | Заменить иконку-кнопку на Button с текстом + Tooltip |

---

## 3. Добавление Support/Change соотношения на Timeline

### Что добавить:

В легенду или как отдельный блок статистики показать:

```text
┌──────────────────────────────────────────────┐
│ 📊 Итого за период:                          │
│ Development: 45.2 млн ₽ (68%)               │
│ Support: 21.3 млн ₽ (32%)                   │
└──────────────────────────────────────────────┘
```

### Логика расчёта:

```typescript
// Считаем по всем отфильтрованным инициативам за выбранные кварталы
const { supportTotal, developmentTotal } = useMemo(() => {
  let support = 0;
  let development = 0;
  
  filteredData.forEach(row => {
    selectedQuarters.forEach(q => {
      const qData = row.quarterlyData[q];
      if (qData && qData.budget > 0) {
        if (qData.support) {
          support += qData.budget;
        } else {
          development += qData.budget;
        }
      }
    });
  });
  
  return { supportTotal: support, developmentTotal: development };
}, [filteredData, selectedQuarters]);

const total = supportTotal + developmentTotal;
const supportPercent = total > 0 ? Math.round((supportTotal / total) * 100) : 0;
```

### Где разместить:

Расширить блок легенды внизу GanttView:

```text
┌─ Legend ──────────────────────────────────────────────────────────────────┐
│ [■ Development]  [■ Support]  [⊘ Off-track]                              │
│                                                                           │
│ Итого: 66.5 млн ₽  •  Development: 45.2 млн ₽ (68%)  •  Support: 21.3 млн ₽ (32%)  │
└───────────────────────────────────────────────────────────────────────────┘
```

### Файлы для изменения:

| Файл | Изменение |
|------|-----------|
| `src/components/GanttView.tsx` | Добавить расчёт и отображение Support/Development breakdown |
| `src/styles/gantt.css` | Стили для статистики в легенде (если нужны) |

---

## Техническая реализация

### Шаг 1: Header.tsx — переименование + кнопка управления

```tsx
// Лого
<span>Product Portfolio</span>

// Кнопка управления (вместо иконки)
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => navigate('/admin')}
      >
        <Settings size={16} />
        <span className="hidden sm:inline">Управление</span>
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      Редактировать инициативы, людей и настройки
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Шаг 2: index.html — мета-теги

```html
<title>Product Portfolio - Управление портфелем</title>
<meta property="og:title" content="Product Portfolio" />
```

### Шаг 3: GanttView.tsx — Support/Development статистика

Добавить useMemo для расчёта и обновить блок легенды:

```tsx
// В легенде (строки 696-709)
<div className="gantt-legend">
  {/* Существующие элементы легенды */}
  <div className="gantt-legend-item">
    <div className="gantt-legend-color development"></div>
    <span>Development</span>
  </div>
  <div className="gantt-legend-item">
    <div className="gantt-legend-color support"></div>
    <span>Support</span>
  </div>
  <div className="gantt-legend-item">
    <div className="gantt-legend-color hatched"></div>
    <span>Off-track</span>
  </div>
  
  {/* Новый блок статистики */}
  <div className="gantt-legend-divider" />
  <div className="gantt-legend-stats">
    <span>Итого: {formatBudget(total)}</span>
    <span className="development">Development: {formatBudget(developmentTotal)} ({100 - supportPercent}%)</span>
    <span className="support">Support: {formatBudget(supportTotal)} ({supportPercent}%)</span>
  </div>
</div>
```

---

## Порядок изменения файлов

1. `index.html` — обновить мета-теги
2. `src/components/Header.tsx` — переименование + кнопка управления
3. `src/components/GanttView.tsx` — добавить расчёт и отображение Support/Development
4. `src/styles/gantt.css` — стили для новой статистики (опционально)

