// ===== DATA TYPES =====
export interface QuarterData {
  budget: number;
  support: boolean;
  onTrack: boolean;
  metricPlan: string;
  metricFact: string;
  comment: string;
}

export interface RawDataRow {
  unit: string;
  team: string;
  initiative: string;
  description: string;
  stakeholders: string;
  quarterlyData: Record<string, QuarterData>;
}

export interface TreeNode {
  name: string;
  children?: TreeNode[];
  value?: number;
  description?: string;
  stakeholders?: string[];
  support?: boolean;
  offTrack?: boolean;
  quarterlyData?: Record<string, QuarterData>;
  isUnit?: boolean;
  isTeam?: boolean;
  isInitiative?: boolean;
  isRoot?: boolean;
  isStakeholder?: boolean;
}

// ===== CSV PARSING =====
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.toString().replace(/[\s\u00A0]/g, '').replace(/,/g, '.');
  return parseFloat(cleaned) || 0;
}

export function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toString().toUpperCase().trim();
  return v === 'TRUE' || v === '1' || v === 'ДА';
}

export function normalizeStakeholders(value: string): string {
  if (!value) return '';
  const parts = value.split(',').map(s => s.trim()).filter(s => s);
  parts.sort();
  return parts.join(', ');
}

export function detectPeriodsFromHeaders(headers: string[]): { years: string[]; quarters: string[] } {
  const yearSet = new Set<string>();
  const quarterSet = new Set<string>();
  const regex = /(\d{2})_Q(\d)/;

  headers.forEach(h => {
    const match = h.match(regex);
    if (match) {
      const year = '20' + match[1];
      const quarter = year + '-Q' + match[2];
      yearSet.add(year);
      quarterSet.add(quarter);
    }
  });

  return {
    years: Array.from(yearSet).sort(),
    quarters: Array.from(quarterSet).sort()
  };
}

export function parseCSV(text: string): {
  rawData: RawDataRow[];
  availableYears: string[];
  availableQuarters: string[];
  stakeholderCombinations: string[];
} {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    return { rawData: [], availableYears: [], availableQuarters: [], stakeholderCombinations: [] };
  }

  const headers = parseCSVLine(lines[0]);
  const { years: availableYears, quarters: availableQuarters } = detectPeriodsFromHeaders(headers);

  const rawData: RawDataRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 5) continue;

    const row: RawDataRow = {
      unit: values[0]?.trim() || '',
      team: values[1]?.trim() || '',
      initiative: values[2]?.trim() || '',
      description: values[3]?.trim() || '',
      stakeholders: normalizeStakeholders(values[4] || ''),
      quarterlyData: {}
    };

    if (!row.unit || !row.initiative) continue;

    // Parse quarterly data
    availableQuarters.forEach(q => {
      const prefix = q.replace('20', '').replace('-', '_') + '_';
      const costIdx = headers.findIndex(h => h.includes(prefix + 'Стоимость'));
      const supportIdx = headers.findIndex(h => h.includes(prefix + 'Поддержка'));
      const onTrackIdx = headers.findIndex(h => h.includes(prefix + 'On-Track'));
      const otherCostsIdx = headers.findIndex(h => h.includes(prefix + 'Other Costs'));
      const metricPlanIdx = headers.findIndex(h => h.includes(prefix + 'Metric Plan'));
      const metricFactIdx = headers.findIndex(h => h.includes(prefix + 'Metric Fact'));
      const commentIdx = headers.findIndex(h => h.includes(prefix + 'Comment'));

      const cost = parseNumber(values[costIdx]) || 0;
      const otherCosts = parseNumber(values[otherCostsIdx]) || 0;

      row.quarterlyData[q] = {
        budget: cost + otherCosts,
        support: parseBoolean(values[supportIdx]),
        onTrack: parseBoolean(values[onTrackIdx]),
        metricPlan: values[metricPlanIdx] || '',
        metricFact: values[metricFactIdx] || '',
        comment: values[commentIdx] || ''
      };
    });

    rawData.push(row);
  }

  // Collect unique stakeholder combinations
  const combos = new Set<string>();
  rawData.forEach(row => {
    if (row.stakeholders) {
      combos.add(row.stakeholders);
    }
  });

  return {
    rawData,
    availableYears,
    availableQuarters,
    stakeholderCombinations: Array.from(combos).sort()
  };
}

