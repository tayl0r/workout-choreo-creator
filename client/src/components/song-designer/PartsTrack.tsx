import { useRef, useEffect } from 'react';
import { useTimelineStore } from '../../stores/timelineStore';
import PartPill from './PartPill';
import type { PartEntry } from './PartPill';
import type { SongPart } from '../../types';

interface PartsTrackProps {
  parts: PartEntry[];
  onUpdate: (id: string, changes: Partial<SongPart>) => void;
  onDelete: (id: string) => void;
  onNameSelect: (id: string, name: string, cloneFrom?: SongPart) => void;
}

export default function PartsTrack({ parts, onUpdate, onDelete, onNameSelect }: PartsTrackProps) {
  const { pxPerSec, scrollLeft, totalWidth, beats } = useTimelineStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync scroll position from timeline store
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollLeft;
    }
  }, [scrollLeft]);

  const sorted = [...parts].sort((a, b) => a.part.startTime - b.part.startTime);
  const rowHeight = 36;
  const trackHeight = Math.max(rowHeight, sorted.length * rowHeight) + 4;

  return (
    <div
      className="overflow-x-hidden overflow-y-auto"
      ref={scrollRef}
      style={{
        maxHeight: 200,
        scrollbarWidth: 'none',
      }}
      onScroll={(e) => {
        // If user scrolls the parts track directly, don't fight with the sync
        // (In practice, the timeline scroll drives this via the store)
      }}
    >
      <div
        className="relative"
        style={{
          width: totalWidth || '100%',
          height: trackHeight,
          minHeight: rowHeight,
        }}
      >
        {sorted.map((entry, i) => (
          <div
            key={entry.part.id}
            className="absolute w-full"
            style={{ top: i * rowHeight, height: rowHeight }}
          >
            <PartPill
              entry={entry}
              pxPerSec={pxPerSec}
              beats={beats}
              allParts={parts}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onNameSelect={onNameSelect}
            />
          </div>
        ))}

        {sorted.length === 0 && (
          <div
            className="absolute inset-0 flex items-center justify-center text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            Click + to add a part
          </div>
        )}
      </div>
    </div>
  );
}
