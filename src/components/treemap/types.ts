// Treemap component types

import { TreeNode, QuarterData } from '@/lib/dataManager';

// Layout node with computed position from D3
export interface TreemapLayoutNode {
  // Unique identifier for React keys and Framer Motion layoutId
  key: string;
  // Path from root (e.g., "Root/UnitA/Team1/Initiative")
  path: string;
  // Display name
  name: string;
  // Original TreeNode data
  data: TreeNode;
  // Computed position and size from D3
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  height: number;
  // Tree depth (0 = top-level)
  depth: number;
  // Computed budget value
  value: number;
  // Background color
  color: string;
  // Children nodes (if any)
  children?: TreemapLayoutNode[];
  // Parent reference for context
  parentName?: string;
  // Flags
  isUnit?: boolean;
  isTeam?: boolean;
  isInitiative?: boolean;
  isStakeholder?: boolean;
  offTrack?: boolean;
  support?: boolean;
  // Quarterly data for tooltips
  quarterlyData?: Record<string, QuarterData>;
  // Stakeholders list
  stakeholders?: string[];
  // Description
  description?: string;
}

// Animation type determines duration and behavior
export type AnimationType = 'filter' | 'drilldown' | 'navigate-up' | 'resize' | 'initial';

// Animation durations in ms
export const ANIMATION_DURATIONS: Record<AnimationType, number> = {
  'initial': 0,
  'filter': 800,
  'drilldown': 500,
  'navigate-up': 600,
  'resize': 300
};

// Container dimensions
export interface ContainerDimensions {
  width: number;
  height: number;
}

// Exit direction for flying out animation
export interface ExitDirection {
  x: number;
  y: number;
  scale: number;
}

// Color getter function type
export type ColorGetter = (name: string) => string;
