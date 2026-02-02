// StakeholdersTreemap - Framer Motion powered treemap visualization

import { TreemapContainer } from './treemap';
import { TreeNode, hashString } from '@/lib/dataManager';

// Deep, saturated palette for stakeholders with high contrast for white text
const stakeholderColorPalette = [
  '#7B5FA8',  // Глубокий фиолетовый
  '#4A7DD7',  // Насыщенный синий
  '#2D9B6A',  // Тёмный изумруд
  '#C44E89',  // Глубокий розовый
  '#E67A3D',  // Тыквенный оранж
  '#4A90B8',  // Стальной синий
  '#D4852C',  // Янтарь
  '#8B6AAF',  // Аметист
];
const stakeholderColors: Record<string, string> = {};

function getStakeholderColor(name: string): string {
  if (!stakeholderColors[name]) {
    const hash = hashString(name);
    stakeholderColors[name] = stakeholderColorPalette[hash % stakeholderColorPalette.length];
  }
  return stakeholderColors[name];
}

interface StakeholdersTreemapProps {
  data: TreeNode;
  onNodeClick?: (node: TreeNode) => void;
  onNavigateBack?: () => void;
  canNavigateBack?: boolean;
  selectedQuarters?: string[];
  hasData?: boolean;
  onInitiativeClick?: (initiativeName: string) => void;
  onResetFilters?: () => void;
  selectedUnitsCount?: number;
  clickedNodeName?: string | null;
}

const StakeholdersTreemap = ({
  data,
  onNodeClick,
  onNavigateBack,
  canNavigateBack = false,
  selectedQuarters = [],
  hasData = false,
  onInitiativeClick,
  onResetFilters,
  selectedUnitsCount = 0,
  clickedNodeName = null
}: StakeholdersTreemapProps) => {
  return (
    <TreemapContainer
      data={data}
      showTeams={true}  // Stakeholders treemap always shows full hierarchy
      showInitiatives={true}
      onNodeClick={onNodeClick}
      onNavigateBack={onNavigateBack}
      canNavigateBack={canNavigateBack}
      onInitiativeClick={onInitiativeClick}
      selectedQuarters={selectedQuarters}
      hasData={hasData}
      onResetFilters={onResetFilters}
      selectedUnitsCount={selectedUnitsCount}
      clickedNodeName={clickedNodeName}
      getColor={getStakeholderColor}
      emptyStateTitle="Нет инициатив по выбранным фильтрам"
      emptyStateSubtitle="Попробуйте изменить параметры фильтрации или сбросить фильтры"
      showUploadButton={false}
      extraDepth={1}
    />
  );
};

export default StakeholdersTreemap;
