

# Исправление ошибки импорта людей

## Проблема

Ошибка: `there is no unique or exclusion constraint matching the ON CONFLICT specification`

**Причина**: Код импорта использует `upsert` с `onConflict: 'external_id'`, но в таблице `people` нет уникального ограничения на колонку `external_id`.

## Решение

Добавить UNIQUE constraint на колонку `external_id` в таблице `people`.

### Миграция базы данных

```sql
ALTER TABLE public.people 
ADD CONSTRAINT people_external_id_unique UNIQUE (external_id);
```

Это позволит:
- Использовать `upsert` с `onConflict: 'external_id'`
- При повторном импорте обновлять существующих сотрудников вместо создания дубликатов
- Гарантировать уникальность HR ID в системе

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| Новая миграция | `ALTER TABLE` для добавления UNIQUE constraint |

## Результат

После применения миграции импорт CSV будет работать корректно:
- Новые сотрудники создаются
- Существующие (по `external_id`) обновляются

