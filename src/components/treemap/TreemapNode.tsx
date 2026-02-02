// Framer Motion treemap node component with clean fade animations
// Uses layoutId for smooth position transitions

import { motion, AnimatePresence } from 'framer-motion';
import { memo } from 'react';
import { TreemapLayoutNode, AnimationType, ANIMATION_DURATIONS } from './types';
import { formatBudget } from '@/lib/dataManager';

interface TreemapNodeProps {
  node: TreemapLayoutNode;
  animationType: AnimationType;
  onClick?: (node: TreemapLayoutNode) => void;
  onMouseEnter?: (e: React.MouseEvent, node: TreemapLayoutNode) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  showChildren?: boolean;
  renderDepth?: number;
}

// Node content component
const TreemapNodeContent = memo(({ node, showValue }: { node: TreemapLayoutNode; showValue: boolean }) => {
  const isTiny = node.width < 60 || node.height < 40;
  const isSmall = node.width < 100 || node.height < 60;
  const hasChildren = node.children && node.children.length > 0;
  
  if (node.height < 30) return null;
  
  // Header style for parent nodes
  if (hasChildren) {
    return (
      <div 
        className={`absolute top-1 left-1 right-1 font-semibold text-white ${isTiny ? 'text-[9px]' : isSmall ? 'text-[11px]' : 'text-[14px]'}`}
        style={{ 
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {node.name}
      </div>
    );
  }
  
  // Centered content for leaf nodes
  return (
    <div className="absolute inset-0 flex items-center justify-center p-1">
      <div className="text-center w-full px-1">
        <div 
          className={`font-semibold text-white ${isTiny ? 'text-[9px]' : isSmall ? 'text-[11px]' : 'text-[14px]'}`}
          style={{ 
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
            className={`text-white/90 mt-0.5 ${isSmall ? 'text-[10px]' : 'text-[12px]'}`}
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
          >
            {formatBudget(node.value)}
          </div>
        )}
      </div>
    </div>
  );
});

TreemapNodeContent.displayName = 'TreemapNodeContent';

// Main node component
const TreemapNode = memo(({
  node,
  animationType,
  onClick,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  showChildren = true,
  renderDepth = 3,
}: TreemapNodeProps) => {
  const duration = animationType === 'initial' ? 0 : ANIMATION_DURATIONS[animationType] / 1000;
  const hasChildren = node.children && node.children.length > 0;
  const shouldRenderChildren = hasChildren && node.depth < renderDepth - 1;
  const isLeaf = !hasChildren;
  
  // Build class names
  const isTiny = node.width < 60 || node.height < 40;
  const isSmall = node.width < 100 || node.height < 60;
  
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
      layoutId={node.key}
      initial={{ opacity: 0 }}
      animate={{ 
        opacity: 1,
        x: node.x0,
        y: node.y0,
        width: node.width,
        height: node.height,
      }}
      exit={{ opacity: 0 }}
      transition={{ 
        duration,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={classNames}
      style={{
        position: 'absolute',
        backgroundColor: node.color,
        borderRadius: 4,
        overflow: 'hidden',
        cursor: 'pointer',
        border: '1px solid rgba(255,255,255,0.3)',
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
        <div className="absolute inset-0" style={{ padding: hasChildren ? '24px 4px 4px 4px' : '4px' }}>
          <AnimatePresence mode="sync">
            {node.children!.map(child => (
              <TreemapNode
                key={child.key}
                node={{
                  ...child,
                  // Adjust positions relative to parent (with header offset for parent nodes)
                  x0: child.x0 - node.x0 - 4,
                  y0: child.y0 - node.y0 - 24,
                  x1: child.x1 - node.x0 - 4,
                  y1: child.y1 - node.y0 - 24,
                }}
                animationType={animationType}
                onClick={onClick}
                onMouseEnter={onMouseEnter}
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
                showChildren={showChildren}
                renderDepth={renderDepth}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
});

TreemapNode.displayName = 'TreemapNode';

export default TreemapNode;
