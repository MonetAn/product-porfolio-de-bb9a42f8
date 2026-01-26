// ===== ADMIN DATA TYPES =====
export interface AdminQuarterData {
  cost: number;           // Read-only (из CSV)
  otherCosts: number;     // Editable
  support: boolean;       // Read-only
  onTrack: boolean;       // Editable
  metricPlan: string;     // Editable
  metricFact: string;     // Editable
  comment: string;        // Editable
}

export interface AdminDataRow {
  id: string;
  unit: string;
  team: string;
  initiative: string;
  description: string;
  documentationLink: string;
  stakeholders: string;
  quarterlyData: Record<string, AdminQuarterData>;
  isNew?: boolean;
  isModified?: boolean;
}

// ===== CSV PARSING UTILITIES =====
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.toString().replace(/[\s\u00A0]/g, '').replace(/,/g, '.');
  return parseFloat(cleaned) || 0;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.toString().toUpperCase().trim();
  return v === 'TRUE' || v === '1' || v === 'ДА';
}

function detectPeriodsFromHeaders(headers: string[]): string[] {
  const quarterSet = new Set<string>();
  const regex = /(\d{2})_Q(\d)/;

  headers.forEach(h => {
    const match = h.match(regex);
    if (match) {
      const year = '20' + match[1];
      const quarter = year + '-Q' + match[2];
      quarterSet.add(quarter);
    }
  });

  return Array.from(quarterSet).sort();
}

// ===== ADMIN CSV PARSING =====
export function parseAdminCSV(text: string): {
  data: AdminDataRow[];
  quarters: string[];
  originalHeaders: string[];
} {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    return { data: [], quarters: [], originalHeaders: [] };
  }

  const headers = parseCSVLine(lines[0]);
  const quarters = detectPeriodsFromHeaders(headers);
  const data: AdminDataRow[] = [];

  // Find column indices
  const unitIdx = headers.findIndex(h => h.toLowerCase().includes('unit') || h.toLowerCase() === 'юнит');
  const teamIdx = headers.findIndex(h => h.toLowerCase().includes('team') || h.toLowerCase() === 'команда');
  const initiativeIdx = headers.findIndex(h => h.toLowerCase().includes('initiative') || h.toLowerCase() === 'инициатива');
  const descriptionIdx = headers.findIndex(h => h.toLowerCase().includes('description') || h.toLowerCase() === 'описание');
  const docLinkIdx = headers.findIndex(h => h.toLowerCase().includes('documentation') || h.toLowerCase().includes('doc link'));
  const stakeholdersIdx = headers.findIndex(h => h.toLowerCase().includes('stakeholder') || h.toLowerCase() === 'стейкхолдеры');

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 4) continue;

    const row: AdminDataRow = {
      id: `row-${i}-${Date.now()}`,
      unit: values[unitIdx >= 0 ? unitIdx : 0]?.trim() || '',
      team: values[teamIdx >= 0 ? teamIdx : 1]?.trim() || '',
      initiative: values[initiativeIdx >= 0 ? initiativeIdx : 2]?.trim() || '',
      description: values[descriptionIdx >= 0 ? descriptionIdx : 3]?.trim() || '',
      documentationLink: docLinkIdx >= 0 ? values[docLinkIdx]?.trim() || '' : '',
      stakeholders: values[stakeholdersIdx >= 0 ? stakeholdersIdx : 4]?.trim() || '',
      quarterlyData: {}
    };

    if (!row.unit || !row.initiative) continue;

    // Parse quarterly data
    quarters.forEach(q => {
      const prefix = q.replace('20', '').replace('-', '_') + '_';
      const costIdx = headers.findIndex(h => h.includes(prefix + 'Стоимость'));
      const otherCostsIdx = headers.findIndex(h => h.includes(prefix + 'Other Costs'));
      const supportIdx = headers.findIndex(h => h.includes(prefix + 'Поддержка'));
      const onTrackIdx = headers.findIndex(h => h.includes(prefix + 'On-Track'));
      const metricPlanIdx = headers.findIndex(h => h.includes(prefix + 'Metric Plan'));
      const metricFactIdx = headers.findIndex(h => h.includes(prefix + 'Metric Fact'));
      const commentIdx = headers.findIndex(h => h.includes(prefix + 'Comment'));

      row.quarterlyData[q] = {
        cost: parseNumber(values[costIdx]),
        otherCosts: parseNumber(values[otherCostsIdx]),
        support: parseBoolean(values[supportIdx]),
        onTrack: parseBoolean(values[onTrackIdx]),
        metricPlan: values[metricPlanIdx]?.trim() || '',
        metricFact: values[metricFactIdx]?.trim() || '',
        comment: values[commentIdx]?.trim() || ''
      };
    });

    data.push(row);
  }

  return { data, quarters, originalHeaders: headers };
}