// ===== BUDGET CALCULATION =====
export function calculateBudget(row: RawDataRow, selectedQuarters: string[]): number {
  let total = 0;
  selectedQuarters.forEach(q => {
    if (row.quarterlyData[q]) {
      total += row.quarterlyData[q].budget;
    }
  });
  return total;
}

// Calculate total budget across ALL quarters (for Gantt total cost)
export function calculateTotalBudget(row: RawDataRow): number {
  let total = 0;
  Object.values(row.quarterlyData).forEach(qData => {
    total += qData.budget;
  });
  return total;
}

// Get all quarters where initiative has budget
export function getInitiativeQuarters(row: RawDataRow): string[] {
  return Object.keys(row.quarterlyData).filter(q => row.quarterlyData[q].budget > 0);
}

export function isInitiativeSupport(row: RawDataRow, selectedQuarters: string[]): boolean {
  if (selectedQuarters.length === 0) return false;
  const lastQ = selectedQuarters[selectedQuarters.length - 1];
  return row.quarterlyData[lastQ]?.support ?? false;
}

export function isInitiativeOffTrack(row: RawDataRow, selectedQuarters: string[]): boolean {
  if (selectedQuarters.length === 0) return false;
  const lastQ = selectedQuarters[selectedQuarters.length - 1];
  return row.quarterlyData[lastQ] ? !row.quarterlyData[lastQ].onTrack : false;
}

// ===== DATA TREE BUILDING =====
export interface BuildTreeOptions {
  selectedQuarters: string[];
  hideSupportInitiatives: boolean;
  showOnlyOfftrack: boolean;
  selectedStakeholders: string[];
  unitFilter: string;
  teamFilter: string;
  selectedUnits?: string[];
  selectedTeams?: string[];
  // NEW: control tree structure based on toggles
  showTeams?: boolean;
  showInitiatives?: boolean;
}

export function buildBudgetTree(rawData: RawDataRow[], options: BuildTreeOptions): TreeNode {
  const showTeams = options.showTeams ?? false;
  const showInitiatives = options.showInitiatives ?? false;

  // Different tree structures based on toggle combination:
  // 1. Nothing selected -> Units only (with aggregated value)
  // 2. Only Teams -> Units -> Teams (with aggregated values)
  // 3. Teams + Initiatives -> Units -> Teams -> Initiatives
  // 4. Only Initiatives -> Units -> Initiatives directly (skip teams)

  if (!showTeams && !showInitiatives) {
    // Case 1: Only Units - aggregate all to unit level
    return buildUnitsOnlyTree(rawData, options);
  } else if (showTeams && !showInitiatives) {
    // Case 2: Units -> Teams (aggregate initiatives into teams)
    return buildUnitsTeamsTree(rawData, options);
  } else if (showTeams && showInitiatives) {
    // Case 3: Full hierarchy Units -> Teams -> Initiatives
    return buildFullTree(rawData, options);
  } else {
    // Case 4: Units -> Initiatives directly (skip teams)
    return buildUnitsInitiativesTree(rawData, options);
  }
}

// Helper: filter row based on options
function shouldIncludeRow(row: RawDataRow, options: BuildTreeOptions, budget: number): boolean {
  if (budget === 0) return false;

  const isSupport = isInitiativeSupport(row, options.selectedQuarters);
  const isOffTrack = isInitiativeOffTrack(row, options.selectedQuarters);

  if (options.hideSupportInitiatives && isSupport) return false;
  if (options.showOnlyOfftrack && !isOffTrack) return false;
  if (options.selectedStakeholders.length > 0 && !options.selectedStakeholders.includes(row.stakeholders)) return false;
  if (options.selectedUnits && options.selectedUnits.length > 0 && !options.selectedUnits.includes(row.unit)) return false;
  if (options.unitFilter && row.unit !== options.unitFilter) return false;
  if (options.selectedTeams && options.selectedTeams.length > 0 && !options.selectedTeams.includes(row.team)) return false;
  if (options.teamFilter && row.team !== options.teamFilter) return false;

  return true;
}

