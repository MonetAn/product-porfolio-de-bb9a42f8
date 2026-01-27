
# План: Адаптация Admin.tsx для работы с Supabase

## Обзор

Переход от клиентского хранения данных (localStorage + CSV) к серверной персистенции через Supabase с сохранением CSV-экспорта как backup-функционала.

---

## Архитектурные изменения

### Текущая архитектура

```text
┌─────────────────────────────────────────────────────────┐
│                      Admin.tsx                          │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │  CSV Upload  │──│ React State   │──│ CSV Download │ │
│  └──────────────┘  └───────────────┘  └──────────────┘ │
│                           │                             │
│                    ┌──────▼──────┐                      │
│                    │ localStorage │ (autosave)          │
│                    └─────────────┘                      │
└─────────────────────────────────────────────────────────┘
```

### Целевая архитектура

```text
┌─────────────────────────────────────────────────────────┐
│                      Admin.tsx                          │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │ CSV Import   │──│ React Query   │──│ CSV Export   │ │
│  │  (one-time)  │  │    Cache      │  │   (backup)   │ │
│  └──────────────┘  └───────────────┘  └──────────────┘ │
│                           │                             │
│               ┌───────────▼───────────┐                 │
│               │      useInitiatives   │                 │
│               │    (custom hooks)     │                 │
│               └───────────────────────┘                 │
│                           │                             │
│               ┌───────────▼───────────┐                 │
│               │   Supabase Database   │                 │
│               │  (initiatives table)  │                 │
│               └───────────────────────┘                 │
└─────────────────────────────────────────────────────────┘
```

---

## Новые компоненты

### 1. Хук useInitiatives

Основной хук для работы с данными инициатив.

**Файл**: `src/hooks/useInitiatives.ts`

**Функциональность**:
- Загрузка всех инициатив из Supabase
- Кэширование через React Query
- Фильтрация по Unit/Team на клиенте
- Обработка ошибок и состояния загрузки

**Интерфейс**:

| Метод | Описание |
|-------|----------|
| `data` | Массив инициатив (AdminDataRow[]) |
| `isLoading` | Флаг загрузки |
| `error` | Объект ошибки |
| `refetch` | Принудительная перезагрузка |

### 2. Хук useInitiativeMutations

Хук для CRUD-операций с автосохранением.

**Файл**: `src/hooks/useInitiativeMutations.ts`

**Функциональность**:
- Создание новой инициативы
- Обновление полей инициативы (с debounce)
- Обновление квартальных данных (с debounce)
- Удаление инициативы
- Запись в initiative_history

**Интерфейс**:

| Метод | Параметры | Описание |
|-------|-----------|----------|
| `createInitiative` | data | Создание новой записи |
| `updateInitiative` | id, field, value | Обновление поля |
| `updateQuarterData` | id, quarter, field, value | Обновление квартальных данных |
| `deleteInitiative` | id | Удаление записи |
| `isSaving` | - | Флаг сохранения |
| `pendingChanges` | - | Количество несохраненных изменений |

### 3. Хук useCSVExport

Хук для экспорта данных в CSV (backup функционал).

**Файл**: `src/hooks/useCSVExport.ts`

**Функциональность**:
- Экспорт всех инициатив в CSV
- Экспорт отфильтрованных инициатив
- Форматирование данных для Excel

---

## Изменения в существующих файлах

### Admin.tsx

**Удаляется**:
- localStorage логика (STORAGE_KEY, DraftData, autosave interval)
- Локальное состояние rawData/originalData (заменяется React Query)
- modifiedIds (заменяется optimistic updates)
- Диалог восстановления черновика
- handleFileUpload как основной источник данных

**Добавляется**:
- Использование useInitiatives для загрузки данных
- Использование useInitiativeMutations для изменений
- CSV Import как одноразовая миграция (отдельная кнопка)
- Индикатор автосохранения в header
- Обработка состояний loading/error

**Сохраняется**:
- Фильтрация по Unit/Team
- UI таблицы и диалогов
- CSV Export функционал

### AdminHeader.tsx

**Изменения**:
- Заменить индикатор "X изменено" на индикатор синхронизации
- Добавить статус автосохранения (Saving... / Saved / Error)
- Кнопка "Загрузить CSV" становится "Импорт CSV" (одноразовая миграция)

### adminDataManager.ts

**Сохраняется**:
- Типы данных (AdminDataRow, AdminQuarterData)
- INITIATIVE_TYPES, STAKEHOLDERS_LIST константы
- Утилиты фильтрации (filterData, getUniqueUnits, getTeamsForUnits)
- CSV парсинг (для импорта)
- CSV экспорт (для backup)

**Добавляется**:
- Функция конвертации DB Row → AdminDataRow
- Функция конвертации AdminDataRow → DB Insert/Update

---

## Стратегия автосохранения

### Debounce механизм

Изменения сохраняются автоматически с задержкой:

| Тип изменения | Debounce | Причина |
|---------------|----------|---------|
| Текстовые поля | 1000ms | Ожидание завершения ввода |
| Switch/Toggle | 0ms | Мгновенное сохранение |
| Числовые поля | 500ms | Быстрее текста |

### Optimistic Updates

1. Пользователь изменяет поле
2. UI обновляется мгновенно (optimistic)
3. Запрос отправляется с debounce
4. При ошибке — откат + уведомление

### Индикация состояния

| Состояние | Индикатор |
|-----------|-----------|
| Синхронизировано | Зеленая галочка |
| Сохраняется... | Спиннер |
| Ошибка синхронизации | Красный значок + retry |
| Нет подключения | Offline режим |

---

## Миграция данных

### Сценарий: Импорт существующего CSV

