import { Search, Upload, Keyboard, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export type ViewType = 'budget' | 'stakeholders' | 'timeline';

interface HeaderProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onSearchClick: () => void;
  onUploadClick: () => void;
  onShortcutsClick: () => void;
}

const Header = ({
  currentView,
  onViewChange,
  onSearchClick,
  onUploadClick,
  onShortcutsClick
}: HeaderProps) => {
  const navigate = useNavigate();
  return (
    <header className="h-14 bg-card border-b border-border flex items-center px-6 fixed top-0 left-0 right-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center text-primary-foreground text-sm font-bold">
          P
        </div>
        <span>ProductDashboard</span>
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 ml-12">
        <button
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all relative ${
            currentView === 'budget'
              ? 'text-foreground'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
          onClick={() => onViewChange('budget')}
        >
          Budget <kbd className="text-xs text-muted-foreground ml-1">1</kbd>
          {currentView === 'budget' && (
            <span className="absolute -bottom-[9px] left-4 right-4 h-0.5 bg-primary rounded-sm" />
          )}
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all relative ${
            currentView === 'stakeholders'
              ? 'text-foreground'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
          onClick={() => onViewChange('stakeholders')}
        >
          Stakeholders <kbd className="text-xs text-muted-foreground ml-1">2</kbd>
          {currentView === 'stakeholders' && (
            <span className="absolute -bottom-[9px] left-4 right-4 h-0.5 bg-primary rounded-sm" />
          )}
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all relative ${
            currentView === 'timeline'
              ? 'text-foreground'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
          onClick={() => onViewChange('timeline')}
        >
          Timeline <kbd className="text-xs text-muted-foreground ml-1">3</kbd>
          {currentView === 'timeline' && (
            <span className="absolute -bottom-[9px] left-4 right-4 h-0.5 bg-primary rounded-sm" />
          )}
        </button>
      </nav>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onSearchClick}
          className="flex items-center gap-2 px-3 py-1.5 bg-secondary border border-border rounded-lg text-muted-foreground text-sm hover:border-muted-foreground transition-colors"
        >
          <Search size={16} />
          <span>Поиск...</span>
          <kbd className="text-xs px-1.5 py-0.5 bg-card border border-border rounded">/</kbd>
        </button>

        <button
          onClick={onUploadClick}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          title="Загрузить CSV"
        >
          <Upload size={20} />
        </button>

        <button
          onClick={onShortcutsClick}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          title="Горячие клавиши"
        >
          <Keyboard size={20} />
        </button>

        <button
          onClick={() => navigate('/admin')}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          title="Админка"
        >
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
};

export default Header;
