// Treemap container with Framer Motion animation orchestration

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { AnimatePresence, LayoutGroup } from 'framer-motion';
import { ArrowUp, Upload, FileText, Search } from 'lucide-react';
import TreemapNode from './TreemapNode';
import TreemapTooltip from './TreemapTooltip';
import { useTreemapLayout } from './useTreemapLayout';
import { TreemapLayoutNode, AnimationType, ANIMATION_DURATIONS, ColorGetter, ZoomTargetInfo } from './types';
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
  // For Budget treemap: use unit colors
  // For Stakeholders: use stakeholder colors
  getColor?: ColorGetter;
  // Empty state customization
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
  const [zoomTargetInfo, setZoomTargetInfo] = useState<ZoomTargetInfo | null>(null);
  const [showHint, setShowHint] = useState(true);
  const [isDropHovering, setIsDropHovering] = useState(false);
  const dropCounterRef = useRef(0);
  
  // Track previous state for animation type detection
  const prevDataNameRef = useRef<string | null>(null);
  const isFirstRenderRef = useRef(true);
  
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
  
  // Track layout nodes for exit animations
  const prevLayoutNodesRef = useRef<TreemapLayoutNode[]>([]);
  const [nodesForExit, setNodesForExit] = useState<TreemapLayoutNode[]>([]);
  
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
      // Debounce resize
      setTimeout(updateDimensions, 100);
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, []);
  
  // Detect animation type based on data changes
  useEffect(() => {
    if (isEmpty) return;
    
    let newAnimationType: AnimationType = 'filter';
    
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      newAnimationType = 'initial';
    } else if (dimensions.width > 0 && prevDataNameRef.current !== data.name) {
      // Data root changed
      newAnimationType = canNavigateBack ? 'drilldown' : 'navigate-up';
    }
    
    prevDataNameRef.current = data.name;
    setAnimationType(newAnimationType);
    
    // For drilldown, set up exit animation with full zoom target info
    if (newAnimationType === 'drilldown' && clickedNodeName) {
      const clickedNode = prevLayoutNodesRef.current.find(n => n.name === clickedNodeName);
      if (clickedNode) {
        setZoomTargetInfo({
          key: clickedNode.key,
          name: clickedNode.name,
          x0: clickedNode.x0,
          y0: clickedNode.y0,
          x1: clickedNode.x1,
          y1: clickedNode.y1,
          width: clickedNode.width,
          height: clickedNode.height,
        });
        setNodesForExit(prevLayoutNodesRef.current);
      }
    } else {
      setZoomTargetInfo(null);
      setNodesForExit([]);
    }
    
    // Clear exit state after animation
    if (newAnimationType === 'drilldown') {
      const duration = ANIMATION_DURATIONS.drilldown;
      setTimeout(() => {
        setNodesForExit([]);
        setZoomTargetInfo(null);
      }, duration);
    }
    
    // Show hint briefly
    setShowHint(true);
    setTimeout(() => setShowHint(false), 3000);
  }, [data.name, canNavigateBack, clickedNodeName, isEmpty, dimensions.width]);
  
  // Store current layout for next transition
  useEffect(() => {
    if (layoutNodes.length > 0) {
      prevLayoutNodesRef.current = layoutNodes;
    }
  }, [layoutNodes]);
  
  // Render depth
  const renderDepth = useMemo(() => {
    if (showTeams && showInitiatives) return 3;
    if (showTeams || showInitiatives) return 2;
    return 1;
  }, [showTeams, showInitiatives]);
  
  // Container center for enter animations
  const containerCenter = useMemo(() => ({
    x: dimensions.width / 2,
    y: dimensions.height / 2,
  }), [dimensions]);
  
  // Node click handler
  const handleNodeClick = useCallback((node: TreemapLayoutNode) => {
    if (node.data.isInitiative && onInitiativeClick) {
      onInitiativeClick(node.data.name);
    } else if (onNodeClick) {
      onNodeClick(node.data);
    }
  }, [onNodeClick, onInitiativeClick]);
  
  // Tooltip handlers
  const handleMouseEnter = useCallback((e: React.MouseEvent, node: TreemapLayoutNode) => {
    setTooltipData({
      node,
      position: { x: e.clientX, y: e.clientY },
    });
  }, []);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (tooltipData) {
      setTooltipData(prev => prev ? { ...prev, position: { x: e.clientX, y: e.clientY } } : null);
    }
  }, [tooltipData]);
  
  const handleMouseLeave = useCallback(() => {
    setTooltipData(null);
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
  
  // Determine which nodes to render (current + exiting)
  const nodesToRender = useMemo(() => {
    if (nodesForExit.length > 0 && animationType === 'drilldown') {
      // During drilldown, render both exiting nodes and new nodes
      return nodesForExit;
    }
    return layoutNodes;
  }, [nodesForExit, layoutNodes, animationType]);
  
  // After drilldown animation completes, switch to new nodes
  const [showNewNodes, setShowNewNodes] = useState(false);
  
  useEffect(() => {
    if (animationType === 'drilldown' && nodesForExit.length > 0) {
      setShowNewNodes(false);
      const duration = ANIMATION_DURATIONS.drilldown;
      setTimeout(() => {
        setShowNewNodes(true);
      }, duration * 0.8); // Show new nodes slightly before exit completes
    } else {
      setShowNewNodes(true);
    }
  }, [animationType, nodesForExit.length]);

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
      
      {/* Treemap nodes */}
      {!isEmpty && dimensions.width > 0 && (
        <LayoutGroup>
          {/* CRITICAL: custom prop passes zoomTargetInfo to all exiting nodes' variant functions */}
          <AnimatePresence mode="sync" custom={zoomTargetInfo}>
            {/* Exiting nodes (during drilldown) - use edge-based push */}
            {nodesForExit.length > 0 && animationType === 'drilldown' && nodesForExit.map(node => (
              <TreemapNode
                key={`exit-${node.key}`}           // Unique key for exiting nodes!
                node={{
                  ...node,
                  key: `exit-${node.key}`,         // Unique layoutId too!
                }}
                animationType={animationType}
                zoomTarget={zoomTargetInfo}        // Pass full info
                containerWidth={dimensions.width}
                containerHeight={dimensions.height}
                onClick={handleNodeClick}
                onMouseEnter={handleMouseEnter}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                renderDepth={renderDepth}
              />
            ))}
            
            {/* Current/new nodes - also receive zoomTargetInfo for animate state */}
            {(showNewNodes || animationType !== 'drilldown') && layoutNodes.map(node => (
              <TreemapNode
                key={node.key}
                node={node}
                animationType={nodesForExit.length > 0 ? 'filter' : animationType}
                zoomTarget={zoomTargetInfo}        // Pass info here too!
                containerWidth={dimensions.width}
                containerHeight={dimensions.height}
                onClick={handleNodeClick}
                onMouseEnter={handleMouseEnter}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                isEntering={animationType === 'navigate-up'}
                containerCenter={containerCenter}
                renderDepth={renderDepth}
              />
            ))}
          </AnimatePresence>
        </LayoutGroup>
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
