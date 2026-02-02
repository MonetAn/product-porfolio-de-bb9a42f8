// Treemap container with D3 transitions (replacing Framer Motion)

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { ArrowUp, Upload, FileText, Search } from 'lucide-react';
import TreemapD3Layer from './TreemapD3Layer';
import TreemapTooltip from './TreemapTooltip';
import { useTreemapLayout } from './useTreemapLayout';
import { TreemapLayoutNode, AnimationType, ZoomTargetInfo, ColorGetter } from './types';
import { TreeNode } from '@/lib/dataManager';
import '@/styles/treemap.css';

interface TreemapContainerProps {
  data: TreeNode;
  showTeams?: boolean;
  showInitiatives?: boolean;
  onNodeClick?: (node: TreeNode) => void;
  onNavigateBack?: () => void;
  canNavigateBack?: boolean;
  onInitiativeClick?: (initiativeName: string) => void;
  selectedQuarters?: string[];
  hasData?: boolean;
  onResetFilters?: () => void;
  selectedUnitsCount?: number;
  clickedNodeName?: string | null;
  getColor?: ColorGetter;
  emptyStateTitle?: string;
  emptyStateSubtitle?: string;
  showUploadButton?: boolean;
  onUploadClick?: () => void;
  onFileDrop?: (file: File) => void;
}

