// Treemap tooltip component

import { useLayoutEffect, useRef, useState, memo } from 'react';
import { TreemapLayoutNode } from './types';
import { formatBudget, escapeHtml } from '@/lib/dataManager';

interface TreemapTooltipProps {
  data: {
    node: TreemapLayoutNode;
    position: { x: number; y: number };
  } | null;
  lastQuarter: string | null;
  selectedUnitsCount: number;
  totalValue: number;
}

const TreemapTooltip = memo(({ data, lastQuarter, selectedUnitsCount, totalValue }: TreemapTooltipProps) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  
  // Calculate position when data changes - useLayoutEffect to avoid flicker
  useLayoutEffect(() => {
    if (!tooltipRef.current || !data) {
      setPosition(null);
      return;
    }
    
    const tooltip = tooltipRef.current;
    const padding = 16;
    const rect = tooltip.getBoundingClientRect();
    
    let x = data.position.x + padding;
    let y = data.position.y + padding;
    
    // Flip if overflowing right
    if (x + rect.width > window.innerWidth - padding) {
      x = data.position.x - rect.width - padding;
    }
    if (x < padding) {
      x = padding;
    }
    
    // Flip if overflowing bottom
    if (y + rect.height > window.innerHeight - padding) {
      y = data.position.y - rect.height - padding;
    }
    if (y < padding) {
      y = padding;
    }
    
    setPosition({ x, y });
  }, [data]);
  
  if (!data) {
    return <div ref={tooltipRef} className="treemap-tooltip" />;
  }
  
  const { node } = data;
  const isInitiative = node.isInitiative;
  
  // Find unit value for percentage calculation
  let unitValue = node.value;
  if (node.parentName) {
    // This is a simplified approach - in real usage you'd traverse up the tree
    unitValue = node.value;
  }
  
  // Render tooltip content
  const renderContent = () => {
    let html = `<div class="tooltip-header">
      <div class="tooltip-title">${escapeHtml(node.name)}</div>`;
    
    if (isInitiative && node.offTrack !== undefined) {
      html += `<div class="tooltip-status ${node.offTrack ? 'off-track' : 'on-track'}"></div>`;
    }
    html += `</div>`;
    
    html += `<div class="tooltip-row"><span class="tooltip-label">Бюджет</span><span class="tooltip-value">${formatBudget(node.value)}</span></div>`;
    
    // Percent of unit (skip for top-level units)
    if (node.depth > 0 && unitValue !== node.value) {
      const percentOfUnit = unitValue > 0 ? ((node.value / unitValue) * 100).toFixed(1) : '100.0';
      html += `<div class="tooltip-row"><span class="tooltip-label">% от Юнита</span><span class="tooltip-value">${percentOfUnit}%</span></div>`;
    }
    
    // Percent of total (skip if only one unit selected)
    const showPercentOfTotal = selectedUnitsCount === 0 || selectedUnitsCount > 1;
    if (showPercentOfTotal && totalValue > 0) {
      const percentOfTotal = ((node.value / totalValue) * 100).toFixed(1);
      html += `<div class="tooltip-row"><span class="tooltip-label tooltip-label-group"><span>% от бюджета</span><span class="tooltip-label-sub">выбранного на экране</span></span><span class="tooltip-value">${percentOfTotal}%</span></div>`;
    }
    
    // Quarter metrics for initiatives
    if (isInitiative && node.quarterlyData && lastQuarter) {
      const qData = node.quarterlyData[lastQuarter];
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
    
    // Stakeholders
    if (node.stakeholders && node.stakeholders.length > 0) {
      html += `<div class="tooltip-stakeholders">
        <div class="tooltip-stakeholders-label">Стейкхолдеры</div>
        <div class="tooltip-tags">${node.stakeholders.map(s => `<span class="tooltip-tag">${escapeHtml(s)}</span>`).join('')}</div>
      </div>`;
    }
    
    // Hint
    if (node.data.children && node.data.children.length > 0) {
      html += '<div class="tooltip-hint">Кликните для детализации →</div>';
    } else if (isInitiative) {
      html += '<div class="tooltip-hint">Кликните для перехода в таймлайн →</div>';
    }
    
    return html;
  };
  
  // Style with visibility hidden until position is calculated
  const style: React.CSSProperties = position ? {
    left: position.x,
    top: position.y,
  } : {
    visibility: 'hidden',
  };
  
  return (
    <div 
      ref={tooltipRef} 
      className={`treemap-tooltip ${data && position ? 'visible' : ''}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: renderContent() }}
    />
  );
});

TreemapTooltip.displayName = 'TreemapTooltip';

export default TreemapTooltip;
