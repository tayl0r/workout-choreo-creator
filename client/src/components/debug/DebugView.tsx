import { pushError } from '../../stores/errorStore';

const errorButtons = [
  {
    label: 'Network Error',
    action: () => pushError('DebugView', 'Failed to fetch: NetworkError when attempting to fetch resource'),
  },
  {
    label: 'Song Load Failed',
    action: () => pushError('SongLibrary', 'Failed to load songs'),
  },
  {
    label: 'Download Timeout',
    action: () => pushError('YouTubeSearch.download', 'Download timed out after 120s'),
  },
  {
    label: 'Beat Detection Error',
    action: () => pushError('YouTubeSearch.download', 'beat_detect.py exited with code 1: ValueError: Audio file is too short for analysis'),
  },
  {
    label: 'Move Save Failed',
    action: () => pushError('MoveCard', 'Failed to save move: SQLITE_CONSTRAINT: UNIQUE constraint failed: moves.name'),
  },
  {
    label: 'Server Unreachable',
    action: () => pushError('API', 'ECONNREFUSED: Could not connect to localhost:3001'),
  },
  {
    label: '5 Rapid Errors',
    action: () => {
      for (let i = 1; i <= 5; i++) {
        pushError('DebugView', `Rapid error #${i}`);
      }
    },
  },
];

function DebugView() {
  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--bg-secondary)' }}
    >
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Debug
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Error Console Testing
          </h3>
          <div className="flex flex-wrap gap-2">
            {errorButtons.map((btn) => (
              <button
                key={btn.label}
                onClick={btn.action}
                className="px-3 py-1.5 text-sm rounded cursor-pointer border-none outline-none transition-colors duration-150"
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DebugView;
