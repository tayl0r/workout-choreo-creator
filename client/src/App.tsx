import { useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import MainPanel from './components/layout/MainPanel';
import ErrorConsole from './components/layout/ErrorConsole';

function App() {
  // Global spacebar play/pause handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs, textareas, or contenteditable elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        const playPause = (window as unknown as Record<string, unknown>).__choreoPlayPause;
        if (typeof playPause === 'function') {
          playPause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <MainPanel />
      </div>
      <ErrorConsole />
    </div>
  );
}

export default App;
