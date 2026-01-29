

# Автоматическое создание привязок при наличии инициативы

## Обзор изменений

Сейчас привязки людей к инициативам создаются **только** когда в админке меняется `effortCoefficient`. Это ограничивает работу — нельзя заполнять данные напрямую на странице "Люди".

Новая логика:
1. **Все комбинации доступны сразу** — если есть инициатива в команде и есть люди в этой команде, они могут быть привязаны
2. **Привязка создаётся при первом вводе** — когда пользователь впервые вводит значение в ячейку
3. **Ручные изменения не перезаписываются** — флаг `is_auto = false` защищает от перезаписи

---

## Ключевые изменения

### 1. Виртуальные привязки в таблице

Сейчас таблица показывает только существующие записи из БД. Нужно показывать **все возможные** комбинации:

```text
Было:
  Показываем только если есть запись в person_initiative_assignments

Станет:
  Для каждого человека → все инициативы его команды
  Для каждой инициативы → все люди её команды
  
  Если привязка есть в БД → показываем значения оттуда
  Если привязки нет → показываем пустые ячейки (можно ввести)
```

### 2. Создание привязки при первом вводе

Когда пользователь вводит значение в пустую ячейку:
- Если привязки нет → создать новую с `is_auto = false`
- Если привязка есть → обновить, установить `is_auto = false`

### 3. Логика синхронизации из админки

Когда в админке меняется `effortCoefficient`:
- **Если привязки нет** → создать с `is_auto = true`
- **Если `is_auto = true`** → обновить значение
- **Если `is_auto = false`** → НЕ трогать (ручное редактирование)

---

## Изменяемые файлы

| Файл | Изменение |
|------|-----------|
| `src/components/admin/people/PeopleAssignmentsTable.tsx` | Генерировать виртуальные привязки для всех комбинаций |
| `src/components/admin/people/PersonGroupRow.tsx` | Поддержка виртуальных привязок без ID |
| `src/components/admin/people/InitiativeGroupRow.tsx` | Поддержка виртуальных привязок без ID |
| `src/components/admin/people/EffortInput.tsx` | Поддержка создания новой привязки при вводе |
| `src/pages/AdminPeople.tsx` | Обновить `handleEffortChange` для создания/обновления |
| `src/hooks/usePeopleAssignments.ts` | Добавить `createOrUpdateAssignment` mutation |

---

## Техническая реализация

### Шаг 1: Виртуальные привязки

В `PeopleAssignmentsTable.tsx` генерируем все возможные комбинации:

```typescript
// Для режима "по людям"
const byPerson = useMemo(() => {
  return people.map(person => {
    // Все инициативы этой команды
    const teamInitiatives = initiatives.filter(
      i => i.unit === person.unit && i.team === person.team
    );
    
    // Для каждой инициативы — существующая или виртуальная привязка
    const personAssignments = teamInitiatives.map(initiative => {
      const existing = assignments.find(
        a => a.person_id === person.id && a.initiative_id === initiative.id
      );
      
      return existing || {
        id: null, // Виртуальная — нет ID
        person_id: person.id,
        initiative_id: initiative.id,
        quarterly_effort: {},
        is_auto: true,
        isVirtual: true
      };
    });
    
    return { person, assignments: personAssignments };
  }).filter(g => g.assignments.length > 0);
}, [people, initiatives, assignments]);
```

### Шаг 2: Обновлённый тип данных

```typescript
interface VirtualAssignment extends Partial<PersonAssignment> {
  person_id: string;
  initiative_id: string;
  quarterly_effort: Record<string, number>;
  isVirtual?: boolean; // true если ещё не в БД
}
```

### Шаг 3: Логика сохранения

```typescript
const handleEffortChange = async (
  assignment: VirtualAssignment,
  quarter: string,
  value: number
) => {
  if (assignment.isVirtual || !assignment.id) {
    // Создать новую привязку
    await createAssignment({
      person_id: assignment.person_id,
      initiative_id: assignment.initiative_id,
      quarterly_effort: { [quarter]: value },
      is_auto: false // Ручной ввод
    });
  } else {
    // Обновить существующую
    await updateAssignment({
      id: assignment.id,
      quarterly_effort: {
        ...assignment.quarterly_effort,
        [quarter]: value
      },
      is_auto: false
    });
  }
};
```

### Шаг 4: Убрать заглушку "Нет привязок"

Заменить текст "Проставьте effortCoefficient в инициативах" на реальное содержимое — теперь все комбинации доступны сразу.

---

## Визуальное отличие

- **Виртуальная привязка (ещё не в БД):** пустые ячейки, можно ввести
- **Авто-привязка (`is_auto = true`):** обычный текст
- **Ручная привязка (`is_auto = false`):** с иконкой ✎

---

## Порядок реализации

1. Обновить типы — добавить `isVirtual` флаг
2. `PeopleAssignmentsTable` — генерировать все комбинации
3. `PersonGroupRow` / `InitiativeGroupRow` — работать с виртуальными привязками
4. `EffortInput` — передавать всю информацию о привязке
5. `AdminPeople` — логика создания при первом вводе
6. Убрать заглушки "нет привязок"

