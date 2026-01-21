import { useMemo, useEffect, useRef, useState } from 'react';
import { Upload, FileText, Search } from 'lucide-react';
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
  highlightedInitiative
}: GanttViewProps) => {
  const highlightedRef = useRef<HTMLDivElement>(null);
  const headerTimelineRef = useRef<HTMLDivElement>(null);
  const rowsContainerRef = useRef<HTMLDivElement>(null);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

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
        </div>
      </div>
    );
  }

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
                        title={`${row.initiative}\n${q.replace('-', ' ')}\nБюджет: ${formatBudget(qData.budget)}\nСтатус: ${isSupport ? 'Support' : 'Development'}${isOffTrack ? ' (Off-track)' : ''}`}
                      >
                        {formatBudgetShort(qData.budget)}
                      </div>
                    );
                  })}
                </div>
                
                {/* Quarter details row */}
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
                              <span className="detail-label">П:</span> {qData.metricPlan}
                            </span>
                          )}
                          {hasFact && (
                            <span className="detail-value" title={qData.metricFact}>
                              <span className="detail-label">Ф:</span> {qData.metricFact}
                            </span>
                          )}
                          {hasComment && (
                            <span className="detail-value" title={qData.comment}>
                              <span className="detail-label">К:</span> {qData.comment}
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

      {/* Tooltip for initiative name hover */}
      {hoveredRow !== null && filteredData[hoveredRow] && (
        <div 
          className="gantt-name-tooltip"
          style={{
            left: Math.min(tooltipPosition.x + 16, window.innerWidth - 320),
            top: tooltipPosition.y + 16
          }}
        >
          <div className="gantt-name-tooltip-title">{filteredData[hoveredRow].initiative}</div>
          {filteredData[hoveredRow].description && (
            <div className="gantt-name-tooltip-description">{filteredData[hoveredRow].description}</div>
          )}
          {filteredData[hoveredRow].stakeholders && (
            <div className="gantt-name-tooltip-stakeholders">
              <span className="gantt-name-tooltip-tag">{filteredData[hoveredRow].stakeholders}</span>
            </div>
          )}
        </div>
      )}

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
