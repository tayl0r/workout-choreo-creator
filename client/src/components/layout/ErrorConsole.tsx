import { useErrorStore } from '../../stores/errorStore';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function ErrorConsole() {
  const { errors, isOpen, dismissError, clearErrors, toggleOpen } = useErrorStore();

  if (errors.length === 0) return null;

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none"
        style={{ background: 'var(--bg-tertiary)' }}
        onClick={toggleOpen}
      >
        <span
          className="text-xs"
          style={{ color: 'var(--text-secondary)' }}
        >
          {isOpen ? '\u25BC' : '\u25B6'}
        </span>
        <span
          className="text-xs font-semibold"
          style={{ color: 'var(--danger)' }}
        >
          Errors
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded-full font-medium"
          style={{
            background: 'var(--danger)',
            color: '#fff',
            fontSize: '10px',
            lineHeight: '1',
          }}
        >
          {errors.length}
        </span>
        <div className="flex-1" />
        <button
          className="text-xs px-2 py-0.5 rounded cursor-pointer border-none outline-none transition-colors duration-150"
          style={{
            background: 'transparent',
            color: 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.background = 'var(--bg-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.background = 'transparent';
          }}
          onClick={(e) => {
            e.stopPropagation();
            clearErrors();
          }}
        >
          Clear all
        </button>
      </div>

      {/* Error list */}
      {isOpen && (
        <div
          className="overflow-y-auto"
          style={{ maxHeight: '200px' }}
        >
          {errors.map((err) => (
            <div
              key={err.id}
              className="flex items-start gap-2 px-3 py-1.5 text-xs"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span
                className="shrink-0"
                style={{ color: 'var(--text-secondary)' }}
              >
                {formatTime(err.timestamp)}
              </span>
              <span
                className="shrink-0 px-1.5 py-0.5 rounded font-medium"
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--accent)',
                  fontSize: '10px',
                }}
              >
                {err.source}
              </span>
              <span
                className="flex-1 min-w-0 break-words"
                style={{ color: 'var(--text-primary)' }}
              >
                {err.message}
              </span>
              <button
                className="shrink-0 px-1 rounded cursor-pointer border-none outline-none transition-colors duration-150"
                style={{
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
                onClick={() => {
                  navigator.clipboard.writeText(
                    `[${formatTime(err.timestamp)}] [${err.source}] ${err.message}`
                  );
                }}
                title="Copy"
              >
                {'\u2398'}
              </button>
              <button
                className="shrink-0 px-1 rounded cursor-pointer border-none outline-none transition-colors duration-150"
                style={{
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--danger)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
                onClick={() => dismissError(err.id)}
                title="Dismiss"
              >
                {'\u2715'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ErrorConsole;
