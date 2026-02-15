import { useAppStore } from '../../stores/appStore';
import type { ActiveComponent } from '../../types';

interface NavItem {
  id: ActiveComponent;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { id: 'songs', label: 'Songs', icon: '\u266B' },
  { id: 'song-designer', label: 'Song Designer', icon: '\u25A7' },
  { id: 'part-designer', label: 'Part Designer', icon: '\u2637' },
  { id: 'sequences', label: 'Move Sequences', icon: '\u2630' },
  { id: 'moves', label: 'Moves', icon: '\u26A1' },
  { id: 'debug', label: 'Debug', icon: '\u2699' },
];

function Sidebar() {
  const { sidebarOpen, toggleSidebar, activeComponent, setActiveComponent } = useAppStore();

  return (
    <div
      className="flex flex-col h-full shrink-0 transition-all duration-300 ease-in-out"
      style={{
        width: sidebarOpen ? 220 : 48,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center h-12 px-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {sidebarOpen ? (
          <span
            className="text-sm font-bold tracking-wide truncate select-none"
            style={{ color: 'var(--accent)' }}
          >
            Choreo Creator
          </span>
        ) : (
          <span
            className="text-lg font-bold select-none mx-auto"
            style={{ color: 'var(--accent)' }}
            title="Choreo Creator"
          >
            CC
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeComponent === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveComponent(item.id)}
              className="flex items-center w-full px-3 py-2.5 text-left transition-colors duration-150 cursor-pointer border-none outline-none"
              style={{
                background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
              title={item.label}
            >
              <span className="text-lg leading-none shrink-0" style={{ width: 20, textAlign: 'center' }}>
                {item.icon}
              </span>
              {sidebarOpen && (
                <span className="ml-3 text-sm font-medium truncate">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-10 shrink-0 cursor-pointer border-none outline-none transition-colors duration-150"
        style={{
          background: 'transparent',
          color: 'var(--text-secondary)',
          borderTop: '1px solid var(--border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--bg-hover)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <span
          className="text-sm transition-transform duration-300"
          style={{ transform: sidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}
        >
          {'\u25C0'}
        </span>
      </button>
    </div>
  );
}

export default Sidebar;