// Case 1: Only Units with aggregated values
function buildUnitsOnlyTree(rawData: RawDataRow[], options: BuildTreeOptions): TreeNode {
  const unitMap: Record<string, { name: string; value: number; isUnit: boolean; children: TreeNode[] }> = {};

  rawData.forEach(row => {
    const budget = calculateBudget(row, options.selectedQuarters);
    if (!shouldIncludeRow(row, options, budget)) return;

    if (!unitMap[row.unit]) {
      unitMap[row.unit] = { name: row.unit, value: 0, isUnit: true, children: [] };
    }
    unitMap[row.unit].value += budget;
  });

  const children = Object.values(unitMap).filter(u => u.value > 0);
  return { name: 'Все Unit', children, isRoot: true };
}

// Case 2: Units -> Teams with aggregated values
function buildUnitsTeamsTree(rawData: RawDataRow[], options: BuildTreeOptions): TreeNode {
  const unitMap: Record<string, { 
    name: string; 
    children: TreeNode[]; 
    teamMap: Record<string, { name: string; value: number; isTeam: boolean; children: TreeNode[] }>; 
    isUnit: boolean 
  }> = {};

  rawData.forEach(row => {
    const budget = calculateBudget(row, options.selectedQuarters);
    if (!shouldIncludeRow(row, options, budget)) return;

    if (!unitMap[row.unit]) {
      unitMap[row.unit] = { name: row.unit, children: [], teamMap: {}, isUnit: true };
    }

    const unit = unitMap[row.unit];
    const teamName = row.team || 'Без команды';

    if (!unit.teamMap[teamName]) {
      unit.teamMap[teamName] = { name: teamName, value: 0, isTeam: true, children: [] };
      unit.children.push(unit.teamMap[teamName]);
    }

    unit.teamMap[teamName].value += budget;
  });

  const children = Object.values(unitMap)
    .map(unit => {
      const { teamMap, ...rest } = unit;
      return {
        ...rest,
        children: rest.children.filter((team: TreeNode) => (team.value || 0) > 0)
      };
    })
    .filter(unit => unit.children.length > 0);

  return { name: 'Все Unit', children, isRoot: true };
}

// Case 3: Full hierarchy Units -> Teams -> Initiatives
function buildFullTree(rawData: RawDataRow[], options: BuildTreeOptions): TreeNode {
  const unitMap: Record<string, { name: string; children: TreeNode[]; teamMap: Record<string, TreeNode>; isUnit: boolean }> = {};

  rawData.forEach(row => {
    const budget = calculateBudget(row, options.selectedQuarters);
    if (!shouldIncludeRow(row, options, budget)) return;

    const isSupport = isInitiativeSupport(row, options.selectedQuarters);
    const isOffTrack = isInitiativeOffTrack(row, options.selectedQuarters);

    if (!unitMap[row.unit]) {
      unitMap[row.unit] = { name: row.unit, children: [], teamMap: {}, isUnit: true };
    }

    const unit = unitMap[row.unit];
    const teamName = row.team || 'Без команды';

    if (!unit.teamMap[teamName]) {
      unit.teamMap[teamName] = { name: teamName, children: [], isTeam: true };
      unit.children.push(unit.teamMap[teamName]);
    }

    unit.teamMap[teamName].children!.push({
      name: row.initiative,
      value: budget,
      description: row.description,
      stakeholders: row.stakeholders ? row.stakeholders.split(', ') : [],
      support: isSupport,
      offTrack: isOffTrack,
      quarterlyData: row.quarterlyData,
      isInitiative: true
    });
  });

  const children = Object.values(unitMap)
    .map(unit => {
      const { teamMap, ...rest } = unit;
      return {
        ...rest,
        children: rest.children.filter(team => team.children && team.children.length > 0)
      };
    })
    .filter(unit => unit.children.length > 0);

  return { name: 'Все Unit', children, isRoot: true };
}

