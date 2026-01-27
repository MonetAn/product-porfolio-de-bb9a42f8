
# План: Комплексное улучшение UX Admin Panel

## Что делаем

1. **localStorage автосохранение** — защита от потери данных
2. **Hover-only карандаш** — меньше визуального шума
3. **Динамическая навигация** — заглушка без выбора Unit/Team, скрытие колонок после выбора
4. **Компактный warning** — формат `⚠ 2` вместо текста

---

## 1. localStorage Автосохранение

### Файл: `src/pages/Admin.tsx`

**Добавить константы и состояние:**
```typescript
const STORAGE_KEY = 'admin_portfolio_draft';
const AUTOSAVE_INTERVAL = 30000; // 30 секунд

const [showRestoreDialog, setShowRestoreDialog] = useState(false);
const [savedDraft, setSavedDraft] = useState<{...} | null>(null);
```

**Логика автосохранения (useEffect):**
- Каждые 30 секунд сохранять `rawData`, `quarters`, `originalHeaders`, `modifiedIds` в localStorage
- Сохранять только если есть изменения (`hasChanges`)
- При монтировании проверять наличие черновика и показывать диалог восстановления

**Диалог восстановления:**
```text
┌─────────────────────────────────────────────┐
│  Найден несохранённый черновик              │
│                                             │
│  Последнее изменение: 15:30, 27 янв         │
│  Инициатив: 45                              │
│                                             │
│  [Восстановить]  [Удалить черновик]         │
└─────────────────────────────────────────────┘
```

---

## 2. Hover-only Карандаш

### Файл: `src/components/admin/InitiativeTable.tsx`

**Изменить строку 188:**
```tsx
// Было:
<Pencil size={14} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />

// Станет:
<Pencil size={14} className="opacity-0 group-hover:opacity-100 text-muted-foreground group-hover:text-primary transition-all flex-shrink-0" />
```

Карандаш появляется только при наведении на строку.

---

## 3. Динамическая Навигация

### Файл: `src/pages/Admin.tsx`

**Добавить условие для заглушки:**
```tsx
const needsSelection = hasData && selectedUnits.length === 0;
```

**Новый блок заглушки после ScopeSelector:**
```text
┌─────────────────────────────────────────────┐
│                                             │
│        📋 Выберите Unit и Team              │
│                                             │
│  Для просмотра и редактирования инициатив   │
│  выберите Unit и Team в фильтрах выше       │
│                                             │
└─────────────────────────────────────────────┘
```

### Файл: `src/components/admin/InitiativeTable.tsx`

**Скрыть колонки Unit и Team когда выбраны фильтры:**

Добавить проп `hideUnitTeamColumns`:
```typescript
interface InitiativeTableProps {
  // ...existing props
  hideUnitTeamColumns?: boolean;
}
```

Условно рендерить колонки:
```tsx
{!hideUnitTeamColumns && (
  <>
    <TableHead className="sticky left-[140px] ...">Unit</TableHead>
    <TableHead className="sticky left-[230px] ...">Team</TableHead>
  </>
)}
```

Пересчитать `left` для Initiative:
```tsx
// Если колонки скрыты: left-[140px] вместо left-[330px]
<TableHead className={`sticky ${hideUnitTeamColumns ? 'left-[140px]' : 'left-[330px]'} ...`}>
```

**Экономия места: ~190px**

---

## 4. Компактный Warning

### Файл: `src/components/admin/InitiativeTable.tsx`

**Заменить блок warning (строки 189-202):**
```tsx
// Было:
{initiativeIncomplete && (() => {
  const missingFields = getMissingInitiativeFields(row);
  return (
    <div className="flex items-center gap-1 text-amber-600">
      <AlertTriangle size={12} />
      <span className="text-xs truncate">
        {missingFields.length <= 2 
          ? missingFields.join(', ')
          : `${missingFields.length} поля`
        }
      </span>
    </div>
  );
})()}

// Станет:
{initiativeIncomplete && (
  <div className="flex items-center gap-0.5 text-amber-600">
    <AlertTriangle size={12} />
    <span className="text-xs font-medium">{getMissingInitiativeFields(row).length}</span>
  </div>
)}
```

**Визуальный результат:**
```text
До:    ✎ ⚠ Тип, Стейкх.     (много места)
После: ✎ ⚠ 2               (компактно)
```

**Уменьшить ширину первой колонки:**
```tsx
// Было:
<TableHead className="sticky left-0 bg-card z-10 min-w-[140px] w-[140px]">

// Станет:
<TableHead className="sticky left-0 bg-card z-10 min-w-[60px] w-[60px]">
```

---

## Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `src/pages/Admin.tsx` | + localStorage автосохранение, + диалог восстановления, + заглушка без выбора Unit |
| `src/components/admin/InitiativeTable.tsx` | + hover-only карандаш, + скрытие колонок Unit/Team, + компактный warning `⚠ N` |

---

## Визуальный результат

### До выбора Unit/Team:
```text
┌─ Фильтры ──────────────────────────────────┐
│ Unit: [▼ Выберите]   Team: [▼ Выберите]    │
└────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│                                             │
│     Выберите Unit и Team для просмотра      │
│                                             │
└─────────────────────────────────────────────┘
```

### После выбора (Unit/Team колонки скрыты):
```text
┌─────────────────────────────────────────────────────────────────┐
│    │ Initiative          │ Type  │ Stakeh. │ ...  │ Q1  │ Q2   │
├─────────────────────────────────────────────────────────────────┤
│ ✎  │ Payment System      │ Prod  │ S, A    │ ...  │ ... │ ...  │
│⚠ 2 │ Auth Refactor       │ —     │ —       │ ...  │ ... │ ...  │
│ ✎  │ Mobile App          │ Strm  │ M       │ ...  │ ... │ ...  │
└─────────────────────────────────────────────────────────────────┘
  ↑                               
  карандаш появляется при hover   
```

---

## Оценка
~6-8 кредитов (2 файла, комплексные изменения)