1. Пользователь нажимает "Импорт CSV"
2. Выбирает файл portfolio.csv
3. Диалог подтверждения с предупреждением
4. Парсинг CSV → массив инициатив
5. Batch INSERT в Supabase
6. Запись в history (change_type: 'create')
7. Обновление UI

### Защита от дублирования

При импорте проверяется уникальность по (unit, team, initiative).
Если запись существует — предлагается:
- Пропустить дубликат
- Обновить существующую запись
- Отменить импорт

---

## Этапы реализации

### Шаг 1: Создание хука useInitiatives

- Подключение к Supabase
- Загрузка данных из таблицы initiatives
- Маппинг DB Row → AdminDataRow
- Интеграция с React Query
- Обработка ошибок RLS

### Шаг 2: Создание хука useInitiativeMutations

- CRUD операции через Supabase
- Debounce для текстовых полей
- Optimistic updates
- Запись в initiative_history
- Обработка конфликтов

### Шаг 3: Создание хука useCSVExport

- Экспорт данных в формате текущего CSV
- Поддержка фильтрованного экспорта
- BOM для Excel совместимости

### Шаг 4: Рефакторинг Admin.tsx

- Удаление localStorage логики
- Интеграция новых хуков
- Обновление UI состояний
- Добавление индикатора синхронизации

### Шаг 5: Обновление AdminHeader.tsx

- Индикатор статуса синхронизации
- Кнопка импорта CSV
- Кнопка экспорта CSV (backup)

### Шаг 6: Функционал импорта CSV

- Одноразовый импорт из файла
- Валидация данных
- Batch insert с прогрессом
- Обработка дубликатов

---

## Техническая информация

### Структура хука useInitiatives

```typescript
// src/hooks/useInitiatives.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminDataRow, AdminQuarterData } from '@/lib/adminDataManager';
import { Tables } from '@/integrations/supabase/types';

type DBInitiative = Tables<'initiatives'>;

// Конвертация из DB формата в клиентский формат
function dbToAdminRow(db: DBInitiative): AdminDataRow {
  const quarterlyData = (db.quarterly_data as Record<string, AdminQuarterData>) || {};
  
  return {
    id: db.id,
    unit: db.unit,
    team: db.team,
    initiative: db.initiative,
    initiativeType: (db.initiative_type || '') as AdminDataRow['initiativeType'],
    stakeholdersList: db.stakeholders_list || [],
    description: db.description || '',
    documentationLink: db.documentation_link || '',
    stakeholders: db.stakeholders || '',
    quarterlyData,
  };
}

export function useInitiatives() {
  return useQuery({
    queryKey: ['initiatives'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('initiatives')
        .select('*')
        .order('unit')
        .order('team')
        .order('initiative');
      
      if (error) throw error;
      return (data || []).map(dbToAdminRow);
    },
  });
}
```

### Структура хука useInitiativeMutations

```typescript
// src/hooks/useInitiativeMutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRef, useCallback } from 'react';
import { AdminDataRow, AdminQuarterData } from '@/lib/adminDataManager';

export function useInitiativeMutations() {
  const queryClient = useQueryClient();
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Mutation для обновления инициативы
  const updateMutation = useMutation({
    mutationFn: async ({ 
      id, 
      field, 
      value 
    }: { 
      id: string; 
      field: string; 
      value: unknown;
    }) => {
      const { error } = await supabase
        .from('initiatives')
        .update({ [field]: value })
        .eq('id', id);
      
      if (error) throw error;
    },
    onMutate: async (variables) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['initiatives'] });
      const previous = queryClient.getQueryData(['initiatives']);
      
      queryClient.setQueryData(['initiatives'], (old: AdminDataRow[] | undefined) => 
        (old || []).map(row => 
          row.id === variables.id 
            ? { ...row, [variables.field]: variables.value }
            : row
        )
      );
      
      return { previous };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(['initiatives'], context.previous);
      }
    },
  });

  // Debounced update
  const debouncedUpdate = useCallback((
    id: string, 
    field: string, 
    value: unknown, 
    delay = 1000
  ) => {
    const key = `${id}-${field}`;
    
    // Cancel previous timer
    const existing = debounceTimers.current.get(key);
    if (existing) clearTimeout(existing);
    
    // Set new timer
    const timer = setTimeout(() => {
      updateMutation.mutate({ id, field, value });
      debounceTimers.current.delete(key);
    }, delay);
    
    debounceTimers.current.set(key, timer);
  }, [updateMutation]);

  return {
    updateInitiative: debouncedUpdate,
    createInitiative: createMutation.mutateAsync,
    deleteInitiative: deleteMutation.mutateAsync,
    isSaving: updateMutation.isPending,
    pendingChanges: debounceTimers.current.size,
  };
}
```

### Маппинг полей DB ↔ Client

| DB Column | Client Field | Тип |
|-----------|--------------|-----|
| id | id | UUID |
| unit | unit | string |
| team | team | string |
| initiative | initiative | string |
| initiative_type | initiativeType | string |
| stakeholders_list | stakeholdersList | string[] |
| description | description | string |
| documentation_link | documentationLink | string |
| stakeholders | stakeholders | string |
| quarterly_data | quarterlyData | JSONB → Record |

---

## Результат

После реализации:

1. Данные хранятся в Supabase, доступны всем сотрудникам @dodobrands.io
2. Изменения сохраняются автоматически с debounce
3. История всех изменений записывается для аудита
4. CSV экспорт остается как backup функционал
5. Одноразовый CSV импорт для миграции существующих данных
6. Offline-first UX с optimistic updates

---

## Следующие шаги после реализации

1. Тестирование с реальными данными
2. Настройка Google OAuth credentials
3. Одноразовая миграция из portfolio.csv
4. Переход к Stage 3 (People/Coefficients)
