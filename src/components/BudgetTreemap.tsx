import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { ArrowUp, Upload, FileText } from 'lucide-react';
import {
  TreeNode,
  formatBudget,
  escapeHtml,
  getUnitColor,
  adjustBrightness
} from '@/lib/dataManager';
import '@/styles/treemap.css';

interface BudgetTreemapProps {
  data: TreeNode;
  onDrillDown?: (node: TreeNode) => void;
  onNavigateUp?: () => void;
  showBackButton?: boolean;
  showTeams?: boolean;
  showInitiatives?: boolean;
  onUploadClick?: () => void;
  selectedQuarters?: string[];
  onNodeClick?: (node: TreeNode) => void; // For single selection in filter
  onNavigateBack?: () => void; // For the up arrow button - goes back one filter level
  canNavigateBack?: boolean; // Whether the back button should be visible
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
  canNavigateBack = false
}: BudgetTreemapProps) => {
  // Separate ref for D3-only container - React will NOT touch this
  const d3ContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(true);

  // Check if data is empty
  const isEmpty = !data.children || data.children.length === 0;

  // Get last quarter for status display
  const lastQuarter = selectedQuarters.length > 0 ? selectedQuarters[selectedQuarters.length - 1] : null;

  // ===== TREEMAP RENDERING - EXACTLY FROM HTML PROTOTYPE =====
  const renderTreemap = useCallback(() => {
    const container = d3ContainerRef.current;
    if (!container || isEmpty) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clear ALL previous D3 content - do this safely
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    if (!data.children || data.children.length === 0) {
      return;
    }

    // Determine render depth - show all levels in the tree
    // The tree structure is now built correctly based on showTeams/showInitiatives
    // so we just need to render whatever depth exists
    let renderDepth = 3; // Default to show all levels
    
    // If we're at root and showing full tree, show 3 levels
    // If we're inside a unit, show 2 more levels
    // If we're inside a team, show 1 more level
    if (data.isTeam) {
      renderDepth = 1; // Show just initiatives
    } else if (data.isUnit) {
      renderDepth = 2; // Show teams + initiatives (if they exist)
    } else {
      renderDepth = 3; // Show units + teams + initiatives (whatever exists)
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

    // Function to show tooltip - improved version
    const showTooltip = (e: MouseEvent, nodeData: TreeNode, nodeValue: number) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      const isInitiative = nodeData.isInitiative || (!nodeData.isUnit && !nodeData.isTeam && !nodeData.isRoot && !nodeData.children);
      
      let html = `<div class="tooltip-header">
        <div class="tooltip-title">${escapeHtml(nodeData.name)}</div>`;
      
      // Show status only for initiatives
      if (isInitiative && nodeData.offTrack !== undefined) {
        html += `<div class="tooltip-status ${nodeData.offTrack ? 'off-track' : 'on-track'}"></div>`;
      }
      html += `</div>`;

      // Budget
      html += `<div class="tooltip-row"><span class="tooltip-label">Бюджет</span><span class="tooltip-value">${formatBudget(nodeValue)}</span></div>`;

      // For initiatives - show more details
      if (isInitiative && nodeData.quarterlyData && lastQuarter) {
        const qData = nodeData.quarterlyData[lastQuarter];
        if (qData) {
          // Support status
          html += `<div class="tooltip-row"><span class="tooltip-label">Поддержка</span><span class="tooltip-value">${qData.support ? 'Да' : 'Нет'}</span></div>`;
          
          // Off-track status
          html += `<div class="tooltip-row"><span class="tooltip-label">Off-Track</span><span class="tooltip-value ${!qData.onTrack ? 'text-destructive' : ''}">${!qData.onTrack ? 'Да' : 'Нет'}</span></div>`;
        }
      }

      // Description
      if (nodeData.description) {
        html += `<div class="tooltip-description">${escapeHtml(nodeData.description)}</div>`;
      }

      // Plan/Fact for initiatives
      if (isInitiative && nodeData.quarterlyData && lastQuarter) {
        const qData = nodeData.quarterlyData[lastQuarter];
        if (qData && (qData.metricPlan || qData.metricFact)) {
          const qLabel = lastQuarter.replace('-', ' ');
          html += `<div class="tooltip-metrics">`;
          if (qData.metricPlan) {
            html += `<div class="tooltip-metric"><span class="tooltip-metric-label">План ${qLabel}</span><span class="tooltip-metric-value">${escapeHtml(qData.metricPlan)}</span></div>`;
          }
          if (qData.metricFact) {
            html += `<div class="tooltip-metric"><span class="tooltip-metric-label">Факт ${qLabel}</span><span class="tooltip-metric-value">${escapeHtml(qData.metricFact)}</span></div>`;
          }
          html += `</div>`;
        }

        // Comment
        if (qData?.comment) {
          html += `<div class="tooltip-comment"><span class="tooltip-comment-label">Комментарий:</span> ${escapeHtml(qData.comment)}</div>`;
        }
      }

      // Stakeholders
      if (nodeData.stakeholders && nodeData.stakeholders.length > 0) {
        html += `<div class="tooltip-stakeholders">
          <div class="tooltip-stakeholders-label">Стейкхолдеры</div>
          <div class="tooltip-tags">${nodeData.stakeholders.map(s => `<span class="tooltip-tag">${escapeHtml(s)}</span>`).join('')}</div>
        </div>`;
      }

      // Drill-down hint for non-leaf nodes
      if (nodeData.children) {
        html += '<div class="tooltip-hint">Кликните для детализации →</div>';
      }

      tooltip.innerHTML = html;
      tooltip.classList.add('visible');
      moveTooltip(e);
    };

    const moveTooltip = (e: MouseEvent) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      const padding = 16;
      let x = e.clientX + padding;
      let y = e.clientY + padding;

      const rect = tooltip.getBoundingClientRect();
      if (x + rect.width > window.innerWidth - padding) {
        x = e.clientX - rect.width - padding;
      }
      if (y + rect.height > window.innerHeight - padding) {
        y = e.clientY - rect.height - padding;
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

    // Render nodes recursively - EXACTLY as in HTML prototype
    const renderNode = (
      node: d3.HierarchyRectangularNode<TreeNode>,
      parentElement: HTMLElement,
      depth: number,
      colorIndex: number
    ) => {
      const div = document.createElement('div');
      div.className = 'treemap-node depth-' + depth;

      const nodeWidth = node.x1 - node.x0;
      const nodeHeight = node.y1 - node.y0;

      if (nodeWidth < 60 || nodeHeight < 40) {
        div.classList.add('treemap-node-tiny');
      } else if (nodeWidth < 100 || nodeHeight < 60) {
        div.classList.add('treemap-node-small');
      }

      const hasChildren = node.children && node.children.length > 0;
      const shouldRenderChildren = hasChildren && depth < renderDepth;

      if (hasChildren) div.classList.add('has-children');

      // Off-track for leaf nodes only
      const isLeafNode = !node.data.children || node.data.children.length === 0;
      if (isLeafNode && node.data.offTrack) {
        div.classList.add('off-track');
      }

      // Color - find unit name by traversing up
      let unitName = node.data.name;
      let current: d3.HierarchyRectangularNode<TreeNode> | null = node;
      while (current.parent && current.parent.parent) {
        current = current.parent;
        unitName = current.data.name;
      }
      
      const baseColor = getUnitColor(unitName);
      if (depth === 0) {
        div.style.backgroundColor = baseColor;
      } else if (depth === 1) {
        div.style.backgroundColor = adjustBrightness(baseColor, -15);
      } else {
        div.style.backgroundColor = adjustBrightness(baseColor, -30);
      }

      // Position
      if (depth === 0) {
        div.style.left = node.x0 + 'px';
        div.style.top = node.y0 + 'px';
      } else {
        div.style.left = (node.x0 - (node.parent?.x0 || 0)) + 'px';
        div.style.top = (node.y0 - (node.parent?.y0 || 0)) + 'px';
      }
      div.style.width = nodeWidth + 'px';
      div.style.height = nodeHeight + 'px';

      // Content
      if (!shouldRenderChildren || nodeHeight > 50) {
        const content = document.createElement('div');
        content.className = 'treemap-node-content';

        const label = document.createElement('div');
        label.className = 'treemap-node-label';
        label.textContent = node.data.name;
        content.appendChild(label);

        if (!shouldRenderChildren && nodeHeight > 40) {
          const value = document.createElement('div');
          value.className = 'treemap-node-value';
          value.textContent = formatBudget(node.value || 0);
          content.appendChild(value);
        }

        div.appendChild(content);
      }

      // Events - click selects single item in filter
      div.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        if (onNodeClick) {
          onNodeClick(node.data);
        }
      });

      div.addEventListener('mouseenter', (e: MouseEvent) => {
        e.stopPropagation();
        showTooltip(e, node.data, node.value || 0);
      });

      div.addEventListener('mousemove', (e: MouseEvent) => moveTooltip(e));
      div.addEventListener('mouseleave', () => hideTooltip());

      parentElement.appendChild(div);

      if (shouldRenderChildren && node.children) {
        node.children.forEach(child => {
          renderNode(child, div, depth + 1, colorIndex);
        });
      }
    };

    root.children.forEach((node, index) => {
      renderNode(node, container, 0, index);
    });

    // Show hint briefly
    if (!showBackButton) {
      setShowHint(true);
      setTimeout(() => setShowHint(false), 3000);
    }
  }, [data, showTeams, showInitiatives, onDrillDown, showBackButton, isEmpty, lastQuarter]);

  // Render on data/size changes
  useEffect(() => {
    if (!isEmpty) {
      // Small delay to ensure container is properly sized
      const timeoutId = setTimeout(() => {
        renderTreemap();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [renderTreemap, isEmpty]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (!isEmpty) {
        renderTreemap();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

      {/* Empty/Welcome State - React managed, only shown when empty */}
      {isEmpty && (
        <div className="welcome-empty-state">
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
            Поддерживаются файлы <code>.csv</code> с колонками: Unit, Team, Initiative и квартальными данными
          </p>
        </div>
      )}
    </div>
  );
};

export default BudgetTreemap;