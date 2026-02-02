// Treemap container with Framer Motion animations

import { useRef, useState, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ArrowUp, Upload, FileText, Search } from 'lucide-react';
import TreemapNode from './TreemapNode';
import TreemapTooltip from './TreemapTooltip';
import { useTreemapLayout } from './useTreemapLayout';
import { TreemapLayoutNode, AnimationType, ColorGetter } from './types';
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
  extraDepth?: number;
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
  getColor,
  emptyStateTitle = 'Нет инициатив по выбранным фильтрам',
  emptyStateSubtitle = 'Попробуйте изменить параметры фильтрации или сбросить фильтры',
  showUploadButton = false,
  onUploadClick,
  onFileDrop,
  extraDepth = 0,
}: TreemapContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [animationType, setAnimationType] = useState<AnimationType>('initial');
  const [showHint, setShowHint] = useState(true);
  const [isDropHovering, setIsDropHovering] = useState(false);
  const dropCounterRef = useRef(0);
  
  // Track previous state for animation type detection
  const prevDataNameRef = useRef<string | null>(null);
  const prevShowTeamsRef = useRef(showTeams);
  const prevShowInitiativesRef = useRef(showInitiatives);
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
    extraDepth,
  });
  
  // Measure container synchronously to avoid flash
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    
    // Sync measurement before paint
    updateDimensions();
    
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateDimensions);
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
  }, []);
  
  // Detect animation type based on data changes - useLayoutEffect to set before paint
  useLayoutEffect(() => {
    if (isEmpty) return;
    
    let newAnimationType: AnimationType = 'filter';
    
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      newAnimationType = 'initial';
    } else if (dimensions.width > 0 && prevDataNameRef.current !== data.name) {
      // Data root changed - determine if drilldown or navigate-up
      newAnimationType = canNavigateBack ? 'drilldown' : 'navigate-up';
    } else if (prevShowTeamsRef.current !== showTeams || 
               prevShowInitiativesRef.current !== showInitiatives) {
      // Checkbox filter change - use filter animation
      newAnimationType = 'filter';
    }
    
    prevDataNameRef.current = data.name;
    prevShowTeamsRef.current = showTeams;
    prevShowInitiativesRef.current = showInitiatives;
    setAnimationType(newAnimationType);
    
    // Show hint briefly
    setShowHint(true);
    const timer = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(timer);
  }, [data.name, showTeams, showInitiatives, canNavigateBack, isEmpty, dimensions.width]);
  
  // Render depth calculation
  const renderDepth = useMemo(() => {
    let depth = 1;
    if (showTeams && showInitiatives) depth = 3;
    else if (showTeams || showInitiatives) depth = 2;
    return depth + extraDepth;
  }, [showTeams, showInitiatives, extraDepth]);
  
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
    setTooltipData(prev => prev ? { ...prev, position: { x: e.clientX, y: e.clientY } } : null);
  }, []);
  
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

  return (
    <div className="treemap-container" ref={containerRef} onMouseLeave={handleMouseLeave}>
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
      
      {/* Framer Motion treemap rendering */}
      {!isEmpty && dimensions.width > 0 && (
        <AnimatePresence mode="sync">
          {layoutNodes.map(node => (
            <TreemapNode
              key={node.key}
              node={node}
              animationType={animationType}
              onClick={handleNodeClick}
              onMouseEnter={handleMouseEnter}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              showChildren={true}
              renderDepth={renderDepth}
            />
          ))}
        </AnimatePresence>
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
