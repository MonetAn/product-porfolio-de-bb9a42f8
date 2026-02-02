// D3-based treemap rendering layer with native D3 transitions
// Replaces Framer Motion for full control over enter/update/exit animations

import { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { TreemapLayoutNode, AnimationType, ANIMATION_DURATIONS, ZoomTargetInfo } from './types';
import { formatBudget } from '@/lib/dataManager';

interface TreemapD3LayerProps {
  layoutNodes: TreemapLayoutNode[];
  width: number;
  height: number;
  animationType: AnimationType;
  zoomTarget: ZoomTargetInfo | null;
  exitingNodes?: TreemapLayoutNode[]; // NEW: Pre-captured exiting nodes for drilldown
  renderDepth: number;
  onNodeClick: (node: TreemapLayoutNode) => void;
  onNodeMouseEnter: (e: MouseEvent, node: TreemapLayoutNode) => void;
  onNodeMouseMove: (e: MouseEvent) => void;
  onNodeMouseLeave: () => void;
  onAnimationComplete?: () => void;
}

// Calculate edge-based push for drilldown exit animation
function calculatePushPosition(
  node: TreemapLayoutNode,
  zoomTarget: ZoomTargetInfo,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number } {
  const nodeCenterX = node.x0 + node.width / 2;
  const nodeCenterY = node.y0 + node.height / 2;
  const targetCenterX = zoomTarget.x0 + zoomTarget.width / 2;
  const targetCenterY = zoomTarget.y0 + zoomTarget.height / 2;
  
  // Calculate expansion distances
  const expandLeft = zoomTarget.x0;
  const expandRight = containerWidth - zoomTarget.x1;
  const expandTop = zoomTarget.y0;
  const expandBottom = containerHeight - zoomTarget.y1;
  
  let pushX = 0;
  let pushY = 0;
  
  // Determine overlap
  const horizontalOverlap = !(node.x1 <= zoomTarget.x0 || node.x0 >= zoomTarget.x1);
  const verticalOverlap = !(node.y1 <= zoomTarget.y0 || node.y0 >= zoomTarget.y1);
  
  const pushMargin = 50;
  
  if (horizontalOverlap && !verticalOverlap) {
    // Push vertically only
    if (nodeCenterY < targetCenterY) {
      pushY = -(expandTop + node.height + pushMargin);
    } else {
      pushY = expandBottom + node.height + pushMargin;
    }
  } else if (verticalOverlap && !horizontalOverlap) {
    // Push horizontally only
    if (nodeCenterX < targetCenterX) {
      pushX = -(expandLeft + node.width + pushMargin);
    } else {
      pushX = expandRight + node.width + pushMargin;
    }
  } else {
    // Push diagonally
    if (nodeCenterX < targetCenterX) {
      pushX = -(expandLeft + node.width + pushMargin);
    } else {
      pushX = expandRight + node.width + pushMargin;
    }
    if (nodeCenterY < targetCenterY) {
      pushY = -(expandTop + node.height + pushMargin);
    } else {
      pushY = expandBottom + node.height + pushMargin;
    }
  }
  
  return {
    x: node.x0 + pushX,
    y: node.y0 + pushY,
  };
}

// Calculate edge-based enter position for navigate-up
function calculateEnterPosition(
  node: TreemapLayoutNode,
  containerWidth: number,
  containerHeight: number
): { x: number; y: number } {
  const nodeCenterX = node.x0 + node.width / 2;
  const nodeCenterY = node.y0 + node.height / 2;
  const containerCenterX = containerWidth / 2;
  const containerCenterY = containerHeight / 2;
  
  let startX = node.x0;
  let startY = node.y0;
  const margin = 100;
  
  if (nodeCenterX < containerCenterX) {
    startX = -(node.width + margin);
  } else {
    startX = containerWidth + margin;
  }
  
  if (nodeCenterY < containerCenterY) {
    startY = -(node.height + margin);
  } else {
    startY = containerHeight + margin;
  }
  
  // Minimize offset for nodes near center
  if (Math.abs(nodeCenterX - containerCenterX) < containerWidth * 0.2) {
    startX = node.x0;
  }
  if (Math.abs(nodeCenterY - containerCenterY) < containerHeight * 0.2) {
    startY = node.y0;
  }
  
  return { x: startX, y: startY };
}

// Generate HTML content for node (header for parents, centered for leaves)
function generateNodeContent(d: TreemapLayoutNode): string {
  const hasChildren = d.children && d.children.length > 0;
  const isTiny = d.width < 60 || d.height < 40;
  const isSmall = d.width < 100 || d.height < 60;
  
  if (d.height < 30) return '';
  
  const labelSize = isTiny ? '9px' : isSmall ? '11px' : '14px';
  const valueSize = isSmall ? '10px' : '12px';
  
  if (hasChildren) {
    // Header style for parent nodes (positioned at top)
    return `<div style="
      position: absolute;
      top: 4px;
      left: 4px;
      right: 4px;
      font-weight: 600;
      color: white;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      font-size: ${labelSize};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    ">${d.name}</div>`;
  }
  
  // Centered content for leaf nodes
  let html = `<div style="
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    padding: 0 4px;
    box-sizing: border-box;
    text-align: center;
  ">
    <div style="
      font-weight: 600;
      color: white;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: ${labelSize};
    ">${d.name}</div>`;
  
  if (d.height > 40 && !isTiny) {
    html += `<div style="
      color: rgba(255,255,255,0.9);
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      margin-top: 2px;
      font-size: ${valueSize};
    ">${formatBudget(d.value)}</div>`;
  }
  
  html += '</div>';
  return html;
}

// Flatten hierarchical nodes for D3 data join
function flattenNodes(nodes: TreemapLayoutNode[], renderDepth: number): TreemapLayoutNode[] {
  const result: TreemapLayoutNode[] = [];
  
  function traverse(node: TreemapLayoutNode, currentDepth: number) {
    result.push(node);
    if (node.children && currentDepth < renderDepth - 1) {
      node.children.forEach(child => traverse(child, currentDepth + 1));
    }
  }
  
  nodes.forEach(node => traverse(node, 0));
  return result;
}

const TreemapD3Layer = ({
  layoutNodes,
  width,
  height,
  animationType,
  zoomTarget,
  exitingNodes = [],
  renderDepth,
  onNodeClick,
  onNodeMouseEnter,
  onNodeMouseMove,
  onNodeMouseLeave,
  onAnimationComplete,
}: TreemapD3LayerProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const prevNodesRef = useRef<TreemapLayoutNode[]>([]);
  
  // Store callbacks in refs to avoid stale closures
  const callbacksRef = useRef({
    onNodeClick,
    onNodeMouseEnter,
    onNodeMouseMove,
    onNodeMouseLeave,
    onAnimationComplete,
  });
  
  useEffect(() => {
    callbacksRef.current = {
      onNodeClick,
      onNodeMouseEnter,
      onNodeMouseMove,
      onNodeMouseLeave,
      onAnimationComplete,
    };
  });
  
  // Main D3 rendering effect
  useEffect(() => {
    if (!svgRef.current || width === 0 || height === 0) return;
    
    const svg = d3.select(svgRef.current);
    const duration = ANIMATION_DURATIONS[animationType];
    
    // Flatten nodes for flat rendering approach
    const flatNodes = flattenNodes(layoutNodes, renderDepth);
    const prevFlatNodes = prevNodesRef.current;
    
    // Create lookup maps
    const prevNodesMap = new Map(prevFlatNodes.map(n => [n.key, n]));
    const currentNodesMap = new Map(flatNodes.map(n => [n.key, n]));
    
    // Data join with key function
    const groups = svg.selectAll<SVGGElement, TreemapLayoutNode>('g.treemap-node')
      .data(flatNodes, d => d.key);
    
    // ----- DRILLDOWN: Use pre-captured exiting nodes -----
    if (animationType === 'drilldown' && zoomTarget && exitingNodes.length > 0) {
      console.log('[D3] Drilldown with exitingNodes:', exitingNodes.length, 'zoomTarget:', zoomTarget.name);
      
      // Remove any existing exiting nodes first
      svg.selectAll('g.exiting-node').remove();
      
      // Create temporary groups for exiting nodes
      const exitGroups = svg.selectAll<SVGGElement, TreemapLayoutNode>('g.exiting-node')
        .data(exitingNodes, d => d.key)
        .enter()
        .append('g')
        .attr('class', 'exiting-node')
        .attr('transform', d => `translate(${d.x0}, ${d.y0})`);
      
      // Add rect to exiting nodes
      exitGroups.append('rect')
        .attr('width', d => d.width)
        .attr('height', d => d.height)
        .attr('fill', d => d.color)
        .attr('rx', 4)
        .attr('ry', 4)
        .style('stroke', 'rgba(255,255,255,0.3)')
        .style('stroke-width', 1);
      
      // Add foreignObject for content
      exitGroups.append('foreignObject')
        .attr('width', d => d.width)
        .attr('height', d => d.height)
        .append('xhtml:div')
        .style('width', '100%')
        .style('height', '100%')
        .style('position', 'relative')
        .style('padding', '8px')
        .style('box-sizing', 'border-box')
        .style('overflow', 'hidden')
        .style('pointer-events', 'none')
        .html(d => generateNodeContent(d));
      
      // Animate exiting nodes
      exitGroups.each(function(d) {
        const group = d3.select(this);
        const isZoomTarget = d.key === zoomTarget.key;
        
        if (isZoomTarget) {
          // Zoom target expands to fullscreen then fades
          group.transition()
            .duration(duration)
            .ease(d3.easeCubicInOut)
            .attr('transform', `translate(0, 0)`);
          
          group.select('rect')
            .transition()
            .duration(duration)
            .ease(d3.easeCubicInOut)
            .attr('width', width)
            .attr('height', height);
          
          group.select('foreignObject')
            .transition()
            .duration(duration)
            .ease(d3.easeCubicInOut)
            .attr('width', width)
            .attr('height', height);
          
          group.transition()
            .delay(duration * 0.8)
            .duration(duration * 0.2)
            .style('opacity', 0)
            .remove();
        } else {
          // Neighbors: push off-screen
          const pushPos = calculatePushPosition(d, zoomTarget, width, height);
          
          group.transition()
            .duration(duration)
            .ease(d3.easeCubicInOut)
            .attr('transform', `translate(${pushPos.x}, ${pushPos.y})`)
            .remove();
        }
      });
    }
    
    // ----- EXIT: Removed nodes (for non-drilldown cases) -----
    const exitSelection = groups.exit();
    
    if (animationType === 'navigate-up') {
      // Navigate-up: current view shrinks to center
      exitSelection.each(function(d) {
        const group = d3.select(this);
        
        group.transition()
          .duration(duration)
          .ease(d3.easeCubicInOut)
          .attr('transform', `translate(${width / 2}, ${height / 2})`)
          .select('rect')
          .attr('width', 0)
          .attr('height', 0);
        
        group.transition()
          .delay(duration * 0.5)
          .duration(duration * 0.5)
          .style('opacity', 0)
          .remove();
      });
    } else if (animationType !== 'drilldown') {
      // Filter: simple fade out (skip for drilldown as we handle it separately)
      exitSelection.transition()
        .duration(duration)
        .style('opacity', 0)
        .remove();
    } else {
      // Drilldown: just remove without animation (exitingNodes handles it)
      exitSelection.remove();
    }
    
    // ----- ENTER: New nodes -----
    const enterSelection = groups.enter()
      .append('g')
      .attr('class', 'treemap-node')
      .style('cursor', 'pointer');
    
    // Set initial positions based on animation type
    enterSelection.each(function(d) {
      const group = d3.select(this);
      
      if (animationType === 'navigate-up') {
        // Fly in from edges
        const enterPos = calculateEnterPosition(d, width, height);
        group.attr('transform', `translate(${enterPos.x}, ${enterPos.y})`);
      } else if (animationType === 'drilldown') {
        // New nodes appear at final position (no fade for drilldown)
        group.attr('transform', `translate(${d.x0}, ${d.y0})`);
      } else if (animationType === 'initial') {
        // No animation
        group.attr('transform', `translate(${d.x0}, ${d.y0})`);
      } else {
        // Filter: fade in from final position
        group
          .attr('transform', `translate(${d.x0}, ${d.y0})`)
          .style('opacity', 0);
      }
    });
    
    // Add rect background
    enterSelection.append('rect')
      .attr('width', d => d.width)
      .attr('height', d => d.height)
      .attr('fill', d => d.color)
      .attr('rx', 4)
      .attr('ry', 4)
      .style('stroke', 'rgba(255,255,255,0.3)')
      .style('stroke-width', 1);
    
    // Add foreignObject for HTML content
    enterSelection.append('foreignObject')
      .attr('width', d => d.width)
      .attr('height', d => d.height)
      .append('xhtml:div')
      .style('width', '100%')
      .style('height', '100%')
      .style('position', 'relative')
      .style('padding', '8px')
      .style('box-sizing', 'border-box')
      .style('overflow', 'hidden')
      .style('pointer-events', 'none')
      .html(d => generateNodeContent(d));
    
    // Add event handlers
    enterSelection
      .on('click', function(event, d) {
        event.stopPropagation();
        callbacksRef.current.onNodeClick(d);
      })
      .on('mouseenter', function(event, d) {
        event.stopPropagation();
        callbacksRef.current.onNodeMouseEnter(event, d);
      })
      .on('mousemove', function(event) {
        callbacksRef.current.onNodeMouseMove(event);
      })
      .on('mouseleave', function() {
        callbacksRef.current.onNodeMouseLeave();
      });
    
    // Animate enter to final positions
    if (animationType !== 'initial') {
      enterSelection.transition()
        .duration(duration)
        .ease(d3.easeCubicInOut)
        .attr('transform', d => `translate(${d.x0}, ${d.y0})`)
        .style('opacity', 1);
    }
    
    // ----- UPDATE: Existing nodes -----
    const updateSelection = groups;
    
    if (animationType === 'initial') {
      // No animation for initial render
      updateSelection
        .attr('transform', d => `translate(${d.x0}, ${d.y0})`);
      
      updateSelection.select('rect')
        .attr('width', d => d.width)
        .attr('height', d => d.height)
        .attr('fill', d => d.color);
      
      updateSelection.select('foreignObject')
        .attr('width', d => d.width)
        .attr('height', d => d.height);
    } else {
      // Animate to new positions
      updateSelection.transition()
        .duration(duration)
        .ease(d3.easeCubicInOut)
        .attr('transform', d => `translate(${d.x0}, ${d.y0})`);
      
      updateSelection.select('rect')
        .transition()
        .duration(duration)
        .ease(d3.easeCubicInOut)
        .attr('width', d => d.width)
        .attr('height', d => d.height)
        .attr('fill', d => d.color);
      
      updateSelection.select('foreignObject')
        .transition()
        .duration(duration)
        .ease(d3.easeCubicInOut)
        .attr('width', d => d.width)
        .attr('height', d => d.height);
      
      // Update content
      updateSelection.select('foreignObject > div')
        .html(d => generateNodeContent(d));
    }
    
    // Store current nodes for next transition
    prevNodesRef.current = flatNodes;
    
    // Notify when animation completes
    if (duration > 0 && callbacksRef.current.onAnimationComplete) {
      setTimeout(() => {
        callbacksRef.current.onAnimationComplete?.();
      }, duration);
    }
    
  }, [layoutNodes, width, height, animationType, zoomTarget, exitingNodes, renderDepth]);
  
  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        overflow: 'visible',
      }}
    />
  );
};

export default TreemapD3Layer;
