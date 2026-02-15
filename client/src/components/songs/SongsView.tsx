import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import SongLibrary from './SongLibrary';
import YouTubeSearch from './YouTubeSearch';
import { useState, useCallback } from 'react';

function SongsView() {
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);

  const refreshLibrary = useCallback(() => {
    setLibraryRefreshKey((k) => k + 1);
  }, []);

  return (
    <PanelGroup direction="horizontal" className="h-full">
      <Panel defaultSize={50} minSize={30}>
        <SongLibrary refreshKey={libraryRefreshKey} />
      </Panel>

      <PanelResizeHandle
        className="flex items-center justify-center transition-colors duration-150"
        style={{
          width: 6,
          background: 'var(--bg-primary)',
          cursor: 'col-resize',
        }}
      >
        <div
          className="rounded-full"
          style={{
            width: 2,
            height: 40,
            background: 'var(--border)',
          }}
        />
      </PanelResizeHandle>

      <Panel defaultSize={50} minSize={30}>
        <YouTubeSearch onDownloadComplete={refreshLibrary} />
      </Panel>
    </PanelGroup>
  );
}

export default SongsView;
