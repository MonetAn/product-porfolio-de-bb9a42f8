import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { ArrowUp, Search, FileText } from 'lucide-react';
import {
  TreeNode,
  formatBudget,
  escapeHtml,
  hashString,
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

interface StakeholdersTreemapProps {
  data: TreeNode;
  onNodeClick?: (node: TreeNode) => void;
  onNavigateBack?: () => void;
  canNavigateBack?: boolean;
  selectedQuarters?: string[];
  hasData?: boolean;
  onInitiativeClick?: (initiativeName: string) => void;
  onResetFilters?: () => void;
  selectedUnitsCount?: number;
  clickedNodeName?: string | null;
}

// Separate color palette for stakeholders
const stakeholderColorPalette = ['#9B7FE8', '#5B8FF9', '#63DAAB', '#FF85C0', '#F6903D', '#7DD3FC', '#FDE047', '#A78BFA'];
const stakeholderColors: Record<string, string> = {};

function getStakeholderColor(name: string): string {
  if (!stakeholderColors[name]) {
    const hash = hashString(name);
    stakeholderColors[name] = stakeholderColorPalette[hash % stakeholderColorPalette.length];
  }
  return stakeholderColors[name];
}

const StakeholdersTreemap = ({
  data,
  onNodeClick,
  onNavigateBack,
  canNavigateBack = false,
  selectedQuarters = [],
  hasData = false,
  onInitiativeClick,
  onResetFilters,
  selectedUnitsCount = 0,
  clickedNodeName = null
}: StakeholdersTreemapProps) => {
  const d3ContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(true);

  // Track previous data root for detecting animation type
  const prevDataNameRef = useRef<string | null>(null);
  const isFirstRenderRef = useRef(true);

  const isEmpty = !data.children || data.children.length === 0;
  const lastQuarter = selectedQuarters.length > 0 ? selectedQuarters[selectedQuarters.length - 1] : null;

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
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      return;
    }

    let renderDepth = 3;

    const root = d3.hierarchy(data)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

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
    const showTooltip = (e: MouseEvent, nodeData: TreeNode, nodeValue: number, stakeholderValue: number) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      const isInitiative = nodeData.isInitiative;
      
      let html = `<div class="tooltip-header">
        <div class="tooltip-title">${escapeHtml(nodeData.name)}</div>`;
      
      if (isInitiative && nodeData.offTrack !== undefined) {
        html += `<div class="tooltip-status ${nodeData.offTrack ? 'off-track' : 'on-track'}"></div>`;
      }
      html += `</div>`;

      html += `<div class="tooltip-row"><span class="tooltip-label">Бюджет</span><span class="tooltip-value">${formatBudget(nodeValue)}</span></div>`;

      if (nodeValue !== stakeholderValue) {
        const percentOfStakeholder = stakeholderValue > 0 ? ((nodeValue / stakeholderValue) * 100).toFixed(1) : '100.0';
        html += `<div class="tooltip-row"><span class="tooltip-label">% от Стейкхолдера</span><span class="tooltip-value">${percentOfStakeholder}%</span></div>`;
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
        html += '<div class="tooltip-hint">Кликните для перехода в Timeline →</div>';
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
      const parts: string[] = [];
      let current: d3.HierarchyRectangularNode<TreeNode> | null = node;
      while (current && current.data.name) {
        parts.unshift(current.data.name);
        current = current.parent;
      }
      return `d${depth}-${parts.join('/')}`;
    };

    // ===== HELPER: Find stakeholder name for color =====
    const getStakeholderName = (node: d3.HierarchyRectangularNode<TreeNode>): string => {
      let stakeholderName = node.data.name;
      let current: d3.HierarchyRectangularNode<TreeNode> | null = node;
      while (current.parent && current.parent.parent) {
        current = current.parent;
        stakeholderName = current.data.name;
      }
      return stakeholderName;
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

      const left = depth === 0 ? node.x0 : (node.x0 - parentX0);
      const top = depth === 0 ? node.y0 : (node.y0 - parentY0);

      let div = parentElement.querySelector(`[data-key="${nodeKey}"]`) as HTMLElement | null;
      const isNew = !div;

      if (!div) {
        div = document.createElement('div');
        div.setAttribute('data-key', nodeKey);
        div.className = 'treemap-node depth-' + depth;
        div.classList.add('entering');

        // Color by stakeholder
        const stakeholderName = getStakeholderName(node);
        const baseColor = getStakeholderColor(stakeholderName);
        if (depth === 0) {
          div.style.backgroundColor = baseColor;
        } else if (depth === 1) {
          div.style.backgroundColor = adjustBrightness(baseColor, -15);
        } else if (depth === 2 && node.data.isTeam) {
          div.style.backgroundColor = adjustBrightness(baseColor, -25);
          div.style.borderLeft = '3px solid ' + adjustBrightness(baseColor, 20);
        } else {
          div.style.backgroundColor = adjustBrightness(baseColor, -35);
        }

        div.style.left = left + 'px';
        div.style.top = top + 'px';
        div.style.width = nodeWidth + 'px';
        div.style.height = nodeHeight + 'px';

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
          let stakeholderNode: d3.HierarchyRectangularNode<TreeNode> = node;
          while (stakeholderNode.parent && stakeholderNode.depth > 1) {
            stakeholderNode = stakeholderNode.parent;
          }
          const stakeholderValue = stakeholderNode.value || node.value || 0;
          showTooltip(e, node.data, node.value || 0, stakeholderValue);
        });

        div.addEventListener('mousemove', (e: MouseEvent) => moveTooltip(e));
        div.addEventListener('mouseleave', () => hideTooltip());

        parentElement.appendChild(div);

        requestAnimationFrame(() => {
          if (div) {
            div.classList.add('animate');
            div.classList.remove('entering');
          }
        });
      } else {
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
      div.classList.toggle('is-team', !!node.data.isTeam);
      div.classList.toggle('is-initiative', !!node.data.isInitiative);

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
        
        let label = content.querySelector('.treemap-node-label') as HTMLElement | null;
        if (!label) {
          label = document.createElement('div');
          label.className = 'treemap-node-label';
          content.appendChild(label);
        }
        label.textContent = node.data.name;

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

      div.setAttribute('data-processed', 'true');

      if (shouldRenderChildren && node.children) {
        node.children.forEach(child => {
          renderNodeAnimated(child, div!, depth + 1, colorIndex, node.x0, node.y0);
        });
      }

      return div;
    };

    // Clear processed flags
    container.querySelectorAll('[data-processed]').forEach(el => {
      el.removeAttribute('data-processed');
    });

    // Render all top-level nodes
    root.children.forEach((node, index) => {
      renderNodeAnimated(node, container, 0, index, 0, 0);
    });

    // EXIT: Remove nodes that weren't processed
    // For drilldown with zoom target, use zoom animation instead of simple fade
    const unprocessedNodes = container.querySelectorAll('.treemap-node:not([data-processed])');
    
    if (animationType === 'drilldown' && zoomTargetName) {
      // Find the zoom target node (the one that was clicked)
      const zoomTargetEl = Array.from(unprocessedNodes).find(
        el => el.getAttribute('data-key')?.includes(zoomTargetName)
      ) as HTMLElement | null;
      
      if (zoomTargetEl) {
        // Get container dimensions for calculating push directions
        const containerRect = container.getBoundingClientRect();
        const zoomTargetRect = zoomTargetEl.getBoundingClientRect();
        
        // Center of the clicked node (relative to container)
        const clickedCenterX = zoomTargetRect.left + zoomTargetRect.width / 2 - containerRect.left;
        const clickedCenterY = zoomTargetRect.top + zoomTargetRect.height / 2 - containerRect.top;
        
        // Animate zoom target to fullscreen
        zoomTargetEl.classList.add('animate', 'zoom-target');
        zoomTargetEl.style.left = '0px';
        zoomTargetEl.style.top = '0px';
        zoomTargetEl.style.width = width + 'px';
        zoomTargetEl.style.height = height + 'px';
        
        // Push other top-level nodes away from the clicked node
        unprocessedNodes.forEach((el: Element) => {
          const htmlEl = el as HTMLElement;
          if (htmlEl === zoomTargetEl) return;
          
          // Only animate depth-0 nodes (top level)
          if (!htmlEl.classList.contains('depth-0')) {
            htmlEl.classList.add('exiting', 'animate');
            setTimeout(() => htmlEl.remove(), durationMs);
            return;
          }
          
          const elRect = htmlEl.getBoundingClientRect();
          const elCenterX = elRect.left + elRect.width / 2 - containerRect.left;
          const elCenterY = elRect.top + elRect.height / 2 - containerRect.top;
          
          // Direction vector from clicked node to this node
          const dx = elCenterX - clickedCenterX;
          const dy = elCenterY - clickedCenterY;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          // Push factor - push nodes beyond the container edge
          const pushFactor = Math.max(width, height);
          
          // Calculate new position (pushed away)
          const currentLeft = parseFloat(htmlEl.style.left) || 0;
          const currentTop = parseFloat(htmlEl.style.top) || 0;
          const newLeft = currentLeft + (dx / distance) * pushFactor;
          const newTop = currentTop + (dy / distance) * pushFactor;
          
          htmlEl.classList.add('animate', 'zoom-out');
          htmlEl.style.left = newLeft + 'px';
          htmlEl.style.top = newTop + 'px';
        });
        
        // Remove all after animation
        setTimeout(() => {
          unprocessedNodes.forEach(el => el.remove());
        }, durationMs);
      } else {
        // Fallback to simple fade-out if target not found
        unprocessedNodes.forEach(el => {
          el.classList.add('exiting', 'animate');
          setTimeout(() => el.remove(), durationMs);
        });
      }
    } else {
      // Standard fade-out for non-drilldown animations
      unprocessedNodes.forEach(el => {
        el.classList.add('exiting', 'animate');
        setTimeout(() => el.remove(), durationMs);
      });
    }

    setShowHint(true);
    setTimeout(() => setShowHint(false), 3000);
  }, [data, isEmpty, lastQuarter, onNodeClick, onInitiativeClick, selectedUnitsCount]);

  // Render on data/size changes with animation type detection
  useEffect(() => {
    if (!isEmpty) {
      let animationType: AnimationType = 'filter';
      
      if (isFirstRenderRef.current) {
        isFirstRenderRef.current = false;
        animationType = 'resize';
      } else if (prevDataNameRef.current !== data.name) {
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
      }, 100);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [renderTreemap, isEmpty]);

  return (
    <div className="treemap-container">
      <button
        className={`navigate-back-button ${canNavigateBack ? 'visible' : ''}`}
        onClick={onNavigateBack}
        title="Подняться на уровень выше"
      >
        <ArrowUp size={28} strokeWidth={2.5} />
      </button>

      <div className={`instruction-hint ${showHint && !isEmpty ? 'visible' : ''}`}>
        Кликните на блок для детализации
      </div>

      <div ref={tooltipRef} className="treemap-tooltip" />

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

      {/* Empty state - depends on whether data exists at all */}
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

      {isEmpty && !hasData && (
        <div className="welcome-empty-state">
          <div className="welcome-icon">
            <FileText size={60} />
          </div>
          <h1 className="welcome-title">Нет данных для отображения</h1>
          <p className="welcome-subtitle">
            Загрузите CSV-файл с данными для просмотра группировки по стейкхолдерам
          </p>
        </div>
      )}
    </div>
  );
};

export default StakeholdersTreemap;
