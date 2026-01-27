
# План: Создание схемы базы данных для инициатив

## Обзор

Создание полноценной схемы PostgreSQL для хранения данных инициатив с:
- Полной историей изменений (аудит)
- Защитой по домену @dodobrands.io через RLS
- Профилями пользователей
- Совместимостью с существующей структурой данных

---

## Схема базы данных

### Таблица 1: profiles (профили пользователей)

Автоматически создается при первом входе через Google OAuth.

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Ссылка на auth.users(id) |
| email | TEXT | Email пользователя |
| full_name | TEXT | Полное имя (из Google) |
| avatar_url | TEXT | URL аватара (из Google) |
| created_at | TIMESTAMPTZ | Время создания |

### Таблица 2: initiatives (инициативы)

Основная таблица данных, соответствует `AdminDataRow` из кода.

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| unit | TEXT | Юнит (Client Platform, etc.) |
| team | TEXT | Команда (Auth&Security, Menu, etc.) |
| initiative | TEXT | Название инициативы |
| initiative_type | TEXT | Product / Stream / Enabler |
| stakeholders_list | TEXT[] | Массив стейкхолдеров |
| description | TEXT | Описание |
| documentation_link | TEXT | Ссылка на документацию |
| stakeholders | TEXT | Legacy поле (для совместимости) |
| quarterly_data | JSONB | Данные по кварталам |
| created_at | TIMESTAMPTZ | Время создания |
| created_by | UUID | Кто создал |
| updated_at | TIMESTAMPTZ | Время изменения |
| updated_by | UUID | Кто изменил |

**Структура quarterly_data (JSONB):**
```json
{
  "2025-Q1": {
    "cost": 532274,
    "otherCosts": 58632,
    "support": false,
    "onTrack": true,
    "metricPlan": "Снижение latency на 10%",
    "metricFact": "Latency снижен на 12%",
    "comment": "Успешный старт",
    "effortCoefficient": 25
  },
  "2025-Q2": { ... }
}
```

### Таблица 3: initiative_history (история изменений)

Полный аудит всех изменений для возможности отката.

| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID | Первичный ключ |
| initiative_id | UUID | Ссылка на инициативу |
| changed_by | UUID | Кто изменил |
| changed_at | TIMESTAMPTZ | Когда изменил |
| change_type | TEXT | create / update / delete |
| field_name | TEXT | Какое поле изменилось |
| old_value | JSONB | Старое значение |
| new_value | JSONB | Новое значение |

---

## Row Level Security (RLS)

### Принцип защиты

Все пользователи с email, заканчивающимся на `@dodobrands.io`, получают полный доступ (SELECT, INSERT, UPDATE, DELETE).

### Функция проверки домена

```sql
CREATE OR REPLACE FUNCTION public.is_dodo_employee()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT (auth.jwt() ->> 'email') LIKE '%@dodobrands.io'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Политики для таблицы initiatives

| Операция | Условие |
|----------|---------|
| SELECT | `is_dodo_employee() = true` |
| INSERT | `is_dodo_employee() = true` |
| UPDATE | `is_dodo_employee() = true` |
| DELETE | `is_dodo_employee() = true` |

### Политики для таблицы initiative_history

| Операция | Условие |
|----------|---------|
| SELECT | `is_dodo_employee() = true` |
| INSERT | `is_dodo_employee() = true` |

### Политики для таблицы profiles

| Операция | Условие |
|----------|---------|
| SELECT | `is_dodo_employee() = true` |
| INSERT | `auth.uid() = id` (только свой профиль) |
| UPDATE | `auth.uid() = id` (только свой профиль) |

---

## Автоматизация

### Триггер: Автообновление updated_at

При любом UPDATE на таблице initiatives автоматически обновляется поле `updated_at`.

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Триггер: Запись истории изменений

При UPDATE на initiatives автоматически создается запись в initiative_history.

```sql
CREATE OR REPLACE FUNCTION log_initiative_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Записываем изменения для каждого поля
  IF OLD.initiative IS DISTINCT FROM NEW.initiative THEN
    INSERT INTO initiative_history (...)
    VALUES (..., 'initiative', OLD.initiative, NEW.initiative);
  END IF;
  -- ... аналогично для остальных полей
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Триггер: Автосоздание профиля

