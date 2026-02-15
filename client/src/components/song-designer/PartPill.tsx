import { useState, useRef, useCallback } from 'react';
import type { SongPart, Stance } from '../../types';
import PartNameDropdown from './PartNameDropdown';

const STANCE_COLORS: Record<Stance, { bg: string; border: string; text: string }> = {
  Right: { bg: 'rgba(0, 160, 255, 0.15)', border: '#0070cc', text: '#66bbff' },
  Left: { bg: 'rgba(255, 120, 0, 0.15)', border: '#cc6600', text: '#ffaa55' },
  Centered: { bg: 'rgba(0, 212, 170, 0.15)', border: '#00886a', text: '#00d4aa' },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
}

/** Binary search for the nearest beat to a given time. */
function snapToBeat(time: number, beats: number[]): number {
  if (beats.length === 0) return time;
  let lo = 0;
  let hi = beats.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid] < time) lo = mid + 1;
    else hi = mid;
  }
  // Compare lo and lo-1 to find nearest
  if (lo > 0 && Math.abs(beats[lo - 1] - time) < Math.abs(beats[lo] - time)) {
    return beats[lo - 1];
  }
  return beats[lo];
}

export interface PartEntry {
  part: SongPart;
  isSaved: boolean;
}

interface PartPillProps {
  entry: PartEntry;
  pxPerSec: number;
  beats: number[];
  allParts: PartEntry[];
  onUpdate: (id: string, changes: Partial<SongPart>) => void;
  onDelete: (id: string) => void;
  onNameSelect: (id: string, name: string, cloneFrom?: SongPart) => void;
}

