// Framer Motion treemap node component with Camera Zoom edge-based push

import { motion, AnimatePresence } from 'framer-motion';
import { memo, useMemo, forwardRef } from 'react';
import { TreemapLayoutNode, AnimationType, ANIMATION_DURATIONS, ZoomTargetInfo } from './types';
import { formatBudget } from '@/lib/dataManager';

interface TreemapNodeProps {
  node: TreemapLayoutNode;
  animationType: AnimationType;
  zoomTarget?: ZoomTargetInfo | null;
  containerWidth: number;
  containerHeight: number;
  onClick?: (node: TreemapLayoutNode) => void;
  onMouseEnter?: (e: React.MouseEvent, node: TreemapLayoutNode) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  // For enter animations - whether this node is entering from outside
  isEntering?: boolean;
  containerCenter?: { x: number; y: number };
  // Show children with delay after parent animation
  showChildren?: boolean;
  // Render depth control
  renderDepth?: number;
}

// Unified transition for synchronized animations (Camera Zoom effect)
const ZOOM_TRANSITION = {
  type: 'tween' as const,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number], // ease-in-out cubic-bezier
  duration: 0.6,
};

// Edge-based push calculation - nodes are "pushed" by expanding zoom target
function getEdgeBasedExitAnimation(
  node: TreemapLayoutNode,
  zoomTarget: ZoomTargetInfo,
  containerWidth: number,
  containerHeight: number
) {
  // How much the zoom target expands in each direction
  const expandLeft = zoomTarget.x0;
  const expandRight = containerWidth - zoomTarget.x1;
  const expandTop = zoomTarget.y0;
  const expandBottom = containerHeight - zoomTarget.y1;
  
  // Determine dominant direction based on node center vs target center
  const nodeCenterX = node.x0 + node.width / 2;
  const nodeCenterY = node.y0 + node.height / 2;
  const targetCenterX = zoomTarget.x0 + zoomTarget.width / 2;
  const targetCenterY = zoomTarget.y0 + zoomTarget.height / 2;
  
  let pushX = 0;
  let pushY = 0;
  
  // Check for overlap to determine push direction
  const horizontalOverlap = !(node.x1 <= zoomTarget.x0 || node.x0 >= zoomTarget.x1);
  const verticalOverlap = !(node.y1 <= zoomTarget.y0 || node.y0 >= zoomTarget.y1);
  
  if (horizontalOverlap && !verticalOverlap) {
    // Block is above or below target - only vertical push
    if (nodeCenterY < targetCenterY) {
      pushY = -(expandTop + node.height + 50);
    } else {
      pushY = expandBottom + node.height + 50;
    }
  } else if (verticalOverlap && !horizontalOverlap) {
    // Block is left or right of target - only horizontal push
    if (nodeCenterX < targetCenterX) {
      pushX = -(expandLeft + node.width + 50);
    } else {
      pushX = expandRight + node.width + 50;
    }
  } else {
    // Diagonal blocks - push in both directions
    if (nodeCenterX < targetCenterX) {
      pushX = -(expandLeft + node.width + 50);
    } else {
      pushX = expandRight + node.width + 50;
    }
    
    if (nodeCenterY < targetCenterY) {
      pushY = -(expandTop + node.height + 50);
    } else {
      pushY = expandBottom + node.height + 50;
    }
  }
  
  return {
    x: node.x0 + pushX,
    y: node.y0 + pushY,
    width: node.width,   // Keep size! No shrinking
    height: node.height, // Keep size! No shrinking
    opacity: 1,          // Stay visible until off-screen
  };
}

// Edge-based enter animation for navigate-up (nodes fly in from edges)
function getEdgeBasedEnterAnimation(
  node: TreemapLayoutNode,
  containerWidth: number,
  containerHeight: number
) {
  const nodeCenterX = node.x0 + node.width / 2;
  const nodeCenterY = node.y0 + node.height / 2;
  const containerCenterX = containerWidth / 2;
  const containerCenterY = containerHeight / 2;
  
  let startX = node.x0;
  let startY = node.y0;
  
  // Check which edge the node should fly in from
  const distFromLeft = node.x0;
  const distFromRight = containerWidth - node.x1;
  const distFromTop = node.y0;
  const distFromBottom = containerHeight - node.y1;
  
  // Horizontal position determines horizontal entry
  if (nodeCenterX < containerCenterX) {
    startX = -(node.width + 100);
  } else {
    startX = containerWidth + 100;
  }
  
  // Vertical position determines vertical entry
  if (nodeCenterY < containerCenterY) {
    startY = -(node.height + 100);
  } else {
    startY = containerHeight + 100;
  }
  
  // For nodes close to horizontal center, minimize horizontal offset
  if (Math.abs(nodeCenterX - containerCenterX) < containerWidth * 0.2) {
    startX = node.x0;
  }
  
  // For nodes close to vertical center, minimize vertical offset
  if (Math.abs(nodeCenterY - containerCenterY) < containerHeight * 0.2) {
    startY = node.y0;
  }
  
  return {
    x: startX,
    y: startY,
    width: node.width,
    height: node.height,
    opacity: 1,
  };
}

