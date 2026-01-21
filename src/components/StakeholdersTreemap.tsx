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

interface StakeholdersTreemapProps {
  data: TreeNode;
  onNodeClick?: (node: TreeNode) => void;
  onNavigateBack?: () => void;
  canNavigateBack?: boolean;
  selectedQuarters?: string[];
  hasData?: boolean; // true if rawData.length > 0
  onInitiativeClick?: (initiativeName: string) => void;
  onResetFilters?: () => void;
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
  onResetFilters
}: StakeholdersTreemapProps) => {
  const d3ContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(true);

  const isEmpty = !data.children || data.children.length === 0;
  const lastQuarter = selectedQuarters.length > 0 ? selectedQuarters[selectedQuarters.length - 1] : null;

  const renderTreemap = useCallback(() => {
    const container = d3ContainerRef.current;
    if (!container || isEmpty) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    if (!data.children || data.children.length === 0) return;

    // Stakeholders tree: Stakeholder -> Unit -> Team -> Initiative
    // Render depth controls how deep we show
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

    const showTooltip = (e: MouseEvent, nodeData: TreeNode, nodeValue: number) => {
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

      if (nodeData.description) {
        html += `<div class="tooltip-description">${escapeHtml(nodeData.description)}</div>`;
      }

      // Plan/Fact for initiatives - show last quarter with full label
      if (isInitiative && nodeData.quarterlyData && lastQuarter) {
        const qData = nodeData.quarterlyData[lastQuarter];
        if (qData && (qData.metricPlan || qData.metricFact)) {
          const [year, quarter] = lastQuarter.split('-');
          const qLabel = `${quarter} ${year}`;
          html += `<div class="tooltip-metrics">`;
          if (qData.metricPlan) {
            html += `<div class="tooltip-metric"><span class="tooltip-metric-label">План за последний квартал периода (${qLabel})</span><span class="tooltip-metric-value">${escapeHtml(qData.metricPlan)}</span></div>`;
          }
          if (qData.metricFact) {
            html += `<div class="tooltip-metric"><span class="tooltip-metric-label">Факт за последний квартал периода (${qLabel})</span><span class="tooltip-metric-value">${escapeHtml(qData.metricFact)}</span></div>`;
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

      const isLeafNode = !node.data.children || node.data.children.length === 0;
      if (isLeafNode && node.data.offTrack) {
        div.classList.add('off-track');
      }

      // Add visual distinction for Team level (depth 2) vs Initiative level (depth 3)
      if (node.data.isTeam) {
        div.classList.add('is-team');
      }
      if (node.data.isInitiative) {
        div.classList.add('is-initiative');
      }

      // Color by top-level stakeholder
      let stakeholderName = node.data.name;
      let current: d3.HierarchyRectangularNode<TreeNode> | null = node;
      while (current.parent && current.parent.parent) {
        current = current.parent;
        stakeholderName = current.data.name;
      }
      
      const baseColor = getStakeholderColor(stakeholderName);
      if (depth === 0) {
        div.style.backgroundColor = baseColor;
      } else if (depth === 1) {
        div.style.backgroundColor = adjustBrightness(baseColor, -15);
      } else if (depth === 2 && node.data.isTeam) {
        // Teams get a distinct visual treatment - slightly darker with border
        div.style.backgroundColor = adjustBrightness(baseColor, -25);
        div.style.borderLeft = '3px solid ' + adjustBrightness(baseColor, 20);
      } else {
        // Initiatives - darkest
        div.style.backgroundColor = adjustBrightness(baseColor, -35);
      }

      if (depth === 0) {
        div.style.left = node.x0 + 'px';
        div.style.top = node.y0 + 'px';
      } else {
        div.style.left = (node.x0 - (node.parent?.x0 || 0)) + 'px';
        div.style.top = (node.y0 - (node.parent?.y0 || 0)) + 'px';
      }
      div.style.width = nodeWidth + 'px';
      div.style.height = nodeHeight + 'px';

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

      div.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        // If it's an initiative, navigate to Gantt
        if (node.data.isInitiative && onInitiativeClick) {
          onInitiativeClick(node.data.name);
        } else if (onNodeClick) {
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

    setShowHint(true);
    setTimeout(() => setShowHint(false), 3000);
  }, [data, isEmpty, lastQuarter, onNodeClick, onInitiativeClick]);

  useEffect(() => {
    if (!isEmpty) {
      const timeoutId = setTimeout(() => {
        renderTreemap();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [renderTreemap, isEmpty]);

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