const TreemapContainer = ({
  data,
  showTeams = false,
  showInitiatives = false,
  onNodeClick,
  onNavigateBack,
  canNavigateBack = false,
  onInitiativeClick,
  selectedQuarters = [],
  hasData = false,
  onResetFilters,
  selectedUnitsCount = 0,
  clickedNodeName = null,
  getColor,
  emptyStateTitle = 'Нет инициатив по выбранным фильтрам',
  emptyStateSubtitle = 'Попробуйте изменить параметры фильтрации или сбросить фильтры',
  showUploadButton = false,
  onUploadClick,
  onFileDrop,
}: TreemapContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [animationType, setAnimationType] = useState<AnimationType>('initial');
  const [showHint, setShowHint] = useState(true);
  const [isDropHovering, setIsDropHovering] = useState(false);
  const dropCounterRef = useRef(0);
  
  // Track previous state for animation type detection
  const prevDataNameRef = useRef<string | null>(null);
  const prevLayoutNodesRef = useRef<TreemapLayoutNode[]>([]);
  const isFirstRenderRef = useRef(true);
  
  // FIX: Use STATE instead of refs for drilldown snapshots (prevents race condition)
  const [exitingNodesSnapshot, setExitingNodesSnapshot] = useState<TreemapLayoutNode[]>([]);
  const [zoomTargetSnapshot, setZoomTargetSnapshot] = useState<ZoomTargetInfo | null>(null);
  
  // Helper: Flatten all nodes (including nested children) for complete tracking
  const flattenAllNodes = useCallback((nodes: TreemapLayoutNode[]): TreemapLayoutNode[] => {
    const result: TreemapLayoutNode[] = [];
    function traverse(node: TreemapLayoutNode) {
      result.push(node);
      if (node.children) node.children.forEach(traverse);
    }
    nodes.forEach(traverse);
    return result;
  }, []);
  
  // Tooltip state
  const [tooltipData, setTooltipData] = useState<{
    node: TreemapLayoutNode;
    position: { x: number; y: number };
  } | null>(null);
  
  const isEmpty = !data.children || data.children.length === 0;
  const lastQuarter = selectedQuarters.length > 0 ? selectedQuarters[selectedQuarters.length - 1] : null;
  
  // Compute layout using D3
  const layoutNodes = useTreemapLayout({
    data,
    dimensions,
    showTeams,
    showInitiatives,
    getColor,
  });
  
  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    
    updateDimensions();
    
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(updateDimensions, 100);
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, []);
  
  // CRITICAL: Capture exiting nodes BEFORE data changes (when clickedNodeName changes)
  // FIX: Use STATE setters to guarantee React renders with consistent snapshot
  useEffect(() => {
    if (clickedNodeName && prevLayoutNodesRef.current.length > 0) {
      console.log('[DRILLDOWN] clickedNodeName changed:', clickedNodeName);
      console.log('[DRILLDOWN] prevLayoutNodesRef has nodes:', prevLayoutNodesRef.current.length);
      
      // Find clicked node in the FULL flattened list
      const clickedNode = prevLayoutNodesRef.current.find(n => n.name === clickedNodeName);
      
      if (clickedNode) {
        console.log('[DRILLDOWN] Found clicked node:', clickedNode.name, 'at depth:', clickedNode.depth);
        
        // Filter to get only siblings (same depth, same parent)
        const siblings = prevLayoutNodesRef.current.filter(
          n => n.depth === clickedNode.depth && n.parentName === clickedNode.parentName
        );
        console.log('[DRILLDOWN] Setting exitingNodesSnapshot (siblings):', siblings.length, siblings.map(n => n.name).join(', '));
        
        // FIX: Set as STATE so React batches and D3Layer receives consistent data
        setExitingNodesSnapshot(siblings);
        setZoomTargetSnapshot({
          key: clickedNode.key,
          name: clickedNode.name,
          x0: clickedNode.x0,
          y0: clickedNode.y0,
          x1: clickedNode.x1,
          y1: clickedNode.y1,
          width: clickedNode.width,
          height: clickedNode.height,
          animationType: 'drilldown',
        });
      } else {
        console.log('[DRILLDOWN] WARNING: Clicked node not found in prevLayoutNodes. Searched for:', clickedNodeName);
      }
    }
  }, [clickedNodeName]);
  
  // Detect animation type based on data changes
  // FIX: Do NOT clear snapshots here - let onAnimationComplete handle it
  useEffect(() => {
    if (isEmpty) return;
    
    let newAnimationType: AnimationType = 'filter';
    
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      newAnimationType = 'initial';
    } else if (dimensions.width > 0 && prevDataNameRef.current !== data.name) {
      // Data root changed - determine if drilldown or navigate-up
      newAnimationType = canNavigateBack ? 'drilldown' : 'navigate-up';
    }
    
    prevDataNameRef.current = data.name;
    setAnimationType(newAnimationType);
    
    // For non-drilldown, clear snapshots immediately
    if (newAnimationType !== 'drilldown') {
      setZoomTargetSnapshot(null);
      setExitingNodesSnapshot([]);
    }
    // For drilldown: snapshots are already set by clickedNodeName effect
    // They will be cleared in onAnimationComplete
    
    // Show hint briefly
    setShowHint(true);
    setTimeout(() => setShowHint(false), 3000);
  }, [data.name, canNavigateBack, isEmpty, dimensions.width]);
  
  // Store ALL current layout nodes (flattened) for next transition
  useEffect(() => {
    if (layoutNodes.length > 0) {
      // CRITICAL: Flatten ALL nodes including children for complete tracking
      prevLayoutNodesRef.current = flattenAllNodes(layoutNodes);
      console.log('[LAYOUT] Saved flattened nodes:', prevLayoutNodesRef.current.length, 'from', layoutNodes.length, 'root nodes');
    }
  }, [layoutNodes, flattenAllNodes]);
  
  // Render depth calculation
  const renderDepth = useMemo(() => {
    if (showTeams && showInitiatives) return 3;
    if (showTeams || showInitiatives) return 2;
    return 1;
  }, [showTeams, showInitiatives]);
  
  // Node click handler
  const handleNodeClick = useCallback((node: TreemapLayoutNode) => {
    if (node.data.isInitiative && onInitiativeClick) {
      onInitiativeClick(node.data.name);
    } else if (onNodeClick) {
      onNodeClick(node.data);
    }
  }, [onNodeClick, onInitiativeClick]);
  
  // Tooltip handlers (adapted for native MouseEvent)
  const handleMouseEnter = useCallback((e: MouseEvent, node: TreemapLayoutNode) => {
    setTooltipData({
      node,
      position: { x: e.clientX, y: e.clientY },
    });
  }, []);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    setTooltipData(prev => prev ? { ...prev, position: { x: e.clientX, y: e.clientY } } : null);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    setTooltipData(null);
  }, []);
  
  // Animation complete handler - FIX: Clear both snapshots here
  const handleAnimationComplete = useCallback(() => {
    setZoomTargetSnapshot(null);
    setExitingNodesSnapshot([]);
  }, []);
  
  // Drop zone handlers
  const handleDropZoneDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDropHovering(true);
    }
  }, []);

  const handleDropZoneDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropCounterRef.current--;
    if (dropCounterRef.current === 0) {
      setIsDropHovering(false);
    }
  }, []);

  const handleDropZoneDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDropZoneDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropHovering(false);
    dropCounterRef.current = 0;

    const file = e.dataTransfer.files?.[0];
    if (file && onFileDrop) {
      onFileDrop(file);
    }
  }, [onFileDrop]);

  return (
    <div className="treemap-container" ref={containerRef}>
      {/* Navigate back button */}
      <button
        className={`navigate-back-button ${canNavigateBack ? 'visible' : ''}`}
        onClick={onNavigateBack}
        title="Подняться на уровень выше"
      >
        <ArrowUp size={28} strokeWidth={2.5} />
      </button>
      
      {/* Instruction hint */}
      <div className={`instruction-hint ${showHint && !isEmpty ? 'visible' : ''}`}>
        Кликните на блок для детализации
      </div>
      
      {/* Tooltip */}
      <TreemapTooltip
        data={tooltipData}
        lastQuarter={lastQuarter}
        selectedUnitsCount={selectedUnitsCount}
        totalValue={layoutNodes.reduce((sum, n) => sum + n.value, 0)}
      />
      
      {/* D3-based treemap rendering */}
      {!isEmpty && dimensions.width > 0 && (
        <TreemapD3Layer
          layoutNodes={layoutNodes}
          width={dimensions.width}
          height={dimensions.height}
          animationType={animationType}
          zoomTarget={zoomTargetSnapshot}
          exitingNodes={exitingNodesSnapshot}
          renderDepth={renderDepth}
          onNodeClick={handleNodeClick}
          onNodeMouseEnter={handleMouseEnter}
          onNodeMouseMove={handleMouseMove}
          onNodeMouseLeave={handleMouseLeave}
          onAnimationComplete={handleAnimationComplete}
        />
      )}
      
      {/* Empty state: No initiatives for selected filters */}
      {isEmpty && hasData && (
        <div className="welcome-empty-state">
          <div className="welcome-icon">
            <Search size={60} />
          </div>
          <h1 className="welcome-title">{emptyStateTitle}</h1>
          <p className="welcome-subtitle">{emptyStateSubtitle}</p>
          {onResetFilters && (
            <button 
              onClick={onResetFilters}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      )}
      
      {/* Empty state: No data loaded */}
      {isEmpty && !hasData && (
        <div 
          className={`welcome-empty-state ${isDropHovering ? 'drag-hover' : ''}`}
          onDragEnter={handleDropZoneDragEnter}
          onDragLeave={handleDropZoneDragLeave}
          onDragOver={handleDropZoneDragOver}
          onDrop={handleDropZoneDrop}
        >
          <div className="welcome-icon">
            <FileText size={60} />
          </div>
          <h1 className="welcome-title">
            {showUploadButton ? 'Добро пожаловать в ProductDashboard' : 'Нет данных для отображения'}
          </h1>
          <p className="welcome-subtitle">
            {showUploadButton 
              ? 'Загрузите CSV-файл с данными о ваших инициативах, чтобы начать анализ бюджетов, команд и стейкхолдеров'
              : 'Загрузите CSV-файл с данными для просмотра'
            }
          </p>
          {showUploadButton && onUploadClick && (
            <>
              <button className="welcome-upload-btn" onClick={onUploadClick}>
                <Upload size={24} />
                Загрузить CSV файл
              </button>
              <p className="welcome-hint">
                или перетащите файл <code>.csv</code> сюда
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TreemapContainer;
