
# План: Подсветка обязательных полей в карточке инициативы

## Цель
При открытии карточки пользователь сразу видит:
1. Какие поля обязательные
2. Какие из них ещё не заполнены

## Визуальный результат

```text
┌─────────────────────────────────────────────────────────────┐
│  Unit → Team                                                │
│  ═══════════════════════════════════════════════════════    │
│  Название инициативы                                        │
├─────────────────────────────────────────────────────────────┤
│  ⚠ Не заполнено: Тип, Описание                              │  ← баннер (если есть пустые)
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Тип инициативы *                                           │
│  ┌───────────────────────────────┐                          │
│  │ Выберите тип                  │  ← amber ring            │
│  └───────────────────────────────┘                          │
│                                                             │
│  Стейкхолдеры *                                             │
│  ┌ Russia ┐ ┌ Europe ┐ ┌ Turkey+ ┐  ← amber bg if none     │
│  └────────┘ └────────┘ └─────────┘                          │
│                                                             │
│  Описание *                                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │  ← amber ring if empty
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Ссылка на документацию                                     │  ← без звёздочки (опционально)
│  ┌───────────────────────────────────────────────────────┐  │
│  │ https://...                                           │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Квартальные данные                                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 25_Q1                                    On-Track ○ │    │
│  │                                                     │    │
│  │ План метрики *              Факт метрики *          │    │
│  │ ┌─────────────────┐        ┌─────────────────┐      │    │
│  │ │                 │ amber  │                 │      │    │
│  │ └─────────────────┘        └─────────────────┘      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Что будет реализовано

### 1. Красная звёздочка у обязательных полей
Добавить `*` красного цвета рядом с лейблами:
- Тип инициативы *
- Стейкхолдеры *
- Описание *
- План метрики * (в кварталах)
- Факт метрики * (в кварталах)

### 2. Янтарная обводка для пустых полей
Условный класс `ring-2 ring-amber-400` если:
- `initiativeType` пустой → подсветка Select
- `stakeholdersList.length === 0` → подсветка контейнера с кнопками
- `description` пустой → подсветка Textarea
- `metricPlan` или `metricFact` пустые → подсветка соответствующих Textarea

### 3. Баннер-предупреждение вверху
Компактный Alert с иконкой `AlertTriangle`:
- Показывается только если есть незаполненные обязательные поля
- Текст: "Не заполнено: Тип, Описание" (перечисление)
- Янтарный фон, небольшой размер

---

## Техническая реализация

### Файл: `src/components/admin/InitiativeDetailDialog.tsx`

#### 1. Добавить импорт
```tsx
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
```

#### 2. Вычислить незаполненные поля
```tsx
const missingFields: string[] = [];
if (!initiative.initiativeType) missingFields.push('Тип инициативы');
if (!initiative.stakeholdersList?.length) missingFields.push('Стейкхолдеры');
if (!initiative.description?.trim()) missingFields.push('Описание');
```

#### 3. Баннер после DialogHeader
```tsx
{missingFields.length > 0 && (
  <Alert variant="warning" className="bg-amber-50 border-amber-200 py-2">
    <AlertTriangle className="h-4 w-4 text-amber-600" />
    <AlertDescription className="text-amber-800 text-sm">
      Не заполнено: {missingFields.join(', ')}
    </AlertDescription>
  </Alert>
)}
```

#### 4. Звёздочки у лейблов
Создать компонент `RequiredLabel`:
```tsx
const RequiredLabel = ({ children }: { children: React.ReactNode }) => (
  <Label className="text-sm font-medium">
    {children} <span className="text-red-500">*</span>
  </Label>
);
```

Применить к:
- "Тип инициативы" → `<RequiredLabel>Тип инициативы</RequiredLabel>`
- "Стейкхолдеры" → `<RequiredLabel>Стейкхолдеры</RequiredLabel>`
- "Описание" → `<RequiredLabel>Описание</RequiredLabel>`
- "План метрики" → `<RequiredLabel>План метрики</RequiredLabel>`
- "Факт метрики" → `<RequiredLabel>Факт метрики</RequiredLabel>`

#### 5. Условная обводка для пустых полей
Select для типа:
```tsx
<SelectTrigger className={`w-full ${!initiative.initiativeType ? 'ring-2 ring-amber-400' : ''}`}>
```

Контейнер стейкхолдеров:
```tsx
<div className={`flex flex-wrap gap-2 p-2 rounded-md ${
  localStakeholders.length === 0 ? 'ring-2 ring-amber-400 bg-amber-50/50' : ''
}`}>
```

Textarea описания:
```tsx
<Textarea
  className={`min-h-[100px] resize-y ${!initiative.description?.trim() ? 'ring-2 ring-amber-400' : ''}`}
/>
```

Textarea метрик в кварталах:
```tsx
<Textarea
  className={`min-h-[60px] resize-y ${!qData.metricPlan?.trim() ? 'ring-2 ring-amber-400' : ''}`}
/>
<Textarea
  className={`min-h-[60px] resize-y ${!qData.metricFact?.trim() ? 'ring-2 ring-amber-400' : ''}`}
/>
```

---

## Преимущества решения
- Звёздочки — стандартный паттерн, понятен всем
- Янтарная обводка — мягкая, но заметная индикация
- Баннер — сразу показывает что именно не заполнено
- Не требует hover или дополнительных действий
- Согласуется с инлайн-индикатором в таблице (тот же янтарный цвет)