// Case 4: Units -> Initiatives directly (skip teams)
function buildUnitsInitiativesTree(rawData: RawDataRow[], options: BuildTreeOptions): TreeNode {
  const unitMap: Record<string, { name: string; children: TreeNode[]; isUnit: boolean }> = {};

  rawData.forEach(row => {
    const budget = calculateBudget(row, options.selectedQuarters);
    if (!shouldIncludeRow(row, options, budget)) return;

    const isSupport = isInitiativeSupport(row, options.selectedQuarters);
    const isOffTrack = isInitiativeOffTrack(row, options.selectedQuarters);

    if (!unitMap[row.unit]) {
      unitMap[row.unit] = { name: row.unit, children: [], isUnit: true };
    }

    unitMap[row.unit].children.push({
      name: row.initiative,
      value: budget,
      description: row.description,
      stakeholders: row.stakeholders ? row.stakeholders.split(', ') : [],
      support: isSupport,
      offTrack: isOffTrack,
      quarterlyData: row.quarterlyData,
      isInitiative: true
    });
  });

  const children = Object.values(unitMap).filter(unit => unit.children.length > 0);
  return { name: 'Все Unit', children, isRoot: true };
}

// ===== FORMATTING =====
export function formatBudget(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + ' млн ₽';
  } else if (value >= 1000) {
    return (value / 1000).toFixed(0) + ' тыс. ₽';
  }
  return value + ' ₽';
}

export function formatBudgetShort(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  } else if (value >= 1000) {
    return (value / 1000).toFixed(0) + 'K';
  }
  return value.toString();
}