// Node content component
const TreemapNodeContent = memo(({ node, showValue }: { node: TreemapLayoutNode; showValue: boolean }) => {
  const isTiny = node.width < 60 || node.height < 40;
  const isSmall = node.width < 100 || node.height < 60;
  
  if (node.height < 30) return null;
  
  return (
    <div className="treemap-node-content">
      <div 
        className={`treemap-node-label ${isTiny ? 'text-[9px]' : isSmall ? 'text-[11px]' : 'text-[14px]'}`}
        style={{ 
          fontWeight: 600,
          color: 'white',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {node.name}
      </div>
      {showValue && node.height > 40 && !isTiny && (
        <div 
          className={`treemap-node-value ${isSmall ? 'text-[10px]' : 'text-[12px]'}`}
          style={{
            color: 'rgba(255,255,255,0.9)',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            marginTop: 2,
          }}
        >
          {formatBudget(node.value)}
        </div>
      )}
    </div>
  );
});

TreemapNodeContent.displayName = 'TreemapNodeContent';

// Main node component
const TreemapNode = forwardRef<HTMLDivElement, TreemapNodeProps>(({
  node,
  animationType,
  zoomTarget,
  containerWidth,
  containerHeight,
  onClick,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  isEntering = false,
  containerCenter,
  showChildren = true,
  renderDepth = 3,
}, ref) => {
  const duration = ZOOM_TRANSITION.duration;
  const isZoomTarget = zoomTarget?.key === node.key;
  const hasChildren = node.children && node.children.length > 0;
  const shouldRenderChildren = hasChildren && node.depth < renderDepth - 1;
  const isLeaf = !hasChildren;
  
  // Determine size class
  const isTiny = node.width < 60 || node.height < 40;
  const isSmall = node.width < 100 || node.height < 60;
  
  // Initial animation state
  const initialAnimation = useMemo(() => {
    if (animationType === 'initial' || animationType === 'resize') {
      return { 
        x: node.x0, 
        y: node.y0, 
        width: node.width, 
        height: node.height,
        opacity: 1 
      };
    }
    
    // For navigate-up: nodes fly in from edges
    if (isEntering && animationType === 'navigate-up') {
      return getEdgeBasedEnterAnimation(node, containerWidth, containerHeight);
    }
    
    // Default: fade in
    return {
      x: node.x0,
      y: node.y0,
      width: node.width,
      height: node.height,
      opacity: 0,
    };
  }, [animationType, isEntering, node, containerWidth, containerHeight]);
  
  // Target animation state
  const animateState = useMemo(() => {
    // Zoom target expands to fullscreen
    if (isZoomTarget && animationType === 'drilldown') {
      return {
        x: 0,
        y: 0,
        width: containerWidth,
        height: containerHeight,
        opacity: 1,
      };
    }
    
    // Normal state
    return {
      x: node.x0,
      y: node.y0,
      width: node.width,
      height: node.height,
      opacity: 1,
    };
  }, [node, isZoomTarget, animationType, containerWidth, containerHeight]);
  
  // Exit animation state - edge-based push
  const exitAnimation = useMemo(() => {
    // During drilldown, non-target nodes are pushed off screen
    if (animationType === 'drilldown' && zoomTarget && !isZoomTarget) {
      return getEdgeBasedExitAnimation(node, zoomTarget, containerWidth, containerHeight);
    }
    
    // Default: simple fade
    return { 
      opacity: 0,
      x: node.x0,
      y: node.y0,
      width: node.width,
      height: node.height,
    };
  }, [animationType, zoomTarget, isZoomTarget, node, containerWidth, containerHeight]);
  
  // Transition configuration - unified for all nodes
  const transition = useMemo(() => ({
    ...ZOOM_TRANSITION,
    duration: animationType === 'initial' ? 0 : ZOOM_TRANSITION.duration,
  }), [animationType]);
  
  // Build class names
  const classNames = [
    'treemap-node',
    `depth-${node.depth}`,
    isTiny && 'treemap-node-tiny',
    isSmall && 'treemap-node-small',
    hasChildren && 'has-children',
    node.offTrack && isLeaf && 'off-track',
    node.isTeam && 'is-team',
    node.isInitiative && 'is-initiative',
  ].filter(Boolean).join(' ');

  return (
    <motion.div
      ref={ref}
      layoutId={node.key}
      initial={initialAnimation}
      animate={animateState}
      exit={exitAnimation}
      transition={transition}
      className={classNames}
      style={{
        position: 'absolute',
        backgroundColor: node.color,
        overflow: 'hidden',
        cursor: 'pointer',
        zIndex: isZoomTarget ? 100 : node.depth,
        willChange: 'transform',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(node);
      }}
      onMouseEnter={(e) => {
        e.stopPropagation();
        onMouseEnter?.(e, node);
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {/* Node content (label + value) */}
      <TreemapNodeContent node={node} showValue={!shouldRenderChildren} />
      
      {/* Nested children */}
      {shouldRenderChildren && showChildren && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ 
            delay: animationType === 'drilldown' ? duration : 0,
            duration: 0.3 
          }}
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0 
          }}
        >
          <AnimatePresence mode="sync">
            {node.children!.map(child => (
              <TreemapNode
                key={child.key}
                node={{
                  ...child,
                  // Adjust positions relative to parent
                  x0: child.x0 - node.x0,
                  y0: child.y0 - node.y0,
                  x1: child.x1 - node.x0,
                  y1: child.y1 - node.y0,
                }}
                animationType={animationType}
                zoomTarget={zoomTarget}
                containerWidth={node.width}
                containerHeight={node.height}
                onClick={onClick}
                onMouseEnter={onMouseEnter}
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
                showChildren={showChildren}
                renderDepth={renderDepth}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
});

TreemapNode.displayName = 'TreemapNode';

export default memo(TreemapNode);
