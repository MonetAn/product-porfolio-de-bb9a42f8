// Hook for computing treemap layout using D3 (pure calculation, no DOM)

import { useMemo } from 'react';
import * as d3 from 'd3';
import { TreeNode, getUnitColor, adjustBrightness } from '@/lib/dataManager';
import { TreemapLayoutNode, ColorGetter, ContainerDimensions } from './types';

interface UseTreemapLayoutOptions {
  data: TreeNode;
  dimensions: ContainerDimensions;
  showTeams?: boolean;
  showInitiatives?: boolean;
  getColor?: ColorGetter;
}

// Flatten D3 hierarchy into array of layout nodes
function flattenHierarchy(
  node: d3.HierarchyRectangularNode<TreeNode>,
  depth: number,
  getColor: ColorGetter,
  parentPath: string = '',
  maxDepth: number = 3
): TreemapLayoutNode[] {
  const result: TreemapLayoutNode[] = [];
  
  const path = parentPath ? `${parentPath}/${node.data.name}` : node.data.name;
  const key = `d${depth}-${path}`;
  
  // Get color based on top-level ancestor
  let colorName = node.data.name;
  let current: d3.HierarchyRectangularNode<TreeNode> | null = node;
  while (current.parent && current.parent.parent) {
    current = current.parent;
    colorName = current.data.name;
  }
  
  const baseColor = getColor(colorName);
  let color = baseColor;
  if (depth === 1) {
    color = adjustBrightness(baseColor, -15);
  } else if (depth === 2) {
    color = adjustBrightness(baseColor, -30);
  }
  
  const layoutNode: TreemapLayoutNode = {
    key,
    path,
    name: node.data.name,
    data: node.data,
    x0: node.x0,
    y0: node.y0,
    x1: node.x1,
    y1: node.y1,
    width: node.x1 - node.x0,
    height: node.y1 - node.y0,
    depth,
    value: node.value || 0,
    color,
    parentName: node.parent?.data.name,
    isUnit: node.data.isUnit,
    isTeam: node.data.isTeam,
    isInitiative: node.data.isInitiative,
    isStakeholder: node.data.isStakeholder,
    offTrack: node.data.offTrack,
    support: node.data.support,
    quarterlyData: node.data.quarterlyData,
    stakeholders: node.data.stakeholders,
    description: node.data.description,
  };
  
  // Process children if we haven't reached max depth
  if (node.children && depth < maxDepth) {
    layoutNode.children = [];
    for (const child of node.children) {
      const childNodes = flattenHierarchy(child, depth + 1, getColor, path, maxDepth);
      layoutNode.children.push(childNodes[0]); // First node is the direct child
    }
  }
  
  result.push(layoutNode);
  return result;
}

export function useTreemapLayout({
  data,
  dimensions,
  showTeams = false,
  showInitiatives = false,
  getColor = getUnitColor
}: UseTreemapLayoutOptions): TreemapLayoutNode[] {
  return useMemo(() => {
    if (!data.children || data.children.length === 0 || dimensions.width === 0 || dimensions.height === 0) {
      return [];
    }
    
    // Determine render depth based on toggles
    let renderDepth = 1; // Units only by default
    if (showTeams && showInitiatives) {
      renderDepth = 3; // Units -> Teams -> Initiatives
    } else if (showTeams) {
      renderDepth = 2; // Units -> Teams
    } else if (showInitiatives) {
      renderDepth = 2; // Units -> Initiatives
    }
    
    // Create D3 hierarchy
    const root = d3.hierarchy(data)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));
    
    // Create treemap layout with dynamic padding based on depth
    const treemap = d3.treemap<TreeNode>()
      .size([dimensions.width, dimensions.height])
      .paddingOuter(2)
      .paddingTop(d => {
        if (renderDepth <= 1) return 2;
        // Unit (depth 1): 20px, Team (depth 2): 18px - enough for headers
        if (d.depth === 1) return 20;
        if (d.depth === 2) return 18;
        return 2;
      })
      .paddingInner(2)
      .round(true);
    
    treemap(root);
    
    if (!root.children) return [];
    
    // Flatten to array of layout nodes
    const layoutNodes: TreemapLayoutNode[] = [];
    for (const child of root.children) {
      const nodes = flattenHierarchy(child, 0, getColor, '', renderDepth);
      layoutNodes.push(nodes[0]);
    }
    
    return layoutNodes;
  }, [data, dimensions.width, dimensions.height, showTeams, showInitiatives, getColor]);
}

// Calculate exit direction for a node (used in drilldown animation)
export function calculateExitDirection(
  node: TreemapLayoutNode,
  zoomTargetCenter: { x: number; y: number },
  containerDimensions: ContainerDimensions
): { x: number; y: number } {
  const nodeCenter = {
    x: node.x0 + node.width / 2,
    y: node.y0 + node.height / 2
  };
  
  const dx = nodeCenter.x - zoomTargetCenter.x;
  const dy = nodeCenter.y - zoomTargetCenter.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const pushFactor = Math.max(containerDimensions.width, containerDimensions.height) * 1.5;
  
  return {
    x: node.x0 + (dx / distance) * pushFactor,
    y: node.y0 + (dy / distance) * pushFactor
  };
}

// Calculate enter direction for a node (used in navigate-up animation)
export function calculateEnterDirection(
  node: TreemapLayoutNode,
  containerCenter: { x: number; y: number },
  containerDimensions: ContainerDimensions
): { x: number; y: number } {
  const nodeCenter = {
    x: node.x0 + node.width / 2,
    y: node.y0 + node.height / 2
  };
  
  const dx = nodeCenter.x - containerCenter.x;
  const dy = nodeCenter.y - containerCenter.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const pushFactor = Math.max(containerDimensions.width, containerDimensions.height) * 1.5;
  
  return {
    x: containerCenter.x + (dx / distance) * pushFactor,
    y: containerCenter.y + (dy / distance) * pushFactor
  };
}
