import { useAppStore } from '../../stores/appStore';
import SongsView from '../songs/SongsView';
import TimelineVisualizer from '../timeline/TimelineVisualizer';
import StubComponent from '../shared/StubComponent';
import MovesView from '../moves/MovesView';
import DebugView from '../debug/DebugView';

const stubDescriptions: Record<string, { title: string; description: string }> = {
  'song-designer': {
    title: 'Song Designer',
    description: 'design song structure with tracks, parts, and sequences.',
  },
  'part-designer': {
    title: 'Part Designer',
    description: 'build parts from move sequences with timing and intensity.',
  },
  sequences: {
    title: 'Move Sequences',
    description: 'create reusable sequences of combat moves.',
  },
};

function MainPanel() {
  const { activeComponent, selectedSongId } = useAppStore();

  const showTimeline = activeComponent === 'songs' && selectedSongId !== null;

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full">
      {/* Timeline area */}
      {showTimeline && (
        <div
          className="shrink-0"
          style={{
            borderBottom: '1px solid var(--border)',
          }}
        >
          <TimelineVisualizer songId={selectedSongId!} />
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeComponent === 'songs' ? (
          <SongsView />
        ) : activeComponent === 'moves' ? (
          <MovesView />
        ) : activeComponent === 'debug' ? (
          <DebugView />
        ) : (
          <StubComponent
            title={stubDescriptions[activeComponent].title}
            description={stubDescriptions[activeComponent].description}
          />
        )}
      </div>
    </div>
  );
}

export default MainPanel;
