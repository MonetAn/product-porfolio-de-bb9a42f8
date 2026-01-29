

# Добавление настроек для просмотра и редактирования данных сотрудников

## Обнаруженная проблема с данными

При анализе базы обнаружено **несоответствие названий** между таблицами `initiatives` и `people`:

| Поле | initiatives | people | Результат |
|------|-------------|--------|-----------|
| Unit | `FAP` | `Franchise as a Product` | ❌ Не совпадает |
| Team | `База Знаний` | `Drum&Base` | ❌ Не совпадает |
| Team | `SOM (IMF)` | `Slippers of mimir` | ❌ Не совпадает |

Из-за этого при выборе `FAP` в фильтре не находится ни один сотрудник — их unit в базе записан как `Franchise as a Product`.

---

## Решение: Шестерёнка с настройками

Добавить иконку ⚙️ в правый угол хедера на странице "Люди", которая открывает **дропдаун-меню** с опциями:

```text
⚙️ ▾
├── 👁️ Просмотр сотрудников
├── ✏️ Редактирование справочника
└── 🔄 Синонимы Unit/Team
```

---

## Компоненты

### 1. Просмотр сотрудников (PeopleListDialog)

Таблица со всеми сотрудниками в БД с возможностью:
- Фильтрация по Unit, Team
- Поиск по имени
- Сортировка по колонкам
- Просмотр HR-структуры, email, дат

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 👥 Справочник сотрудников                                    [×]      │
├────────────────────────────────────────────────────────────────────────┤
│ [🔍 Поиск...]     [Unit: Все ▾]     [Team: Все ▾]     194 сотрудников │
├────────────────────────────────────────────────────────────────────────┤
│ ФИО                          │ Unit           │ Team           │ ✏️    │
├────────────────────────────────────────────────────────────────────────┤
│ Афонченко Дмитрий           │ Franchise as a │ Drum&Base      │ [✏️]  │
│ Чудова Ольга Александровна   │ Franchise as a │ Drum&Base      │ [✏️]  │
│ ...                                                                    │
└────────────────────────────────────────────────────────────────────────┘
```

### 2. Редактирование сотрудника (PersonEditDialog)

При клике на ✏️ открывается форма редактирования:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Редактирование сотрудника                                    [×]      │
├────────────────────────────────────────────────────────────────────────┤
│ ФИО:        [Афонченко Дмитрий Александрович        ]                 │
│                                                                        │
│ HR-структура: [Dodo Engineering.Franchise as a Product.Drum&Base ]    │
│                                                                        │
│ Unit:       [Franchise as a Product    ▾]  ← Dropdown с автозаполнением│
│ Team:       [Drum&Base                 ▾]                              │
│                                                                        │
│ Email:      [d.afonchenko@dodobrands.io       ]                       │
│ Должность:  [Senior Developer                  ]                      │
│                                                                        │
│                                     [Отмена]  [💾 Сохранить]          │
└────────────────────────────────────────────────────────────────────────┘
```

### 3. Синонимы Unit/Team (UnitTeamMappingDialog)

