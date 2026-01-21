import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { ChevronLeft, Upload, FileText } from 'lucide-react';
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
}

const BudgetTreemap = ({
  data,
  onDrillDown,
  onNavigateUp,
  showBackButton = false,
  showTeams = false,
  showInitiatives = false,
  onUploadClick
}: BudgetTreemapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(true);

  // ===== TREEMAP RENDERING - EXACTLY FROM HTML PROTOTYPE =====
  const renderTreemap = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clear previous content (except back button and hint)
    Array.from(container.children).forEach(child => {
      const el = child as HTMLElement;
      if (!el.classList.contains('back-button') && !el.classList.contains('instruction-hint') && !el.classList.contains('treemap-tooltip')) {
        container.removeChild(child);
      }
    });

    if (!data.children || data.children.length === 0) {
      return;
    }

    // Determine render depth based on toggle state
    const isInsideUnit = data.isUnit;
    const isInsideTeam = data.isTeam;

    let renderDepth = 1;
    if (data.isRoot || (!isInsideUnit && !isInsideTeam)) {
      if (showTeams && showInitiatives) {
        renderDepth = 3;
      } else if (showTeams) {
        renderDepth = 2;
      } else if (showInitiatives) {
        renderDepth = 2;
      } else {
        renderDepth = 1;
      }
    } else if (data.isUnit || isInsideUnit) {
      if (showTeams && showInitiatives) {
        renderDepth = 2;
      } else if (showTeams) {
        renderDepth = 1;
      } else if (showInitiatives) {
        renderDepth = 2;
      } else {
        renderDepth = 1;
      }
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

    // Function to show tooltip
    const showTooltip = (e: MouseEvent, nodeData: TreeNode, nodeValue: number) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      let html = `<div class="tooltip-header">
        <div class="tooltip-title">${escapeHtml(nodeData.name)}</div>
        ${nodeData.offTrack !== undefined ? `<div class="tooltip-status ${nodeData.offTrack ? 'off-track' : 'on-track'}"></div>` : ''}
      </div>`;

      html += `<div class="tooltip-row"><span class="tooltip-label">Бюджет</span><span class="tooltip-value">${formatBudget(nodeValue)}</span></div>`;

      if (nodeData.description) {
        html += `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid hsl(var(--border)); font-size: 12px; color: hsl(var(--muted-foreground));">${escapeHtml(nodeData.description)}</div>`;
      }

      if (nodeData.stakeholders && nodeData.stakeholders.length > 0) {
        html += `<div class="tooltip-stakeholders">
          <div class="tooltip-stakeholders-label">Стейкхолдеры</div>
          <div class="tooltip-tags">${nodeData.stakeholders.map(s => `<span class="tooltip-tag">${escapeHtml(s)}</span>`).join('')}</div>
        </div>`;
      }

      if (nodeData.children) {
        html += '<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid hsl(var(--border)); font-size: 11px; color: hsl(var(--primary)); font-weight: 500;">Кликните для детализации →</div>';
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

      // Events
      div.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        if (hasChildren && onDrillDown) {
          onDrillDown(node.data);
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
  }, [data, showTeams, showInitiatives, onDrillDown, showBackButton]);

  // Render on data/size changes
  useEffect(() => {
    renderTreemap();

    const handleResize = () => renderTreemap();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderTreemap]);

  // Check if data is empty
  const isEmpty = !data.children || data.children.length === 0;

  return (
    <div ref={containerRef} className="treemap-container">
      {/* Back Button */}
      <button
        className={`back-button ${showBackButton ? 'visible' : ''}`}
        onClick={onNavigateUp}
      >
        <ChevronLeft size={16} />
        Назад
      </button>

      {/* Instruction Hint */}
      <div className={`instruction-hint ${showHint && !isEmpty ? 'visible' : ''}`}>
        Кликните на блок для детализации
      </div>

      {/* Tooltip */}
      <div ref={tooltipRef} className="treemap-tooltip" />

      {/* Empty/Welcome State */}
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
