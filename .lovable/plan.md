

# План: Уникальные цвета с последовательным назначением и hue-сдвигом

## Проблема

Текущий алгоритм `hash % 8` приводит к повторяющимся цветам при >8 сущностях или при коллизиях хешей.

---

## Решение

### A) Добавить утилиты конвертации цветов в `dataManager.ts`

```typescript
// HEX → RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

// RGB → HSL
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number }

// HSL → RGB
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number }

// RGB → HEX
function rgbToHex(r: number, g: number, b: number): string

// Сдвиг hue на заданный угол
export function shiftHue(hex: string, degrees: number): string
```

### B) Реализовать генератор расширенной палитры

```typescript
// Счётчик для последовательного назначения
let unitColorIndex = 0;

// Генерация цвета с расширением палитры
function generateExtendedColor(index: number, palette: string[]): string {
  const baseIndex = index % palette.length;
  const generation = Math.floor(index / palette.length);
  
  if (generation === 0) {
    return palette[baseIndex];
  }
  
  // Для последующих поколений — сдвигаем hue
  const hueShift = generation * 25 * (generation % 2 === 0 ? 1 : -1);
  return shiftHue(palette[baseIndex], hueShift);
}
```

### C) Обновить `getUnitColor`

```typescript
export function getUnitColor(unitName: string): string {
  if (!unitColors[unitName]) {
    if (explicitUnitColors[unitName]) {
      unitColors[unitName] = explicitUnitColors[unitName];
    } else {
      unitColors[unitName] = generateExtendedColor(unitColorIndex++, colorPalette);
    }
  }
  return unitColors[unitName];
}
```

### D) Обновить `StakeholdersTreemap.tsx`

Перенести утилиты hue-сдвига в экспорт из `dataManager.ts` и использовать аналогичную логику:

```typescript
import { shiftHue } from '@/lib/dataManager';

let stakeholderColorIndex = 0;

function generateExtendedColor(index: number): string {
  const baseIndex = index % stakeholderColorPalette.length;
  const generation = Math.floor(index / stakeholderColorPalette.length);
  
  if (generation === 0) return stakeholderColorPalette[baseIndex];
  
  const hueShift = generation * 25 * (generation % 2 === 0 ? 1 : -1);
  return shiftHue(stakeholderColorPalette[baseIndex], hueShift);
}

function getStakeholderColor(name: string): string {
  if (!stakeholderColors[name]) {
    stakeholderColors[name] = generateExtendedColor(stakeholderColorIndex++);
  }
  return stakeholderColors[name];
}
```

---

## Файлы для изменения

| Файл | Изменение |
|------|-----------|
| `src/lib/dataManager.ts` | Добавить утилиты конвертации цветов, `shiftHue`, `generateExtendedColor`, обновить `getUnitColor` |
| `src/components/StakeholdersTreemap.tsx` | Использовать `shiftHue` из dataManager, реализовать последовательное назначение |

---

## Гарантии уникальности

| Количество сущностей | Результат |
|---------------------|-----------|
| 1-8 | Уникальные цвета из базовой палитры |
| 9-16 | Hue-сдвиг +25° от базовых |
| 17-24 | Hue-сдвиг -25° от базовых |
| 25-32 | Hue-сдвиг +50° от базовых |
| ... | Продолжение паттерна |

---

## Безопасность для читаемости

Luminance остаётся неизменной при hue-сдвиге, а уже реализованная функция `getTextColorClass` автоматически подберёт белый или тёмный текст в зависимости от яркости фона.

