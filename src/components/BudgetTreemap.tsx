import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { ArrowUp, Upload, FileText, Search } from 'lucide-react';
import {
  TreeNode,
  formatBudget,
  escapeHtml,
  getUnitColor,
  adjustBrightness
} from '@/lib/dataManager';
import '@/styles/treemap.css';

// Animation type determines duration
type AnimationType = 'filter' | 'drilldown' | 'navigate-up' | 'resize';

const ANIMATION_DURATIONS: Record<AnimationType, number> = {
  'filter': 800,
  'drilldown': 500,
  'navigate-up': 600,
  'resize': 300
};

interface BudgetTreemapProps {
  data: TreeNode;
  onDrillDown?: (node: TreeNode) => void;
  onNavigateUp?: () => void;
  showBackButton?: boolean;
  showTeams?: boolean;
  showInitiatives?: boolean;
  onUploadClick?: () => void;
  selectedQuarters?: string[];
  onNodeClick?: (node: TreeNode) => void;
  onNavigateBack?: () => void;
  canNavigateBack?: boolean;
  onInitiativeClick?: (initiativeName: string) => void;
  onFileDrop?: (file: File) => void;
  hasData?: boolean;
  onResetFilters?: () => void;
  selectedUnitsCount?: number;
  clickedNodeName?: string | null;
}

