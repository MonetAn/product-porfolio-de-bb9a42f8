// Framer Motion treemap node component with clean fade animations
// Uses layoutId for smooth position transitions

import { motion, AnimatePresence } from 'framer-motion';
import { memo } from 'react';
import { TreemapLayoutNode, AnimationType, ANIMATION_DURATIONS } from './types';
import { formatBudget } from '@/lib/dataManager';

// Calculate relative luminance for WCAG contrast
function getLuminance(hex: string): number {
  const rgb = parseInt(hex.slice(1), 16);
  const r = ((rgb >> 16) & 255) / 255;
  const g = ((rgb >> 8) & 255) / 255;
  const b = (rgb & 255) / 255;
  
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// Returns appropriate text color based on background luminance
function getTextColorClass(bgColor: string): string {
  const luminance = getLuminance(bgColor);
  return luminance > 0.4 ? 'text-gray-900' : 'text-white';
}

interface TreemapNodeProps {
  node: TreemapLayoutNode;
  animationType: AnimationType;
  parentX?: number;  // Absolute X of parent (default 0)
  parentY?: number;  // Absolute Y of parent (default 0)
  clickCenter?: { x: number; y: number } | null;
  isHero?: boolean;
  containerDimensions?: { width: number; height: number };
  onClick?: (node: TreemapLayoutNode) => void;
  onMouseEnter?: (e: React.MouseEvent, node: TreemapLayoutNode) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: (node?: TreemapLayoutNode) => void;
  showChildren?: boolean;
  renderDepth?: number;
}

interface TreemapNodeContentProps {
  node: TreemapLayoutNode;
  showValue: boolean;
  textColorClass: string;
}

// Node content component
const TreemapNodeContent = memo(({ node, showValue, textColorClass }: TreemapNodeContentProps) => {
  const isTiny = node.width < 60 || node.height < 40;
  const isSmall = node.width < 100 || node.height < 60;
  const hasChildren = node.children && node.children.length > 0;
  
  if (node.height < 30) return null;
  
  // Header style for parent nodes
  if (hasChildren) {
    return (
      <div 
        className={`absolute top-0.5 left-1 right-1 font-semibold ${textColorClass} ${isTiny ? 'text-[9px]' : isSmall ? 'text-[11px]' : 'text-[14px]'}`}
        style={{ 
          textShadow: textColorClass === 'text-white' ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: '1.2',
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
          className={`font-semibold ${textColorClass} ${isTiny ? 'text-[9px]' : isSmall ? 'text-[11px]' : 'text-[14px]'}`}
          style={{ 
            textShadow: textColorClass === 'text-white' ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {node.name}
        </div>
        {showValue && node.height > 40 && !isTiny && (
          <div 
            className={`${textColorClass === 'text-white' ? 'text-white/90' : 'text-gray-700'} mt-0.5 ${isSmall ? 'text-[10px]' : 'text-[12px]'}`}
            style={{ textShadow: textColorClass === 'text-white' ? '0 1px 2px rgba(0,0,0,0.3)' : 'none' }}
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
  parentX = 0,
  parentY = 0,
  clickCenter,
  isHero = false,
  containerDimensions,
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
  const textColorClass = getTextColorClass(node.color);
  
  // Calculate relative position from absolute coordinates
  const x = node.x0 - parentX;
  const y = node.y0 - parentY;
  
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

  // Variants: exit receives fresh custom from AnimatePresence (fixes stale props)
  const skipInitial = animationType === 'initial';
  const variants = {
    initial: { opacity: 0, scale: 0.92, x, y, width: node.width, height: node.height },
    animate: {
      opacity: 1,
      scale: 1,
      x,
      y,
      width: node.width,
      height: node.height,
      transition: {
        duration,
        ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
        scale: { duration: duration * 0.8 },
      },
    },
    exit: (customClickCenter: { x: number; y: number } | null) => {
      if (customClickCenter && containerDimensions && !isHero) {
        const nodeCenterX = node.x0 + node.width / 2;
        const nodeCenterY = node.y0 + node.height / 2;
        const dx = nodeCenterX - customClickCenter.x;
        const dy = nodeCenterY - customClickCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = Math.max(containerDimensions.width, containerDimensions.height) * 1.5;
        return {
          x: x + (dx / distance) * force,
          y: y + (dy / distance) * force,
          opacity: 0,
          scale: 0.8,
          transition: { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
        };
      }
      return { opacity: 0, scale: 0.92 };
    },
  };

  return (
    <motion.div
      variants={variants}
      initial={skipInitial ? false : "initial"}
      animate="animate"
      exit="exit"
      className={classNames}
      style={{
        position: 'absolute',
        backgroundColor: node.color,
        borderRadius: 4,
        overflow: 'hidden',
        cursor: 'pointer',
        transformOrigin: 'center center',
        zIndex: isHero ? 10 : 1,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(node);
      }}
      onMouseOver={(e) => {
        e.stopPropagation();
        onMouseEnter?.(e, node);
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={(e) => {
        e.stopPropagation();
        onMouseLeave?.(node);
      }}
    >
      {/* Node content (label + value) */}
      <TreemapNodeContent node={node} showValue={!shouldRenderChildren} textColorClass={textColorClass} />
      
      {/* Nested children */}
      {shouldRenderChildren && showChildren && (
        <div className="absolute inset-0">
          <AnimatePresence mode="sync" custom={clickCenter}>
            {node.children!.map(child => (
              <TreemapNode
                key={child.key}
                node={child}
                animationType={animationType}
                parentX={node.x0}
                parentY={node.y0}
                clickCenter={clickCenter}
                isHero={false}
                containerDimensions={containerDimensions}
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