// ===== CSV EXPORT =====
function escapeCSVValue(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function exportAdminCSV(
  data: AdminDataRow[],
  quarters: string[],
  originalHeaders: string[]
): string {
  // Build headers
  const baseHeaders = ['Unit', 'Team', 'Initiative', 'Description', 'Documentation Link', 'Stakeholders'];
  const quarterHeaders: string[] = [];
  
  quarters.forEach(q => {
    const prefix = q.replace('20', '').replace('-', '_') + '_';
    quarterHeaders.push(
      `${prefix}Стоимость`,
      `${prefix}Other Costs`,
      `${prefix}Поддержка`,
      `${prefix}On-Track`,
      `${prefix}Metric Plan`,
      `${prefix}Metric Fact`,
      `${prefix}Comment`
    );
  });

  const headers = [...baseHeaders, ...quarterHeaders];
  
  // Build rows
  const rows = data.map(row => {
    const baseValues = [
      escapeCSVValue(row.unit),
      escapeCSVValue(row.team),
      escapeCSVValue(row.initiative),
      escapeCSVValue(row.description),
      escapeCSVValue(row.documentationLink),
      escapeCSVValue(row.stakeholders)
    ];

    const quarterValues: string[] = [];
    quarters.forEach(q => {
      const qData = row.quarterlyData[q] || {
        cost: 0,
        otherCosts: 0,
        support: false,
        onTrack: false,
        metricPlan: '',
        metricFact: '',
        comment: ''
      };
      quarterValues.push(
        qData.cost.toString(),
        qData.otherCosts.toString(),
        qData.support ? 'TRUE' : 'FALSE',
        qData.onTrack ? 'TRUE' : 'FALSE',
        escapeCSVValue(qData.metricPlan),
        escapeCSVValue(qData.metricFact),
        escapeCSVValue(qData.comment)
      );
    });

    return [...baseValues, ...quarterValues].join(',');
  });

  // Add BOM for Excel compatibility
  const BOM = '\uFEFF';
  return BOM + headers.join(',') + '\n' + rows.join('\n');
}

// ===== UTILITY FUNCTIONS =====
export function getUniqueUnits(data: AdminDataRow[]): string[] {
  return [...new Set(data.map(r => r.unit))].sort();
}

export function getTeamsForUnits(data: AdminDataRow[], units: string[]): string[] {
  if (units.length === 0) return [...new Set(data.map(r => r.team).filter(Boolean))].sort();
  return [...new Set(
    data
      .filter(r => units.includes(r.unit))
      .map(r => r.team)
      .filter(Boolean)
  )].sort();
}

export function filterData(
  data: AdminDataRow[],
  selectedUnits: string[],
  selectedTeams: string[]
): AdminDataRow[] {
  return data.filter(row => {
    if (selectedUnits.length > 0 && !selectedUnits.includes(row.unit)) return false;
    if (selectedTeams.length > 0 && !selectedTeams.includes(row.team)) return false;
    return true;
  });
}

export function createEmptyQuarterData(): AdminQuarterData {
  return {
    cost: 0,
    otherCosts: 0,
    support: false,
    onTrack: true,
    metricPlan: '',
    metricFact: '',
    comment: ''
  };
}

export function createNewInitiative(
  unit: string,
  team: string,
  quarters: string[]
): AdminDataRow {
  const quarterlyData: Record<string, AdminQuarterData> = {};
  quarters.forEach(q => {
    quarterlyData[q] = createEmptyQuarterData();
  });

  return {
    id: `new-${Date.now()}`,
    unit,
    team,
    initiative: '',
    description: '',
    documentationLink: '',
    stakeholders: '',
    quarterlyData,
    isNew: true
  };
}