export default function PartPill({
  entry,
  pxPerSec,
  beats,
  allParts,
  onUpdate,
  onDelete,
  onNameSelect,
}: PartPillProps) {
  const { part, isSaved } = entry;
  const [showDropdown, setShowDropdown] = useState(false);
  const nameRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'left' | 'right' | 'move' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, startTime: 0, endTime: 0 });
  const [localTimes, setLocalTimes] = useState<{ startTime: number; endTime: number } | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  const colors = STANCE_COLORS[part.stance];
  const startTime = localTimes?.startTime ?? part.startTime;
  const endTime = localTimes?.endTime ?? part.endTime;

  const left = startTime * pxPerSec;
  const width = (endTime - startTime) * pxPerSec;

  // Find adjacent parts for clamping
  const sorted = [...allParts].sort((a, b) => a.part.startTime - b.part.startTime);
  const myIndex = sorted.findIndex((e) => e.part.id === part.id);
  const prevEnd = myIndex > 0 ? sorted[myIndex - 1].part.endTime : 0;
  const nextStart = myIndex < sorted.length - 1 ? sorted[myIndex + 1].part.startTime : Infinity;

  const handleMouseDown = useCallback(
    (type: 'left' | 'right' | 'move', e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(type);
      setDragStart({ x: e.clientX, startTime: part.startTime, endTime: part.endTime });
      setLocalTimes({ startTime: part.startTime, endTime: part.endTime });

      const onMouseMove = (me: MouseEvent) => {
        const dx = me.clientX - e.clientX;
        const dt = dx / pxPerSec;
        const duration = part.endTime - part.startTime;
        const MIN_DURATION = 0.5;

        if (type === 'left') {
          let newStart = part.startTime + dt;
          newStart = Math.max(newStart, prevEnd);
          newStart = Math.min(newStart, part.endTime - MIN_DURATION);
          setLocalTimes({ startTime: newStart, endTime: part.endTime });
        } else if (type === 'right') {
          let newEnd = part.endTime + dt;
          newEnd = Math.min(newEnd, nextStart);
          newEnd = Math.max(newEnd, part.startTime + MIN_DURATION);
          setLocalTimes({ startTime: part.startTime, endTime: newEnd });
        } else {
          let newStart = part.startTime + dt;
          let newEnd = part.endTime + dt;
          // Clamp to boundaries
          if (newStart < prevEnd) {
            newStart = prevEnd;
            newEnd = prevEnd + duration;
          }
          if (newEnd > nextStart) {
            newEnd = nextStart;
            newStart = nextStart - duration;
          }
          newStart = Math.max(0, newStart);
          setLocalTimes({ startTime: newStart, endTime: newEnd });
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        setDragging(null);

        setLocalTimes((current) => {
          if (!current) return null;
          const snappedStart = snapToBeat(current.startTime, beats);
          const snappedEnd = snapToBeat(current.endTime, beats);
          // Ensure snap doesn't cause overlap or invalid range
          const finalStart = type === 'move' || type === 'left'
            ? Math.max(snappedStart, prevEnd)
            : current.startTime;
          const finalEnd = type === 'move' || type === 'right'
            ? Math.min(snappedEnd, nextStart)
            : current.endTime;

          if (finalEnd - finalStart >= 0.5) {
            onUpdate(part.id, { startTime: finalStart, endTime: finalEnd });
          } else {
            onUpdate(part.id, { startTime: current.startTime, endTime: current.endTime });
          }
          return null;
        });
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [part, pxPerSec, beats, prevEnd, nextStart, onUpdate],
  );

  const stanceOptions: Stance[] = ['Centered', 'Right', 'Left'];

  return (
    <div
      ref={pillRef}
      className="absolute flex items-center group"
      style={{
        left,
        width: Math.max(width, 20),
        height: 32,
        top: 2,
        background: colors.bg,
        border: `1px ${isSaved ? 'solid' : 'dashed'} ${colors.border}`,
        borderRadius: 6,
        cursor: dragging === 'move' ? 'grabbing' : 'grab',
        userSelect: 'none',
        transition: dragging ? 'none' : 'left 0.1s, width 0.1s',
      }}
      onMouseDown={(e) => handleMouseDown('move', e)}
    >
      {/* Left drag handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 opacity-0 group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, ${colors.border} 0%, transparent 100%)`,
          borderRadius: '6px 0 0 6px',
          transition: 'opacity 0.15s',
        }}
        onMouseDown={(e) => handleMouseDown('left', e)}
      />

      {/* Content */}
      <div className="flex items-center gap-1.5 px-3 overflow-hidden flex-1 min-w-0 relative">
        {/* Stance badge */}
        <button
          className="shrink-0 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded cursor-pointer border-none outline-none"
          style={{
            background: colors.border,
            color: '#fff',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const currentIdx = stanceOptions.indexOf(part.stance);
            const nextStance = stanceOptions[(currentIdx + 1) % stanceOptions.length];
            onUpdate(part.id, { stance: nextStance });
          }}
          title={`Stance: ${part.stance} (click to cycle)`}
        >
          {part.stance[0]}
        </button>

        {/* Name */}
        <div
          ref={nameRef}
          className="truncate text-xs font-medium cursor-pointer"
          style={{ color: colors.text }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setShowDropdown(!showDropdown);
          }}
        >
          {part.name || (
            <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              name...
            </span>
          )}
        </div>
        {showDropdown && (
          <PartNameDropdown
            anchorRef={nameRef}
            existingParts={allParts.filter((e) => e.isSaved).map((e) => e.part)}
            currentName={part.name}
            onSelect={(name, cloneFrom) => {
              setShowDropdown(false);
              onNameSelect(part.id, name, cloneFrom);
            }}
            onClose={() => setShowDropdown(false)}
          />
        )}

        {/* Time range */}
        {width > 120 && (
          <span className="shrink-0 text-[10px] font-mono ml-auto" style={{ color: 'var(--text-secondary)' }}>
            {formatTime(startTime)}&ndash;{formatTime(endTime)}
          </span>
        )}

        {/* Delete button */}
        <button
          className="shrink-0 opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded cursor-pointer border-none outline-none text-xs"
          style={{
            background: 'transparent',
            color: 'var(--danger)',
            transition: 'opacity 0.15s',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(part.id);
          }}
          title="Delete part"
        >
          ×
        </button>
      </div>

      {/* Right drag handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10 opacity-0 group-hover:opacity-100"
        style={{
          background: `linear-gradient(270deg, ${colors.border} 0%, transparent 100%)`,
          borderRadius: '0 6px 6px 0',
          transition: 'opacity 0.15s',
        }}
        onMouseDown={(e) => handleMouseDown('right', e)}
      />
    </div>
  );
}