const BudgetTreemap = ({
  data,
  onDrillDown,
  onNavigateUp,
  showBackButton = false,
  showTeams = false,
  showInitiatives = false,
  onUploadClick,
  selectedQuarters = [],
  onNodeClick,
  onNavigateBack,
  canNavigateBack = false,
  onInitiativeClick,
  onFileDrop,
  hasData = false,
  onResetFilters,
  selectedUnitsCount = 0,
  clickedNodeName = null
}: BudgetTreemapProps) => {
  const d3ContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(true);
  const [isDropHovering, setIsDropHovering] = useState(false);
  const dropCounterRef = useRef(0);

  // Track previous data root for detecting animation type
  const prevDataNameRef = useRef<string | null>(null);
  const isFirstRenderRef = useRef(true);

  const isEmpty = !data.children || data.children.length === 0;
  const lastQuarter = selectedQuarters.length > 0 ? selectedQuarters[selectedQuarters.length - 1] : null;

  // Drop handlers for empty state
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

  // ===== TREEMAP RENDERING WITH MORPHING ANIMATIONS =====
  const renderTreemap = useCallback((animationType: AnimationType = 'filter', zoomTargetName?: string | null) => {
    const container = d3ContainerRef.current;
    if (!container || isEmpty) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Set animation duration via CSS variable
    const durationMs = ANIMATION_DURATIONS[animationType];
    container.style.setProperty('--transition-current', `${durationMs}ms`);

    if (!data.children || data.children.length === 0) {
      // Clear container if no data
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      return;
    }

    // Determine render depth
    let renderDepth = 3;
    if (data.isTeam) {
      renderDepth = 1;
    } else if (data.isUnit) {
      renderDepth = 2;
    } else {
      renderDepth = 3;
    }

    // Create hierarchy
    const root = d3.hierarchy(data)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // Create treemap layout
    const treemap = d3.treemap<TreeNode>()
      .size([width, height])
      .paddingOuter(2)
      .paddingTop(renderDepth > 1 ? 24 : 2)
      .paddingInner(2)
      .round(true);

    treemap(root);

    if (!root.children) return;

    const totalValue = root.value || 1;

    // ===== TOOLTIP FUNCTIONS =====
    const showTooltip = (e: MouseEvent, nodeData: TreeNode, nodeValue: number, unitValue: number) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      const isInitiative = nodeData.isInitiative || (!nodeData.isUnit && !nodeData.isTeam && !nodeData.isRoot && !nodeData.children);
      
      let html = `<div class="tooltip-header">
        <div class="tooltip-title">${escapeHtml(nodeData.name)}</div>`;
      
      if (isInitiative && nodeData.offTrack !== undefined) {
        html += `<div class="tooltip-status ${nodeData.offTrack ? 'off-track' : 'on-track'}"></div>`;
      }
      html += `</div>`;

      html += `<div class="tooltip-row"><span class="tooltip-label">Бюджет</span><span class="tooltip-value">${formatBudget(nodeValue)}</span></div>`;

      if (nodeValue !== unitValue) {
        const percentOfUnit = unitValue > 0 ? ((nodeValue / unitValue) * 100).toFixed(1) : '100.0';
        html += `<div class="tooltip-row"><span class="tooltip-label">% от Юнита</span><span class="tooltip-value">${percentOfUnit}%</span></div>`;
      }

      const showPercentOfTotal = selectedUnitsCount === 0 || selectedUnitsCount > 1;
      if (showPercentOfTotal) {
        const percentOfTotal = totalValue > 0 ? ((nodeValue / totalValue) * 100).toFixed(1) : '0.0';
        html += `<div class="tooltip-row"><span class="tooltip-label tooltip-label-group"><span>% от бюджета</span><span class="tooltip-label-sub">выбранного на экране</span></span><span class="tooltip-value">${percentOfTotal}%</span></div>`;
      }

      if (isInitiative && nodeData.quarterlyData && lastQuarter) {
        const qData = nodeData.quarterlyData[lastQuarter];
        if (qData && (qData.metricPlan || qData.metricFact)) {
          const [year, quarter] = lastQuarter.split('-');
          const qLabel = `${quarter} ${year}`;
          html += `<div class="tooltip-metrics">`;
          if (qData.metricPlan) {
            const truncatedPlan = qData.metricPlan.length > 100 
              ? qData.metricPlan.slice(0, 100) + '…' 
              : qData.metricPlan;
            html += `<div class="tooltip-metric"><span class="tooltip-metric-label">План (${qLabel})</span><span class="tooltip-metric-value">${escapeHtml(truncatedPlan)}</span></div>`;
          }
          if (qData.metricFact) {
            const truncatedFact = qData.metricFact.length > 100 
              ? qData.metricFact.slice(0, 100) + '…' 
              : qData.metricFact;
            html += `<div class="tooltip-metric"><span class="tooltip-metric-label">Факт (${qLabel})</span><span class="tooltip-metric-value">${escapeHtml(truncatedFact)}</span></div>`;
          }
          html += `</div>`;
        }
      }

      if (nodeData.stakeholders && nodeData.stakeholders.length > 0) {
        html += `<div class="tooltip-stakeholders">
          <div class="tooltip-stakeholders-label">Стейкхолдеры</div>
          <div class="tooltip-tags">${nodeData.stakeholders.map(s => `<span class="tooltip-tag">${escapeHtml(s)}</span>`).join('')}</div>
        </div>`;
      }

      if (nodeData.children) {
        html += '<div class="tooltip-hint">Кликните для детализации →</div>';
      } else if (nodeData.isInitiative) {
        html += '<div class="tooltip-hint">Кликните для перехода в таймлайн →</div>';
      }

      tooltip.innerHTML = html;
      tooltip.classList.add('visible');
      moveTooltip(e);
    };

    const moveTooltip = (e: MouseEvent) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      const padding = 16;
      const rect = tooltip.getBoundingClientRect();
      const tooltipWidth = rect.width;
      const tooltipHeight = rect.height;
      
      let x = e.clientX + padding;
      let y = e.clientY + padding;

      if (x + tooltipWidth > window.innerWidth - padding) {
        x = e.clientX - tooltipWidth - padding;
      }
      if (x < padding) {
        x = padding;
      }

      if (y + tooltipHeight > window.innerHeight - padding) {
        y = e.clientY - tooltipHeight - padding;
      }
      if (y < padding) {
        y = padding;
      }

      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    };

    const hideTooltip = () => {
      const tooltip = tooltipRef.current;
      if (tooltip) {
        tooltip.classList.remove('visible');
      }
    };

    // ===== HELPER: Generate unique key for a node =====
    const getNodeKey = (node: d3.HierarchyRectangularNode<TreeNode>, depth: number): string => {
      // Build path from root to this node for uniqueness
      const parts: string[] = [];
      let current: d3.HierarchyRectangularNode<TreeNode> | null = node;
      while (current && current.data.name) {
        parts.unshift(current.data.name);
        current = current.parent;
      }
      return `d${depth}-${parts.join('/')}`;
    };

    // ===== HELPER: Find unit name for color =====
    const getUnitName = (node: d3.HierarchyRectangularNode<TreeNode>): string => {
      let unitName = node.data.name;
      let current: d3.HierarchyRectangularNode<TreeNode> | null = node;
      while (current.parent && current.parent.parent) {
        current = current.parent;
        unitName = current.data.name;
      }
      return unitName;
    };

    // ===== ANIMATED RENDER NODE =====
    const renderNodeAnimated = (
      node: d3.HierarchyRectangularNode<TreeNode>,
      parentElement: HTMLElement,
      depth: number,
      colorIndex: number,
      parentX0: number,
      parentY0: number
    ) => {
      const nodeKey = getNodeKey(node, depth);
      const nodeWidth = node.x1 - node.x0;
      const nodeHeight = node.y1 - node.y0;

      // Calculate position (relative to parent for nested, absolute for depth-0)
      const left = depth === 0 ? node.x0 : (node.x0 - parentX0);
      const top = depth === 0 ? node.y0 : (node.y0 - parentY0);

      // Find existing node by data-key
      let div = parentElement.querySelector(`[data-key="${nodeKey}"]`) as HTMLElement | null;
      const isNew = !div;

      if (!div) {
        // CREATE new node
        div = document.createElement('div');
        div.setAttribute('data-key', nodeKey);
        div.className = 'treemap-node depth-' + depth;

        // Start with entering class (opacity 0) for fade-in
        div.classList.add('entering');

        // Color
        const unitName = getUnitName(node);
        const baseColor = getUnitColor(unitName);
        if (depth === 0) {
          div.style.backgroundColor = baseColor;
        } else if (depth === 1) {
          div.style.backgroundColor = adjustBrightness(baseColor, -15);
        } else {
          div.style.backgroundColor = adjustBrightness(baseColor, -30);
        }

        // Set initial position
        div.style.left = left + 'px';
        div.style.top = top + 'px';
        div.style.width = nodeWidth + 'px';
        div.style.height = nodeHeight + 'px';

        // Events
        div.addEventListener('click', (e: MouseEvent) => {
          e.stopPropagation();
          if (node.data.isInitiative && onInitiativeClick) {
            onInitiativeClick(node.data.name);
          } else if (onNodeClick) {
            onNodeClick(node.data);
          }
        });

        div.addEventListener('mouseenter', (e: MouseEvent) => {
          e.stopPropagation();
          let unitNode: d3.HierarchyRectangularNode<TreeNode> = node;
          while (unitNode.parent && unitNode.depth > 1) {
            unitNode = unitNode.parent;
          }
          const unitValue = unitNode.value || node.value || 0;
          showTooltip(e, node.data, node.value || 0, unitValue);
        });

        div.addEventListener('mousemove', (e: MouseEvent) => moveTooltip(e));
        div.addEventListener('mouseleave', () => hideTooltip());

        parentElement.appendChild(div);

        // Trigger reflow and remove entering class to start fade-in
        requestAnimationFrame(() => {
          if (div) {
            div.classList.add('animate');
            div.classList.remove('entering');
          }
        });
      } else {
        // UPDATE existing node - animate to new position
        div.classList.add('animate');
        div.classList.remove('exiting');
        
        div.style.left = left + 'px';
        div.style.top = top + 'px';
        div.style.width = nodeWidth + 'px';
        div.style.height = nodeHeight + 'px';
      }

      // Update size classes
      div.classList.remove('treemap-node-tiny', 'treemap-node-small');
      if (nodeWidth < 60 || nodeHeight < 40) {
        div.classList.add('treemap-node-tiny');
      } else if (nodeWidth < 100 || nodeHeight < 60) {
        div.classList.add('treemap-node-small');
      }

      const hasChildren = node.children && node.children.length > 0;
      const shouldRenderChildren = hasChildren && depth < renderDepth;

      div.classList.toggle('has-children', !!hasChildren);

      // Off-track for leaf nodes
      const isLeafNode = !node.data.children || node.data.children.length === 0;
      div.classList.toggle('off-track', isLeafNode && !!node.data.offTrack);

      // Update content
      let content = div.querySelector('.treemap-node-content') as HTMLElement | null;
      if (!shouldRenderChildren || nodeHeight > 50) {
        if (!content) {
          content = document.createElement('div');
          content.className = 'treemap-node-content';
          div.appendChild(content);
        }
        
        // Update label
        let label = content.querySelector('.treemap-node-label') as HTMLElement | null;
        if (!label) {
          label = document.createElement('div');
          label.className = 'treemap-node-label';
          content.appendChild(label);
        }
        label.textContent = node.data.name;

        // Update value
        let value = content.querySelector('.treemap-node-value') as HTMLElement | null;
        if (!shouldRenderChildren && nodeHeight > 40) {
          if (!value) {
            value = document.createElement('div');
            value.className = 'treemap-node-value';
            content.appendChild(value);
          }
          value.textContent = formatBudget(node.value || 0);
        } else if (value) {
          value.remove();
        }
      } else if (content) {
        content.remove();
      }

      // Mark as processed
      div.setAttribute('data-processed', 'true');

      // Render children recursively
      if (shouldRenderChildren && node.children) {
        node.children.forEach(child => {
          renderNodeAnimated(child, div!, depth + 1, colorIndex, node.x0, node.y0);
        });
      }

      return div;
    };

    // ===== HELPER: Render new tree (reusable) =====
    const renderNewTree = () => {
      // Clear processed flags
      container.querySelectorAll('[data-processed]').forEach(el => {
        el.removeAttribute('data-processed');
      });

      // Render all top-level nodes
      root.children!.forEach((node, index) => {
        renderNodeAnimated(node, container, 0, index, 0, 0);
      });

      // Remove any unprocessed nodes (standard behavior)
      container.querySelectorAll('.treemap-node:not([data-processed])').forEach(el => {
        el.remove();
      });
    };

    // ===== DRILLDOWN: Animate EXISTING nodes BEFORE rendering new tree =====
    if (animationType === 'drilldown' && zoomTargetName) {
      // PHASE 1: Find ALL current depth-0 nodes BEFORE any rendering
      const existingNodes = container.querySelectorAll('.treemap-node.depth-0');
      const containerRect = container.getBoundingClientRect();
      
      // Find the clicked node among EXISTING nodes
      const zoomTargetEl = Array.from(existingNodes).find(
        el => el.getAttribute('data-key')?.includes(zoomTargetName)
      ) as HTMLElement | null;
      
      if (zoomTargetEl && existingNodes.length > 0) {
        const zoomTargetRect = zoomTargetEl.getBoundingClientRect();
        const clickedCenterX = zoomTargetRect.left + zoomTargetRect.width / 2 - containerRect.left;
        const clickedCenterY = zoomTargetRect.top + zoomTargetRect.height / 2 - containerRect.top;
        
        // PHASE 2: Animate zoom target to fullscreen
        zoomTargetEl.classList.add('animate', 'zoom-target');
        zoomTargetEl.style.left = '0px';
        zoomTargetEl.style.top = '0px';
        zoomTargetEl.style.width = width + 'px';
        zoomTargetEl.style.height = height + 'px';
        zoomTargetEl.style.zIndex = '100';
        
        // PHASE 3: Push OTHER nodes away (shrink + slide)
        existingNodes.forEach((el: Element) => {
          const htmlEl = el as HTMLElement;
          if (htmlEl === zoomTargetEl) return;
          
          const elRect = htmlEl.getBoundingClientRect();
          const elCenterX = elRect.left + elRect.width / 2 - containerRect.left;
          const elCenterY = elRect.top + elRect.height / 2 - containerRect.top;
          
          // Direction from clicked node center
          const dx = elCenterX - clickedCenterX;
          const dy = elCenterY - clickedCenterY;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const pushFactor = Math.max(width, height) * 1.5;
          
          // Calculate exit position
          const currentLeft = parseFloat(htmlEl.style.left) || 0;
          const currentTop = parseFloat(htmlEl.style.top) || 0;
          const newLeft = currentLeft + (dx / distance) * pushFactor;
          const newTop = currentTop + (dy / distance) * pushFactor;
          
          // Shrink to 0 while moving away
          htmlEl.classList.add('animate', 'zoom-out');
          htmlEl.style.left = newLeft + 'px';
          htmlEl.style.top = newTop + 'px';
          htmlEl.style.width = '0px';
          htmlEl.style.height = '0px';
        });
        
        // PHASE 4: After animation, remove old nodes and render new tree
        setTimeout(() => {
          existingNodes.forEach(el => el.remove());
          renderNewTree();
        }, durationMs);
        
        return; // Don't render immediately
      }
    }

    // ===== NAVIGATE UP: Animate new nodes flying in =====
    if (animationType === 'navigate-up') {
      const containerRect = container.getBoundingClientRect();
      const centerX = containerRect.width / 2;
      const centerY = containerRect.height / 2;
      
      // Get current fullscreen node before rendering
      const currentFullscreen = container.querySelector('.treemap-node.depth-0') as HTMLElement | null;
      const currentFullscreenKey = currentFullscreen?.getAttribute('data-key');
      
      // Render new tree first (this creates new nodes with 'entering' class)
      renderNewTree();
      
      // Find all newly created depth-0 nodes and animate them in from outside
      container.querySelectorAll('.treemap-node.depth-0').forEach((el: Element) => {
        const htmlEl = el as HTMLElement;
        const nodeKey = htmlEl.getAttribute('data-key');
        
        // Skip the node that was previously fullscreen (it already has correct position)
        if (nodeKey === currentFullscreenKey) return;
        
        // Get the final position
        const finalLeft = parseFloat(htmlEl.style.left) || 0;
        const finalTop = parseFloat(htmlEl.style.top) || 0;
        const nodeWidth = parseFloat(htmlEl.style.width) || 0;
        const nodeHeight = parseFloat(htmlEl.style.height) || 0;
        
        // Calculate center of this node
        const nodeCenterX = finalLeft + nodeWidth / 2;
        const nodeCenterY = finalTop + nodeHeight / 2;
        
        // Direction from container center to this node
        const dx = nodeCenterX - centerX;
        const dy = nodeCenterY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const pushFactor = Math.max(containerRect.width, containerRect.height) * 1.5;
        
        // Start position - far outside the container, size 0
        const startLeft = centerX + (dx / distance) * pushFactor;
        const startTop = centerY + (dy / distance) * pushFactor;
        
        // Set initial position (outside, size 0)
        htmlEl.classList.remove('entering', 'animate');
        htmlEl.style.left = startLeft + 'px';
        htmlEl.style.top = startTop + 'px';
        htmlEl.style.width = '0px';
        htmlEl.style.height = '0px';
        htmlEl.classList.add('zoom-in');
        
        // Animate to final position
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            htmlEl.classList.add('animate');
            htmlEl.style.left = finalLeft + 'px';
            htmlEl.style.top = finalTop + 'px';
            htmlEl.style.width = nodeWidth + 'px';
            htmlEl.style.height = nodeHeight + 'px';
          });
        });
      });
      
      return;
    }

    // ===== STANDARD FILTER: Just render with morphing =====
    // Clear processed flags
    container.querySelectorAll('[data-processed]').forEach(el => {
      el.removeAttribute('data-processed');
    });

    // Render all top-level nodes
    root.children.forEach((node, index) => {
      renderNodeAnimated(node, container, 0, index, 0, 0);
    });

    // Remove unprocessed nodes with fade
    container.querySelectorAll('.treemap-node:not([data-processed])').forEach(el => {
      el.classList.add('exiting');
      setTimeout(() => el.remove(), durationMs);
    });

    // Show hint briefly
    if (!showBackButton) {
      setShowHint(true);
      setTimeout(() => setShowHint(false), 3000);
    }
  }, [data, showTeams, showInitiatives, onDrillDown, showBackButton, isEmpty, lastQuarter, onNodeClick, onInitiativeClick, selectedUnitsCount]);

  // Render on data/size changes with animation type detection
  useEffect(() => {
    if (!isEmpty) {
      // Determine animation type based on what changed
      let animationType: AnimationType = 'filter';
      
      if (isFirstRenderRef.current) {
        // First render - no animation, just immediate
        isFirstRenderRef.current = false;
        animationType = 'resize'; // Fast, like resize
      } else if (prevDataNameRef.current !== data.name) {
        // Data root changed - drill-down or navigate-up
        animationType = canNavigateBack ? 'drilldown' : 'navigate-up';
      }
      
      prevDataNameRef.current = data.name;

      const timeoutId = setTimeout(() => {
        // Pass clickedNodeName for zoom-in animation during drilldown
        renderTreemap(animationType, animationType === 'drilldown' ? clickedNodeName : null);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [renderTreemap, isEmpty, data.name, canNavigateBack, clickedNodeName]);

  // Handle resize with fast animation
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (!isEmpty) {
          renderTreemap('resize');
        }
      }, 100); // Debounce resize
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [renderTreemap, isEmpty]);

  return (
    <div className="treemap-container">
      {/* Up Button - circle with arrow, positioned top-right */}
      <button
        className={`navigate-back-button ${canNavigateBack ? 'visible' : ''}`}
        onClick={onNavigateBack}
        title="Подняться на уровень выше"
      >
        <ArrowUp size={28} strokeWidth={2.5} />
      </button>

      {/* Instruction Hint - React managed */}
      <div className={`instruction-hint ${showHint && !isEmpty ? 'visible' : ''}`}>
        Кликните на блок для детализации
      </div>

      {/* Tooltip - React managed, positioned fixed */}
      <div ref={tooltipRef} className="treemap-tooltip" />

      {/* D3-only container - React will NOT touch children of this div */}
      {!isEmpty && (
        <div 
          ref={d3ContainerRef} 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0 
          }} 
        />
      )}

      {/* Empty state: No initiatives for selected filters */}
      {isEmpty && hasData && (
        <div className="welcome-empty-state">
          <div className="welcome-icon">
            <Search size={60} />
          </div>
          <h1 className="welcome-title">Нет инициатив по выбранным фильтрам</h1>
          <p className="welcome-subtitle">
            Попробуйте изменить параметры фильтрации или сбросить фильтры
          </p>
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

      {/* Empty state: No data loaded - show upload prompt */}
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
          <h1 className="welcome-title">Добро пожаловать в ProductDashboard</h1>
          <p className="welcome-subtitle">
            Загрузите CSV-файл с данными о ваших инициативах, чтобы начать анализ бюджетов, команд и стейкхолдеров
          </p>
          <button className="welcome-upload-btn" onClick={onUploadClick}>
            <Upload size={24} />
            Загрузить CSV файл
          </button>
          <p className="welcome-hint">
            или перетащите файл <code>.csv</code> сюда
          </p>
        </div>
      )}
    </div>
  );
};

export default BudgetTreemap;