При регистрации нового пользователя через auth.users автоматически создается запись в profiles.

---

## Этапы реализации

### Шаг 1: Создание таблицы profiles

- Таблица с базовыми полями (id, email, full_name, avatar_url)
- Ссылка на auth.users(id)
- RLS политики для доступа

### Шаг 2: Создание таблицы initiatives  

- Все поля из AdminDataRow
- quarterly_data как JSONB
- Индексы по unit, team для быстрой фильтрации
- RLS политики для @dodobrands.io

### Шаг 3: Создание таблицы initiative_history

- Связь с initiatives (ON DELETE CASCADE)
- RLS политики для чтения истории

### Шаг 4: Создание функций и триггеров

- Функция is_dodo_employee() для RLS
- Триггер updated_at
- Триггер для записи истории
- Триггер для автосоздания профиля

---

## Техническая информация

### SQL миграция (будет выполнена)

```sql
-- 1. Функция проверки домена
CREATE OR REPLACE FUNCTION public.is_dodo_employee()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      (auth.jwt() ->> 'email') LIKE '%@dodobrands.io',
      false
    )
  );
END;
$$;

-- 2. Таблица profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Таблица initiatives  
CREATE TABLE public.initiatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit TEXT NOT NULL,
  team TEXT NOT NULL,
  initiative TEXT NOT NULL,
  initiative_type TEXT CHECK (initiative_type IN ('Product', 'Stream', 'Enabler', '')),
  stakeholders_list TEXT[] DEFAULT '{}',
  description TEXT DEFAULT '',
  documentation_link TEXT DEFAULT '',
  stakeholders TEXT DEFAULT '',
  quarterly_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.initiatives ENABLE ROW LEVEL SECURITY;

-- Индексы для производительности
CREATE INDEX idx_initiatives_unit ON public.initiatives(unit);
CREATE INDEX idx_initiatives_team ON public.initiatives(team);
CREATE INDEX idx_initiatives_unit_team ON public.initiatives(unit, team);

-- 4. Таблица initiative_history
CREATE TABLE public.initiative_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id UUID REFERENCES public.initiatives(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
  field_name TEXT,
  old_value JSONB,
  new_value JSONB
);

ALTER TABLE public.initiative_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_history_initiative ON public.initiative_history(initiative_id);
CREATE INDEX idx_history_changed_at ON public.initiative_history(changed_at DESC);

-- 5. RLS политики
-- profiles
CREATE POLICY "Dodo employees can view profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_dodo_employee());

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- initiatives
CREATE POLICY "Dodo employees can view initiatives"
ON public.initiatives FOR SELECT
TO authenticated
USING (public.is_dodo_employee());

CREATE POLICY "Dodo employees can create initiatives"
ON public.initiatives FOR INSERT
TO authenticated
WITH CHECK (public.is_dodo_employee());

CREATE POLICY "Dodo employees can update initiatives"
ON public.initiatives FOR UPDATE
TO authenticated
USING (public.is_dodo_employee());

CREATE POLICY "Dodo employees can delete initiatives"
ON public.initiatives FOR DELETE
TO authenticated
USING (public.is_dodo_employee());

-- initiative_history
CREATE POLICY "Dodo employees can view history"
ON public.initiative_history FOR SELECT
TO authenticated
USING (public.is_dodo_employee());

CREATE POLICY "Dodo employees can insert history"
ON public.initiative_history FOR INSERT
TO authenticated
WITH CHECK (public.is_dodo_employee());

-- 6. Триггеры
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_initiatives_updated_at
  BEFORE UPDATE ON public.initiatives
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Триггер для автосоздания профиля
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

---

## Результат

После применения миграции:

1. База данных готова к хранению инициатив
2. Любой пользователь без @dodobrands.io не увидит данные
3. История изменений записывается автоматически
4. Профили создаются при первом входе
5. Можно переходить к настройке Google OAuth

---

## Следующие шаги после миграции

1. Настройка Google OAuth (потребуются credentials от IT)
2. Адаптация Admin.tsx для работы с базой данных
3. Одноразовая миграция данных из CSV
