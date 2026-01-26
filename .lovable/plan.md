
# Этап 1: Базовая админка Portfolio

## Цель
Создать страницу `/admin` с полным offline workflow:
- Загрузка Portfolio CSV
- Выбор Unit/Team для редактирования
- Редактируемая таблица инициатив
- Скачивание обновленного CSV

---

## Файловая структура

```text
src/
├── pages/
│   └── Admin.tsx                    # Главная страница админки
├── components/
│   └── admin/
│       ├── AdminHeader.tsx          # Шапка с навигацией и действиями
│       ├── ScopeSelector.tsx        # Выбор Unit → Team (каскадный)
│       ├── InitiativeTable.tsx      # Основная редактируемая таблица
│       ├── QuarterCell.tsx          # Ячейка квартальных данных
│       └── NewInitiativeDialog.tsx  # Диалог создания инициативы
├── lib/
│   └── adminDataManager.ts          # Парсинг и экспорт для админки
└── App.tsx                          # + роут /admin
```

---

## Компоненты

### 1. App.tsx — добавление роута
- Импорт страницы Admin
- Новый Route path="/admin"

### 2. AdminHeader.tsx
- Лого + название "Админка"
- Кнопка "Дашборд" (навигация на /)
- Кнопка "Загрузить CSV" (drag-and-drop поддержка)
- Кнопка "Скачать CSV" (активна когда есть данные)
- Индикатор: "Загружено X инициатив"

### 3. ScopeSelector.tsx
- Два каскадных селекта (переиспользуем паттерн из FilterBar)
- Unit: обязательный выбор (single или multi)
- Team: фильтруется по выбранным Unit, опционально
- Кнопка "Все команды" для просмотра всего Unit

### 4. InitiativeTable.tsx
Горизонтально скроллируемая таблица:

**Фиксированные колонки (слева):**
| Unit | Team | Initiative | Description | Doc Link |
|------|------|------------|-------------|----------|

**Скроллируемые колонки (кварталы):**
Для каждого квартала (2025-Q1, 2025-Q2, ...):
| Cost | OnTrack | Metric Plan | Metric Fact | Other Costs | Comment |

**Редактируемость:**
- Unit, Team: read-only (серый фон)
- Cost: read-only (серый фон, автоматически из CSV)
- Initiative, Description, Doc Link: редактируемые (белый фон)
- OnTrack: checkbox
- Metric Plan/Fact, Other Costs, Comment: текстовые поля

### 5. QuarterCell.tsx
Компактный редактор для одного квартала:
- Отображает ключевые поля
- Раскрывается при клике для полного редактирования
- Визуальная индикация: зеленый/красный для OnTrack

### 6. NewInitiativeDialog.tsx
Модальное окно для создания новой инициативы:
- Выбор Unit, Team (предзаполнено из текущего scope)
- Поля: Initiative name, Description, Doc Link
- Создает пустые записи для всех кварталов

---

## Модель данных

### AdminDataRow (расширенная)
```typescript
interface AdminDataRow {
  // Идентификация
  id: string;                    // Уникальный ID для React key
  unit: string;
  team: string;
  initiative: string;
  
  // Редактируемые поля
  description: string;
  documentationLink: string;     // НОВОЕ поле
  stakeholders: string;
  
  // Квартальные данные
  quarterlyData: Record<string, AdminQuarterData>;
  
  // Мета
  isNew?: boolean;               // Флаг новой инициативы
  isModified?: boolean;          // Флаг изменений
}

interface AdminQuarterData {
  cost: number;                  // Read-only (из CSV)
  otherCosts: number;            // Editable
  support: boolean;              // Read-only
  onTrack: boolean;              // Editable
  metricPlan: string;            // Editable
  metricFact: string;            // Editable
  comment: string;               // Editable
}
```

---

## Логика парсинга (adminDataManager.ts)

### parseAdminCSV()
Расширенный парсер, который извлекает:
1. Базовые поля: Unit, Team, Initiative, Description
2. **Documentation Link** — новая колонка после Description
3. Stakeholders
4. Квартальные данные:
   - `XX_QY_Стоимость` → cost
   - `XX_QY_Other Costs` → otherCosts (НОВОЕ)
   - `XX_QY_Поддержка` → support
   - `XX_QY_On-Track` → onTrack
   - `XX_QY_Metric Plan` → metricPlan
   - `XX_QY_Metric Fact` → metricFact
   - `XX_QY_Comment` → comment

### exportAdminCSV()
Генерация CSV с сохранением формата:
1. Сохраняем порядок колонок как в оригинале
2. Добавляем Documentation Link после Description
3. Экспорт в UTF-8 с BOM для корректного открытия в Excel
4. Обработка кавычек и запятых в значениях

---

## User Flow

```text
1. Пользователь открывает /admin
2. Видит пустой экран с областью drag-and-drop
3. Загружает CSV (перетаскивание или кнопка)
4. Выбирает Unit (обязательно)
5. Опционально выбирает Team
6. Видит таблицу с инициативами
7. Редактирует нужные поля (изменения сразу в state)
8. Может создать новую инициативу (+)
9. Нажимает "Скачать CSV"
10. Получает обновленный файл
```

---

## Визуальный стиль

Переиспользуем существующие компоненты:
- Table, TableHead, TableRow, TableCell из shadcn/ui
- Input, Checkbox для редактирования
- Select для Unit/Team
- Dialog для создания инициативы
- Button для действий
- Toast для уведомлений

Цветовая схема:
- Read-only ячейки: `bg-muted/50`
- Editable ячейки: `bg-background`
- Измененные ячейки: `ring-2 ring-primary/30`
- OnTrack true: зеленый индикатор
- OnTrack false: красный индикатор

---

## Навигация между дашбордом и админкой

**В Header дашборда:**
- Добавить иконку/кнопку "Админка" рядом с Upload

**В AdminHeader:**
- Кнопка "← Дашборд" для возврата

---

## Технические детали

### Хранение состояния
```typescript
// Admin.tsx
const [rawData, setRawData] = useState<AdminDataRow[]>([]);
const [originalData, setOriginalData] = useState<AdminDataRow[]>([]);
const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
const [availableQuarters, setAvailableQuarters] = useState<string[]>([]);
```

### Inline редактирование
- При клике на ячейку — фокус на input
- onBlur — сохранение в state
- Визуальная индикация изменений (сравнение с originalData)

### Предупреждение о несохраненных изменениях
- beforeunload event для предупреждения при уходе
- Toast при попытке загрузить новый CSV с несохраненными изменениями

---

## Порядок реализации

1. **Роутинг**: App.tsx + базовая страница Admin.tsx
2. **AdminHeader**: навигация и кнопки действий
3. **adminDataManager.ts**: парсинг с новыми полями
4. **ScopeSelector**: выбор Unit/Team
5. **InitiativeTable**: базовая таблица с горизонтальным скроллом
6. **Inline editing**: редактирование ячеек
7. **NewInitiativeDialog**: создание новых инициатив
8. **Export**: генерация и скачивание CSV
9. **Polish**: предупреждения, toast-уведомления, индикаторы изменений
