import { useMemo, useEffect, useRef, useState } from 'react';
import { Upload, FileText, Search, MoreHorizontal } from 'lucide-react';
import {
  RawDataRow,
  calculateBudget,
  calculateTotalBudget,
  getInitiativeQuarters,
  isInitiativeSupport,
  isInitiativeOffTrack,
  formatBudgetShort,
  formatBudget
} from '@/lib/dataManager';
import '@/styles/gantt.css';

interface QuarterPopupData {
  row: RawDataRow;
  quarter: string;
  x: number;
  y: number;
  pinned: boolean;
}

interface GanttViewProps {
  rawData: RawDataRow[];
  selectedQuarters: string[];
  hideSupport: boolean;
  showOnlyOfftrack: boolean;
  selectedUnits: string[];
  selectedTeams: string[];
  selectedStakeholders: string[];
  onUploadClick?: () => void;
  highlightedInitiative?: string | null;
  onResetFilters?: () => void;
}

const GanttView = ({
  rawData,
  selectedQuarters,
  hideSupport,
  showOnlyOfftrack,
  selectedUnits,
  selectedTeams,
  selectedStakeholders,
  onUploadClick,
  highlightedInitiative,
  onResetFilters
}: GanttViewProps) => {
  const highlightedRef = useRef<HTMLDivElement>(null);
  const headerTimelineRef = useRef<HTMLDivElement>(null);
  const rowsContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [quarterPopup, setQuarterPopup] = useState<QuarterPopupData | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const popupRef = useRef<HTMLDivElement>(null);

  // Filter data based on current filters
  const filteredData = useMemo(() => {
    return rawData.filter(row => {
      const budget = calculateBudget(row, selectedQuarters);
      if (budget === 0) return false;

      if (hideSupport && isInitiativeSupport(row, selectedQuarters)) return false;
      if (showOnlyOfftrack && !isInitiativeOffTrack(row, selectedQuarters)) return false;
      if (selectedUnits.length > 0 && !selectedUnits.includes(row.unit)) return false;
      if (selectedTeams.length > 0 && !selectedTeams.includes(row.team)) return false;
      if (selectedStakeholders.length > 0 && !selectedStakeholders.includes(row.stakeholders)) return false;

      return true;
    });
  }, [rawData, selectedQuarters, hideSupport, showOnlyOfftrack, selectedUnits, selectedTeams, selectedStakeholders]);

  // Scroll to highlighted initiative
  useEffect(() => {
    if (highlightedInitiative && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedInitiative, filteredData]);

  // Sync horizontal scroll between header and rows
  useEffect(() => {
    const rowsContainer = rowsContainerRef.current;
    const headerTimeline = headerTimelineRef.current;

    if (!rowsContainer || !headerTimeline) return;

    const handleScroll = () => {
      headerTimeline.scrollLeft = rowsContainer.scrollLeft;
    };

    rowsContainer.addEventListener('scroll', handleScroll);
    return () => rowsContainer.removeEventListener('scroll', handleScroll);
  }, []);

  // Close popup on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quarterPopup?.pinned && popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setQuarterPopup(null);
        setExpandedSections({});
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [quarterPopup]);

  const quarterWidth = 160;

  const handleNameMouseEnter = (e: React.MouseEvent, idx: number) => {
    setHoveredRow(idx);
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };

  const handleNameMouseMove = (e: React.MouseEvent) => {
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };

  const handleNameMouseLeave = () => {
    setHoveredRow(null);
  };

  const handleSegmentMouseEnter = (e: React.MouseEvent, row: RawDataRow, quarter: string) => {
    if (quarterPopup?.pinned) return;
    setQuarterPopup({
      row,
      quarter,
      x: e.clientX,
      y: e.clientY,
      pinned: false
    });
  };

  const handleSegmentMouseMove = (e: React.MouseEvent) => {
    if (quarterPopup?.pinned) return;
    setQuarterPopup(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
  };

  const handleSegmentMouseLeave = () => {
    if (quarterPopup?.pinned) return;
    setQuarterPopup(null);
  };

  const handleSegmentClick = (e: React.MouseEvent, row: RawDataRow, quarter: string) => {
    e.stopPropagation();
    setQuarterPopup({
      row,
      quarter,
      x: e.clientX,
      y: e.clientY,
      pinned: true
    });
    setExpandedSections({});
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Empty state
  if (rawData.length === 0) {
    return (
      <div className="gantt-container">
        <div className="gantt-empty-state">
          <div className="gantt-empty-icon">
            <FileText size={32} />
          </div>
          <div className="gantt-empty-text">Нет данных для отображения</div>
          <button className="gantt-empty-btn" onClick={onUploadClick}>
            <Upload size={16} />
            Загрузить CSV
          </button>
        </div>
      </div>
    );
  }

  // No results after filtering
  if (filteredData.length === 0) {
    return (
      <div className="gantt-container">
        <div className="gantt-header">
          <div className="gantt-timeline-row">
            <div className="gantt-header-label">Инициатива</div>
            <div className="gantt-timeline-header" ref={headerTimelineRef}>
              {selectedQuarters.map(q => (
                <div key={q} className="gantt-quarter" style={{ minWidth: quarterWidth }}>{q.replace('-', ' ')}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="gantt-empty-state">
          <div className="gantt-empty-icon">
            <Search size={32} />
          </div>
          <div className="gantt-empty-text">Нет инициатив по выбранным фильтрам</div>
          {onResetFilters && (
            <button 
              onClick={onResetFilters}
              className="mt-4 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      </div>
    );
  }

  const renderQuarterPopup = () => {
    if (!quarterPopup) return null;

    const { row, quarter, x, y, pinned } = quarterPopup;
    const qData = row.quarterlyData[quarter];
    if (!qData) return null;

    const isSupport = qData.support;
    const isOffTrack = !qData.onTrack;
    const descriptionLong = row.description && row.description.length > 150;
    const planLong = qData.metricPlan && qData.metricPlan.length > 100;
    const factLong = qData.metricFact && qData.metricFact.length > 100;
    const commentLong = qData.comment && qData.comment.length > 100;

    // Position calculation
    const padding = 16;
    let posX = x + padding;
    let posY = y + padding;

    // Adjust for viewport edges
    if (typeof window !== 'undefined') {
      if (posX + 360 > window.innerWidth - padding) {
        posX = x - 360 - padding;
      }
      if (posY + 300 > window.innerHeight - padding) {
        posY = Math.max(padding, window.innerHeight - 400 - padding);
      }
    }

    return (
      <div
        ref={popupRef}
        className={`gantt-quarter-popup ${pinned ? 'pinned' : ''}`}
        style={{
          left: posX,
          top: posY,
          pointerEvents: pinned ? 'auto' : 'none'
        }}
      >
        <div className="gantt-quarter-popup-header">
          <div className="gantt-quarter-popup-title">{row.initiative}</div>
          <div className="gantt-quarter-popup-quarter">{quarter.replace('-', ' ')}</div>
        </div>

        <div className="gantt-quarter-popup-status">
          <span className={`gantt-quarter-popup-badge ${isSupport ? 'support' : 'development'}`}>
            {isSupport ? 'Support' : 'Development'}
          </span>
          {isOffTrack && (
            <span className="gantt-quarter-popup-badge off-track">Off-track</span>
          )}
        </div>

        <div className="gantt-quarter-popup-budget">
          Бюджет: {formatBudget(qData.budget)}
        </div>

        {row.description && (
          <div className="gantt-quarter-popup-section">
            <div 
              className="gantt-quarter-popup-label expandable-header"
              onClick={() => pinned && descriptionLong && toggleSection('description')}
            >
              Описание
              {pinned && descriptionLong && (
                <MoreHorizontal size={12} className="expand-icon" />
              )}
            </div>
            <div 
              className={`gantt-quarter-popup-text ${!expandedSections['description'] && descriptionLong ? 'truncated' : ''}`}
            >
              {expandedSections['description'] || !descriptionLong 
                ? row.description 
                : row.description.slice(0, 150) + '…'}
            </div>
          </div>
        )}

        {qData.metricPlan && (
          <div className="gantt-quarter-popup-section">
            <div 
              className="gantt-quarter-popup-label expandable-header"
              onClick={() => pinned && planLong && toggleSection('plan')}
            >
              План
              {pinned && planLong && (
                <MoreHorizontal size={12} className="expand-icon" />
              )}
            </div>
            <div 
              className={`gantt-quarter-popup-text ${!expandedSections['plan'] && planLong ? 'truncated' : ''}`}
            >
              {expandedSections['plan'] || !planLong 
                ? qData.metricPlan 
                : qData.metricPlan.slice(0, 100) + '…'}
            </div>
          </div>
        )}

        {qData.metricFact && (
          <div className="gantt-quarter-popup-section">
            <div 
              className="gantt-quarter-popup-label expandable-header"
              onClick={() => pinned && factLong && toggleSection('fact')}
            >
              Факт
              {pinned && factLong && (
                <MoreHorizontal size={12} className="expand-icon" />
              )}
            </div>
            <div 
              className={`gantt-quarter-popup-text ${!expandedSections['fact'] && factLong ? 'truncated' : ''}`}
            >
              {expandedSections['fact'] || !factLong 
                ? qData.metricFact 
                : qData.metricFact.slice(0, 100) + '…'}
            </div>
          </div>
        )}

        {qData.comment && (
          <div className="gantt-quarter-popup-section">
            <div 
              className="gantt-quarter-popup-label expandable-header"
              onClick={() => pinned && commentLong && toggleSection('comment')}
            >
              Комментарий
              {pinned && commentLong && (
                <MoreHorizontal size={12} className="expand-icon" />
              )}
            </div>
            <div 
              className={`gantt-quarter-popup-text ${!expandedSections['comment'] && commentLong ? 'truncated' : ''}`}
            >
              {expandedSections['comment'] || !commentLong 
                ? qData.comment 
                : qData.comment.slice(0, 100) + '…'}
            </div>
          </div>
        )}

        {row.stakeholders && (
          <div className="gantt-quarter-popup-section">
            <div className="gantt-quarter-popup-label">Стейкхолдеры</div>
            <div className="gantt-quarter-popup-stakeholders">
              <span className="gantt-quarter-popup-tag">{row.stakeholders}</span>
            </div>
          </div>
        )}

        {!pinned && (
          <div style={{ fontSize: '10px', color: 'hsl(var(--muted-foreground))', marginTop: '8px', textAlign: 'center' }}>
            Кликните для детального просмотра
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="gantt-container">
      {/* Header with quarter columns */}
      <div className="gantt-header">
        <div className="gantt-timeline-row">
          <div className="gantt-header-label">Инициатива</div>
          <div className="gantt-timeline-header" ref={headerTimelineRef}>
            {selectedQuarters.map(q => (
              <div key={q} className="gantt-quarter" style={{ minWidth: quarterWidth }}>{q.replace('-', ' ')}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Rows */}
      <div className="gantt-rows" ref={rowsContainerRef}>
        {filteredData.map((row, idx) => {
          const totalCost = calculateTotalBudget(row);
          const periodCost = calculateBudget(row, selectedQuarters);
          const allQuarters = getInitiativeQuarters(row);
          const showPeriodCost = selectedQuarters.length < allQuarters.length && periodCost !== totalCost;
          const isHighlighted = highlightedInitiative === row.initiative;

          return (
            <div 
              key={idx} 
              ref={isHighlighted ? highlightedRef : null}
              className={`gantt-row ${isHighlighted ? 'highlighted' : ''}`}
            >
              <div className="gantt-row-label">
                <div 
                  className="gantt-row-name"
                  onMouseEnter={(e) => handleNameMouseEnter(e, idx)}
                  onMouseMove={handleNameMouseMove}
                  onMouseLeave={handleNameMouseLeave}
                >
                  {row.initiative}
                </div>
                <div className="gantt-row-team">{row.unit} › {row.team || 'Без команды'}</div>
                <div className="gantt-row-costs">
                  <span className="gantt-cost-total">Всего: {formatBudget(totalCost)}</span>
                  {showPeriodCost && (
                    <span className="gantt-cost-period">За выбранный период: {formatBudget(periodCost)}</span>
                  )}
                </div>
              </div>
              <div className="gantt-row-timeline" style={{ width: selectedQuarters.length * quarterWidth }}>
                {/* Segment bar row */}
                <div className="gantt-segment-row">
                  {selectedQuarters.map((q, qIdx) => {
                    const qData = row.quarterlyData[q];
                    if (!qData || qData.budget === 0) return null;

                    const isSupport = qData.support;
                    const isOffTrack = !qData.onTrack;

                    return (
                      <div
                        key={q}
                        className={`gantt-segment ${isSupport ? 'support' : 'development'} ${isOffTrack ? 'off-track' : ''}`}
                        style={{
                          left: qIdx * quarterWidth + 4,
                          width: quarterWidth - 8
                        }}
                        onMouseEnter={(e) => handleSegmentMouseEnter(e, row, q)}
                        onMouseMove={handleSegmentMouseMove}
                        onMouseLeave={handleSegmentMouseLeave}
                        onClick={(e) => handleSegmentClick(e, row, q)}
                      >
                        {formatBudgetShort(qData.budget)}
                      </div>
                    );
                  })}
                </div>
                
                {/* Quarter details row - shortened */}
                <div className="gantt-quarter-details">
                  {selectedQuarters.map((q) => {
                    const qData = row.quarterlyData[q];
                    if (!qData || qData.budget === 0) {
                      return <div key={q} className="gantt-quarter-detail" style={{ minWidth: quarterWidth }} />;
                    }

                    const hasPlan = qData.metricPlan && qData.metricPlan.trim();
                    const hasFact = qData.metricFact && qData.metricFact.trim();
                    const hasComment = qData.comment && qData.comment.trim();

                    if (!hasPlan && !hasFact && !hasComment) {
                      return <div key={q} className="gantt-quarter-detail" style={{ minWidth: quarterWidth }} />;
                    }

                    return (
                      <div key={q} className="gantt-quarter-detail" style={{ minWidth: quarterWidth }}>
                        <div className="gantt-quarter-detail-content">
                          {hasPlan && (
                            <span className="detail-value" title={qData.metricPlan}>
                              <span className="detail-label">П:</span> {qData.metricPlan?.slice(0, 20)}{qData.metricPlan && qData.metricPlan.length > 20 ? '...' : ''}
                            </span>
                          )}
                          {hasFact && (
                            <span className="detail-value" title={qData.metricFact}>
                              <span className="detail-label">Ф:</span> {qData.metricFact?.slice(0, 20)}{qData.metricFact && qData.metricFact.length > 20 ? '...' : ''}
                            </span>
                          )}
                          {hasComment && (
                            <span className="detail-value" title={qData.comment}>
                              <span className="detail-label">К:</span> {qData.comment?.slice(0, 20)}{qData.comment && qData.comment.length > 20 ? '...' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tooltip for initiative name hover - stakeholders only, no description */}
      {hoveredRow !== null && filteredData[hoveredRow] && (
        <div 
          className="gantt-name-tooltip"
          style={{
            left: Math.min(tooltipPosition.x + 16, window.innerWidth - 420),
            top: tooltipPosition.y + 16
          }}
        >
          <div className="gantt-name-tooltip-title">{filteredData[hoveredRow].initiative}</div>
          {filteredData[hoveredRow].stakeholders && (
            <div className="gantt-name-tooltip-stakeholders">
              <span className="gantt-name-tooltip-tag">{filteredData[hoveredRow].stakeholders}</span>
            </div>
          )}
        </div>
      )}

      {/* Quarter detail popup */}
      {renderQuarterPopup()}

      {/* Legend */}
      <div className="gantt-legend">
        <div className="gantt-legend-item">
          <div className="gantt-legend-color development"></div>
          <span>Development</span>
        </div>
        <div className="gantt-legend-item">
          <div className="gantt-legend-color support"></div>
          <span>Support</span>
        </div>
        <div className="gantt-legend-item">
          <div className="gantt-legend-color hatched"></div>
          <span>Off-track</span>
        </div>
      </div>
    </div>
  );
};

export default GanttView;
