// StakeholdersTreemap - Framer Motion powered treemap visualization

import { TreemapContainer } from './treemap';
import { TreeNode, hashString } from '@/lib/dataManager';

// Separate color palette for stakeholders
const stakeholderColorPalette = ['#9B7FE8', '#5B8FF9', '#63DAAB', '#FF85C0', '#F6903D', '#7DD3FC', '#FDE047', '#A78BFA'];
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
    />
  );
};

export default StakeholdersTreemap;
