// Framer Motion treemap node component

import { motion, AnimatePresence } from 'framer-motion';
import { memo, useMemo, forwardRef } from 'react';
import { TreemapLayoutNode, AnimationType, ANIMATION_DURATIONS } from './types';
import { formatBudget } from '@/lib/dataManager';

interface TreemapNodeProps {
  node: TreemapLayoutNode;
  animationType: AnimationType;
  zoomTargetKey?: string | null;
  containerWidth: number;
  containerHeight: number;
  onClick?: (node: TreemapLayoutNode) => void;
  onMouseEnter?: (e: React.MouseEvent, node: TreemapLayoutNode) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  // For exit animations - the center of the zoom target
  exitCenter?: { x: number; y: number } | null;
  // For enter animations - whether this node is entering from outside
  isEntering?: boolean;
  containerCenter?: { x: number; y: number };
  // Show children with delay after parent animation
  showChildren?: boolean;
  // Render depth control
  renderDepth?: number;
}

// Ease-in-out cubic bezier
const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const;

// Calculate exit animation values
function getExitAnimation(
  node: TreemapLayoutNode,
  exitCenter: { x: number; y: number } | null,
  containerWidth: number,
  containerHeight: number
) {
  if (!exitCenter) {
    return { opacity: 0 };
  }
  
  const nodeCenter = {
    x: node.x0 + node.width / 2,
    y: node.y0 + node.height / 2
  };
  
  const dx = nodeCenter.x - exitCenter.x;
  const dy = nodeCenter.y - exitCenter.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const pushFactor = Math.max(containerWidth, containerHeight) * 1.5;
  
  return {
    x: node.x0 + (dx / distance) * pushFactor,
    y: node.y0 + (dy / distance) * pushFactor,
    width: 0,
    height: 0,
    opacity: 0.6,
  };
}

// Calculate enter animation values (for navigate-up)
function getEnterAnimation(
  node: TreemapLayoutNode,
  containerCenter: { x: number; y: number },
  containerWidth: number,
  containerHeight: number
) {
  const nodeCenter = {
    x: node.x0 + node.width / 2,
    y: node.y0 + node.height / 2
  };
  
  const dx = nodeCenter.x - containerCenter.x;
  const dy = nodeCenter.y - containerCenter.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  const pushFactor = Math.max(containerWidth, containerHeight) * 1.5;
  
  return {
    x: containerCenter.x + (dx / distance) * pushFactor,
    y: containerCenter.y + (dy / distance) * pushFactor,
    width: 0,
    height: 0,
    opacity: 0.6,
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
  zoomTargetKey,
  containerWidth,
  containerHeight,
  onClick,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  exitCenter,
  isEntering = false,
  containerCenter,
  showChildren = true,
  renderDepth = 3,
}, ref) => {
  const duration = ANIMATION_DURATIONS[animationType] / 1000;
  const isZoomTarget = zoomTargetKey === node.key;
  const hasChildren = node.children && node.children.length > 0;
  const shouldRenderChildren = hasChildren && node.depth < renderDepth - 1;
  const isLeaf = !hasChildren;
  
  // Determine size class
  const isTiny = node.width < 60 || node.height < 40;
  const isSmall = node.width < 100 || node.height < 60;
  
  // Initial animation state (for new nodes appearing)
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
    
    if (isEntering && containerCenter) {
      return getEnterAnimation(node, containerCenter, containerWidth, containerHeight);
    }
    
    // Default: fade in with slight scale
    return {
      x: node.x0,
      y: node.y0,
      width: node.width,
      height: node.height,
      opacity: 0,
    };
  }, [animationType, isEntering, containerCenter, node, containerWidth, containerHeight]);
  
  // Target animation state
  const animateState = useMemo(() => {
    if (isZoomTarget && animationType === 'drilldown') {
      // Zoom target expands to fullscreen
      return {
        x: 0,
        y: 0,
        width: containerWidth,
        height: containerHeight,
        opacity: 1,
      };
    }
    
    return {
      x: node.x0,
      y: node.y0,
      width: node.width,
      height: node.height,
      opacity: 1,
    };
  }, [node, isZoomTarget, animationType, containerWidth, containerHeight]);
  
  // Exit animation state
  const exitAnimation = useMemo(() => {
    if (animationType === 'drilldown' && exitCenter && !isZoomTarget) {
      return getExitAnimation(node, exitCenter, containerWidth, containerHeight);
    }
    
    // Default fade out
    return { opacity: 0 };
  }, [animationType, exitCenter, isZoomTarget, node, containerWidth, containerHeight]);
  
  // Transition configuration
  const transition = useMemo(() => ({
    type: 'tween' as const,
    ease: EASE_IN_OUT,
    duration: animationType === 'initial' ? 0 : duration,
  }), [duration, animationType]);
  
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
                zoomTargetKey={zoomTargetKey}
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