export function escapeHtml(text: string): string {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== COLOR UTILITIES =====
const colorPalette = ['#5B8FF9', '#9B7FE8', '#F6903D', '#63DAAB', '#FF85C0', '#7DD3FC', '#FDE047', '#A78BFA'];

// Explicit colors for units that might have hash collisions
const explicitUnitColors: Record<string, string> = {
  'FAP': '#F6903D',           // Orange
  'TechPlatform': '#5B8FF9',  // Blue
};

const unitColors: Record<string, string> = {};

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getUnitColor(unitName: string): string {
  if (!unitColors[unitName]) {
    // Check for explicit color first
    if (explicitUnitColors[unitName]) {
      unitColors[unitName] = explicitUnitColors[unitName];
    } else {
      const hash = hashString(unitName);
      unitColors[unitName] = colorPalette[hash % colorPalette.length];
    }
  }
  return unitColors[unitName];
}

export function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// ===== STAKEHOLDERS TREE BUILDING =====
// Respects showTeams and showInitiatives toggles just like Budget tree
export function buildStakeholdersTree(rawData: RawDataRow[], options: BuildTreeOptions): TreeNode {
  const showTeams = options.showTeams ?? false;
  const showInitiatives = options.showInitiatives ?? false;

  if (!showTeams && !showInitiatives) {
    return buildStakeholdersUnitsOnlyTree(rawData, options);
  } else if (showTeams && !showInitiatives) {
    return buildStakeholdersUnitsTeamsTree(rawData, options);
  } else if (showTeams && showInitiatives) {
    return buildStakeholdersFullTree(rawData, options);
  } else {
    return buildStakeholdersUnitsInitiativesTree(rawData, options);
  }
}

// Stakeholders -> Units only (aggregated)
function buildStakeholdersUnitsOnlyTree(rawData: RawDataRow[], options: BuildTreeOptions): TreeNode {
  const stakeholderMap: Record<string, { 
    name: string; 
    children: TreeNode[]; 
    unitMap: Record<string, { name: string; value: number; isUnit: boolean }>;
    isStakeholder: boolean;
  }> = {};

  rawData.forEach(row => {
    const budget = calculateBudget(row, options.selectedQuarters);
    if (!shouldIncludeRow(row, options, budget)) return;

    const stakeholderKey = row.stakeholders || 'Без стейкхолдера';

    if (!stakeholderMap[stakeholderKey]) {
      stakeholderMap[stakeholderKey] = { 
        name: stakeholderKey, 
        children: [], 
        unitMap: {},
        isStakeholder: true 
      };
    }

    const stakeholder = stakeholderMap[stakeholderKey];

    if (!stakeholder.unitMap[row.unit]) {
      stakeholder.unitMap[row.unit] = { name: row.unit, value: 0, isUnit: true };
    }

    stakeholder.unitMap[row.unit].value += budget;
  });

  const children = Object.values(stakeholderMap)
    .map(sh => ({
      ...sh,
      children: Object.values(sh.unitMap).filter(u => u.value > 0)
    }))
    .filter(sh => sh.children.length > 0);

  return { name: 'Все стейкхолдеры', children, isRoot: true };
}

// Stakeholders -> Units -> Teams (aggregated)
function buildStakeholdersUnitsTeamsTree(rawData: RawDataRow[], options: BuildTreeOptions): TreeNode {
  const stakeholderMap: Record<string, { 
    name: string; 
    children: TreeNode[]; 
    unitMap: Record<string, { 
      name: string; 
      children: TreeNode[]; 
      teamMap: Record<string, { name: string; value: number; isTeam: boolean }>;
      isUnit: boolean;
    }>;
    isStakeholder: boolean;
  }> = {};

  rawData.forEach(row => {
    const budget = calculateBudget(row, options.selectedQuarters);
    if (!shouldIncludeRow(row, options, budget)) return;

    const stakeholderKey = row.stakeholders || 'Без стейкхолдера';

    if (!stakeholderMap[stakeholderKey]) {
      stakeholderMap[stakeholderKey] = { 
        name: stakeholderKey, 
        children: [], 
        unitMap: {},
        isStakeholder: true 
      };
    }

    const stakeholder = stakeholderMap[stakeholderKey];

    if (!stakeholder.unitMap[row.unit]) {
      stakeholder.unitMap[row.unit] = { 
        name: row.unit, 
        children: [], 
        teamMap: {},
        isUnit: true 
      };
    }

    const unit = stakeholder.unitMap[row.unit];
    const teamName = row.team || 'Без команды';

    if (!unit.teamMap[teamName]) {
      unit.teamMap[teamName] = { name: teamName, value: 0, isTeam: true };
    }

    unit.teamMap[teamName].value += budget;
  });

  const children = Object.values(stakeholderMap)
    .map(sh => ({
      ...sh,
      children: Object.values(sh.unitMap)
        .map(unit => ({
          ...unit,
          children: Object.values(unit.teamMap).filter(t => t.value > 0)
        }))
        .filter(unit => unit.children.length > 0)
    }))
    .filter(sh => sh.children.length > 0);

  return { name: 'Все стейкхолдеры', children, isRoot: true };
}

// Stakeholders -> Units -> Teams -> Initiatives (full)
function buildStakeholdersFullTree(rawData: RawDataRow[], options: BuildTreeOptions): TreeNode {
  const stakeholderMap: Record<string, { 
    name: string; 
    children: TreeNode[]; 
    unitMap: Record<string, { 
      name: string; 
      children: TreeNode[]; 
      teamMap: Record<string, TreeNode>;
      isUnit: boolean;
    }>;
    isStakeholder: boolean;
  }> = {};

  rawData.forEach(row => {
    const budget = calculateBudget(row, options.selectedQuarters);
    if (!shouldIncludeRow(row, options, budget)) return;

    const stakeholderKey = row.stakeholders || 'Без стейкхолдера';
    const isSupport = isInitiativeSupport(row, options.selectedQuarters);
    const isOffTrack = isInitiativeOffTrack(row, options.selectedQuarters);

    if (!stakeholderMap[stakeholderKey]) {
      stakeholderMap[stakeholderKey] = { 
        name: stakeholderKey, 
        children: [], 
        unitMap: {},
        isStakeholder: true 
      };
    }

    const stakeholder = stakeholderMap[stakeholderKey];

    if (!stakeholder.unitMap[row.unit]) {
      stakeholder.unitMap[row.unit] = { 
        name: row.unit, 
        children: [], 
        teamMap: {},
        isUnit: true 
      };
      stakeholder.children.push(stakeholder.unitMap[row.unit]);
    }

    const unit = stakeholder.unitMap[row.unit];
    const teamName = row.team || 'Без команды';

    if (!unit.teamMap[teamName]) {
      unit.teamMap[teamName] = { name: teamName, children: [], isTeam: true };
      unit.children.push(unit.teamMap[teamName]);
    }

    unit.teamMap[teamName].children!.push({
      name: row.initiative,
      value: budget,
      description: row.description,
      stakeholders: row.stakeholders ? row.stakeholders.split(', ') : [],
      support: isSupport,
      offTrack: isOffTrack,
      quarterlyData: row.quarterlyData,
      isInitiative: true
    });
  });

  // Clean up helper maps and filter empty nodes
  const children = Object.values(stakeholderMap)
    .map(sh => {
      const { unitMap, ...rest } = sh;
      return {
        ...rest,
        children: rest.children
          .map(unit => {
            const { teamMap, ...unitRest } = unit as typeof stakeholderMap[string]['unitMap'][string];
            return {
              ...unitRest,
              children: unitRest.children.filter(team => team.children && team.children.length > 0)
            };
          })
          .filter(unit => unit.children.length > 0)
      };
    })
    .filter(sh => sh.children.length > 0);

  return { name: 'Все стейкхолдеры', children, isRoot: true };
}

// Stakeholders -> Units -> Initiatives directly (skip teams)
function buildStakeholdersUnitsInitiativesTree(rawData: RawDataRow[], options: BuildTreeOptions): TreeNode {
  const stakeholderMap: Record<string, { 
    name: string; 
    children: TreeNode[]; 
    unitMap: Record<string, { 
      name: string; 
      children: TreeNode[];
      isUnit: boolean;
    }>;
    isStakeholder: boolean;
  }> = {};

  rawData.forEach(row => {
    const budget = calculateBudget(row, options.selectedQuarters);
    if (!shouldIncludeRow(row, options, budget)) return;

    const stakeholderKey = row.stakeholders || 'Без стейкхолдера';
    const isSupport = isInitiativeSupport(row, options.selectedQuarters);
    const isOffTrack = isInitiativeOffTrack(row, options.selectedQuarters);

    if (!stakeholderMap[stakeholderKey]) {
      stakeholderMap[stakeholderKey] = { 
        name: stakeholderKey, 
        children: [], 
        unitMap: {},
        isStakeholder: true 
      };
    }

    const stakeholder = stakeholderMap[stakeholderKey];

    if (!stakeholder.unitMap[row.unit]) {
      stakeholder.unitMap[row.unit] = { 
        name: row.unit, 
        children: [],
        isUnit: true 
      };
    }

    stakeholder.unitMap[row.unit].children.push({
      name: row.initiative,
      value: budget,
      description: row.description,
      stakeholders: row.stakeholders ? row.stakeholders.split(', ') : [],
      support: isSupport,
      offTrack: isOffTrack,
      quarterlyData: row.quarterlyData,
      isInitiative: true
    });
  });

  const children = Object.values(stakeholderMap)
    .map(sh => ({
      ...sh,
      children: Object.values(sh.unitMap).filter(unit => unit.children.length > 0)
    }))
    .filter(sh => sh.children.length > 0);

  return { name: 'Все стейкхолдеры', children, isRoot: true };
}
