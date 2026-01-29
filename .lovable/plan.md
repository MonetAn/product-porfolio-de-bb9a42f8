

# Переработка страницы "Люди" с синхронизацией фильтров и данных

## Обзор задачи

Переделать страницу `/admin/people` так, чтобы:
1. Фильтры синхронизировались с `/admin` (выбрал Unit/Team там — они же выбраны здесь)
2. Данные (коэффициенты) связаны: проставил effortCoefficient в инициативе — автоматически создаются привязки для всех людей команды с этим значением
3. Таблица похожа на админку по структуре, но с возможностью переключения группировки (по людям / по инициативам)
4. Валидация: сумма усилий человека по инициативам = 100% в квартале

---

## Архитектура данных

```text
initiatives.quarterly_data[Q].effortCoefficient = 40%
                    |
                    v (автосоздание привязок при изменении)
person_initiative_assignments
 - person_id (каждый из команды)
 - initiative_id
 - quarterly_effort[Q] = 40% (изначально)
 - is_auto = true (метка автопроставления)
```

При ручном редактировании quarterly_effort → `is_auto = false`, визуально выделяется.

---

## Этап 1: Синхронизация фильтров через URL

### Подход
Использовать URL query params для передачи фильтров между страницами.

```text
/admin?units=Client+Platform&teams=Auth+Security
          ↓ клик "Люди"
/admin/people?units=Client+Platform&teams=Auth+Security
```

### Изменения

| Файл | Изменение |
|------|-----------|
| `src/pages/Admin.tsx` | Читать/писать фильтры в URL через `useSearchParams` |
| `src/pages/AdminPeople.tsx` | Читать фильтры из URL при загрузке |
| `src/components/admin/AdminHeader.tsx` | Ссылка на People передаёт текущие фильтры в URL |

---

## Этап 2: Зависимые фильтры (Unit → Team)

### Логика
- Выбрал Unit → доступны только Team из этого Unit
- Если выбран Team не из текущего Unit → сбросить Team
- Используем `ScopeSelector` вместо текущего `PeopleFilters`

### Изменения

| Файл | Изменение |
|------|-----------|
| `src/pages/AdminPeople.tsx` | Заменить `PeopleFilters` на `ScopeSelector` + логика зависимости |
| Удалить | `src/components/admin/people/PeopleFilters.tsx` (больше не нужен) |

---

## Этап 3: Миграция БД — добавить `is_auto` флаг

### SQL

```sql
ALTER TABLE public.person_initiative_assignments
ADD COLUMN is_auto boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.person_initiative_assignments.is_auto IS 
  'true = автопроставлено из initiative effortCoefficient, false = вручную отредактировано';
```

---

## Этап 4: Автосоздание привязок при изменении effortCoefficient

### Логика

Когда пользователь изменяет `quarterlyData[Q].effortCoefficient` для инициативы:

1. Найти всех людей, у которых `unit` и `team` совпадают с инициативой
2. Для каждого человека:
   - Если привязки нет → создать с `quarterly_effort[Q] = value`, `is_auto = true`
   - Если привязка есть и `is_auto = true` → обновить `quarterly_effort[Q] = value`
   - Если `is_auto = false` → НЕ трогать (пользователь вручную поменял)

### Изменения

| Файл | Изменение |
|------|-----------|
| `src/hooks/useInitiativeMutations.ts` | После updateQuarterData с `effortCoefficient` — вызвать синхронизацию |
| `src/hooks/usePeopleAssignments.ts` | Добавить `syncAssignmentsFromInitiative()` mutation |

---

## Этап 5: Новая структура таблицы

### Колонки (как в админке)

| Unit | Team | Initiative | Type | Stakeholders | ФИО | Q1 % | Q2 % | Q3 % | Q4 % | ∑ |

### Toggle группировки

Переключатель: "По людям" / "По инициативам"