Таблица маппинга названий, чтобы `FAP` → `Franchise as a Product` и т.д.

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 🔄 Синонимы Unit/Team                                        [×]      │
├────────────────────────────────────────────────────────────────────────┤
│ Тип   │ В инициативах    │ В HR-системе           │ Действия          │
├────────────────────────────────────────────────────────────────────────┤
│ Unit  │ FAP              │ Franchise as a Product │ [Применить] [×]   │
│ Team  │ База Знаний      │ Drum&Base              │ [Применить] [×]   │
│ Team  │ SOM (IMF)        │ Slippers of mimir      │ [Применить] [×]   │
├────────────────────────────────────────────────────────────────────────┤
│ [+ Добавить маппинг]                                                  │
└────────────────────────────────────────────────────────────────────────┘
```

Кнопка **"Применить"** обновляет значения `unit`/`team` в таблице `people` по выбранному маппингу.

---

## Техническая реализация

### Новые файлы

| Файл | Назначение |
|------|------------|
| `src/components/admin/people/SettingsMenu.tsx` | Дропдаун-меню с шестерёнкой |
| `src/components/admin/people/PeopleListDialog.tsx` | Таблица просмотра всех сотрудников |
| `src/components/admin/people/PersonEditDialog.tsx` | Форма редактирования одного сотрудника |
| `src/components/admin/people/UnitTeamMappingDialog.tsx` | Таблица синонимов и массовое обновление |

### Изменения в существующих файлах

| Файл | Изменение |
|------|-----------|
| `src/pages/AdminPeople.tsx` | Добавить `<SettingsMenu />` в хедер |
| `src/hooks/usePeople.ts` | Добавить `updatePerson` для редактирования, `bulkUpdateUnit`/`bulkUpdateTeam` для маппинга |

### Хук для массового обновления

```typescript
const bulkUpdatePeopleUnit = useMutation({
  mutationFn: async ({ fromUnit, toUnit }: { fromUnit: string; toUnit: string }) => {
    const { error } = await supabase
      .from('people')
      .update({ unit: toUnit })
      .eq('unit', fromUnit);
    
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['people'] });
    toast({ title: 'Unit обновлён' });
  }
});
```

---

## Для быстрого исправления текущих данных

Сразу после реализации маппинга можно будет:

1. Добавить маппинг: `FAP` → `Franchise as a Product`
2. Нажать "Применить" — это обновит `unit` в таблице **initiatives**:
   - `UPDATE initiatives SET unit = 'Franchise as a Product' WHERE unit = 'FAP'`
   
   *Или наоборот — обновить `people` чтобы соответствовали `initiatives`:*
   - `UPDATE people SET unit = 'FAP' WHERE unit = 'Franchise as a Product'`

3. Аналогично для команд:
   - `База Знаний` → `Drum&Base` (или наоборот)
   - `SOM (IMF)` → `SOM` и `Slippers of mimir` → `SOM`

---

## Альтернатива: Сначала исправить данные, потом делать UI

Если нужно быстро починить текущую проблему, можно:

1. **Быстрый SQL-фикс** (выполнить вручную):
   ```sql
   -- Обновить людей, чтобы unit совпадал с инициативами
   UPDATE people SET unit = 'FAP' WHERE unit = 'Franchise as a Product';
   
   -- Обновить людей, чтобы team совпадал
   UPDATE people SET team = 'База Знаний' WHERE team = 'Drum&Base';
   UPDATE people SET team = 'SOM' WHERE team = 'Slippers of mimir';
   
   -- Убрать (IMF) из инициатив
   UPDATE initiatives SET team = 'SOM' WHERE team = 'SOM (IMF)';
   ```

2. **Потом** реализовать UI для настроек, чтобы в будущем такие проблемы решались без SQL.

---

## Рекомендуемый план

**Фаза 1 (быстрый фикс):**
- Исправить данные SQL-запросами — сразу заработает FAP

**Фаза 2 (UI для настроек):**
1. `SettingsMenu.tsx` — шестерёнка с дропдауном
2. `PeopleListDialog.tsx` — просмотр всех сотрудников
3. `PersonEditDialog.tsx` — редактирование одного сотрудника
4. `UnitTeamMappingDialog.tsx` — синонимы и массовое обновление

---

## Порядок изменения файлов

1. `src/hooks/usePeople.ts` — добавить мутации для редактирования и массового обновления
2. `src/components/admin/people/SettingsMenu.tsx` — создать меню
3. `src/components/admin/people/PeopleListDialog.tsx` — таблица просмотра
4. `src/components/admin/people/PersonEditDialog.tsx` — форма редактирования
5. `src/components/admin/people/UnitTeamMappingDialog.tsx` — маппинг синонимов
6. `src/pages/AdminPeople.tsx` — интегрировать SettingsMenu в хедер