**По людям (дефолт):**
```text
┌─ Иванов И.И. (Auth&Security) ─────────── ∑Q1:95% ✓ ──┐
│  Антифрод        Product   Russia    [40%] [35%] ...  │
│  Авторизация     Enabler   IT        [30%] [25%] ...  │
│  Безопасность    Stream    Europe    [25%] [35%] ...  │
└───────────────────────────────────────────────────────┘
┌─ Петров П.П. (Auth&Security) ─────────── ∑Q1:110% ⚠ ─┐
│  ...                                                   │
└───────────────────────────────────────────────────────┘
```

**По инициативам:**
```text
┌─ Антифрод (Product, Russia) ─────────────────────────┐
│  Иванов И.И.     Auth&Sec  [40%] [35%] [30%] [25%]   │
│  Петров П.П.     Auth&Sec  [60%] [55%] [50%] [45%]   │
│                            ─────────────────────────  │
│                  Итого:    100% ✓ 90%   80%   70%    │
└───────────────────────────────────────────────────────┘
```

### Изменения

| Файл | Изменение |
|------|-----------|
| `src/pages/AdminPeople.tsx` | Полная переработка: toggle группировки, новая логика |
| `src/components/admin/people/PeopleTable.tsx` | Удалить, создать новые компоненты |
| Новый | `src/components/admin/people/PeopleAssignmentsTable.tsx` — основная таблица |
| Новый | `src/components/admin/people/PersonGroupRow.tsx` — раскрывающаяся группа по человеку |
| Новый | `src/components/admin/people/InitiativeGroupRow.tsx` — раскрывающаяся группа по инициативе |

---

## Этап 6: Визуальное различие auto vs manual

### Стили

- **Авто (is_auto = true):** обычный текст, возможно чуть бледнее
- **Ручное (is_auto = false):** с цветной подложкой или иконкой ручки

```text
[40%]       ← авто, обычный
[35%] ✎     ← ручное, с пометкой
```

При редактировании значения → `is_auto = false`.

---

## Этап 7: Валидация 100% для каждого человека

### UI

В заголовке группы человека показывать:
- `∑Q1: 95% ✓` — норма
- `∑Q1: 110% ⚠` — превышение (красный)
- `∑Q1: 60%` — недозаполнено (серый)

В заголовке группы инициативы (при группировке по инициативам):
- Сумма всех людей vs ожидаемый effortCoefficient

---

## Этап 8: Кварталы из базы

### Изменения

Использовать `useQuarters(initiatives)` вместо hardcoded списка.
Кварталы будут такие же, как в админке.

---

## Новые/изменяемые файлы

| Файл | Действие |
|------|----------|
| Миграция | `is_auto` колонка в `person_initiative_assignments` |
| `src/pages/Admin.tsx` | URL query params для фильтров |
| `src/pages/AdminPeople.tsx` | Полная переработка |
| `src/components/admin/AdminHeader.tsx` | Передавать фильтры в URL ссылки People |
| `src/hooks/useInitiativeMutations.ts` | Синхронизация привязок при изменении effort |
| `src/hooks/usePeopleAssignments.ts` | Добавить `syncAssignmentsFromInitiative`, `is_auto` поддержка |
| Удалить | `src/components/admin/people/PeopleFilters.tsx` |
| Удалить | `src/components/admin/people/PeopleTable.tsx` |
| Новый | `src/components/admin/people/PeopleAssignmentsTable.tsx` |
| Новый | `src/components/admin/people/PersonGroupRow.tsx` |
| Новый | `src/components/admin/people/InitiativeGroupRow.tsx` |
| Изменить | `src/components/admin/people/PersonDetailDialog.tsx` → убрать (не нужен) |

---

## Порядок реализации

1. **Миграция** — добавить `is_auto` колонку
2. **URL фильтры** — синхронизация между Admin и AdminPeople
3. **Зависимые фильтры** — заменить PeopleFilters на ScopeSelector
4. **Автосоздание привязок** — при изменении effortCoefficient
5. **Новая таблица** — с toggle группировки и inline-редактированием
6. **Визуальные метки** — auto vs manual
7. **Валидация** — суммы по людям/инициативам

