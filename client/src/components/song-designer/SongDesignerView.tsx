import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useTimelineStore } from '../../stores/timelineStore';
import { fetchParts, createPart, updatePart, deletePart } from '../../services/api';
import { pushError } from '../../stores/errorStore';
import PartsTrack from './PartsTrack';
import type { PartEntry } from './PartPill';
import type { SongPart } from '../../types';

let tempIdCounter = 0;

export default function SongDesignerView() {
  const { selectedSongId } = useAppStore();
  const { beats, currentTime } = useTimelineStore();
  const [parts, setParts] = useState<PartEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Load parts when song changes
  useEffect(() => {
    if (!selectedSongId) {
      setParts([]);
      return;
    }
    setLoading(true);
    fetchParts(selectedSongId)
      .then((serverParts) => {
        setParts(serverParts.map((p) => ({ part: p, isSaved: true })));
      })
      .catch((err) => {
        pushError('SongDesigner', `Failed to load parts: ${err.message}`);
        setParts([]);
      })
      .finally(() => setLoading(false));
  }, [selectedSongId]);

  const handleAddPart = useCallback(() => {
    if (!selectedSongId) return;

    const DEFAULT_DURATION = 60;

    // Start after the last existing part, or at 0:00
    const sorted = [...parts].sort((a, b) => a.part.startTime - b.part.startTime);
    let startTime = sorted.length > 0 ? sorted[sorted.length - 1].part.endTime : 0;

    // Snap start to nearest beat
    if (beats.length > 0) {
      let closest = beats[0];
      for (const b of beats) {
        if (Math.abs(b - startTime) < Math.abs(closest - startTime)) closest = b;
      }
      startTime = closest;
    }

    let endTime = startTime + DEFAULT_DURATION;

    // Snap end to nearest beat
    if (beats.length > 0) {
      let closest = beats[0];
      for (const b of beats) {
        if (Math.abs(b - endTime) < Math.abs(closest - endTime)) closest = b;
      }
      endTime = closest;
    }

    const tempId = `_temp_${++tempIdCounter}`;
    const newPart: SongPart = {
      id: tempId,
      name: '',
      startTime,
      endTime,
      stance: 'Centered',
    };

    setParts((prev) => [...prev, { part: newPart, isSaved: false }]);
  }, [selectedSongId, currentTime, beats, parts]);

  const handleUpdate = useCallback(
    (id: string, changes: Partial<SongPart>) => {
      if (!selectedSongId) return;

      setParts((prev) =>
        prev.map((entry) => {
          if (entry.part.id !== id) return entry;
          const updated = { ...entry.part, ...changes };
          return { ...entry, part: updated };
        }),
      );

      // If it's a saved part, persist to backend
      const entry = parts.find((e) => e.part.id === id);
      if (entry?.isSaved) {
        updatePart(selectedSongId, id, changes).catch((err) => {
          pushError('SongDesigner', `Failed to update part: ${err.message}`);
        });
      }
    },
    [selectedSongId, parts],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (!selectedSongId) return;
      const entry = parts.find((e) => e.part.id === id);

      setParts((prev) => prev.filter((e) => e.part.id !== id));

      if (entry?.isSaved) {
        deletePart(selectedSongId, id).catch((err) => {
          pushError('SongDesigner', `Failed to delete part: ${err.message}`);
        });
      }
    },
    [selectedSongId, parts],
  );

  const handleNameSelect = useCallback(
    (id: string, name: string, cloneFrom?: SongPart) => {
      if (!selectedSongId) return;

      const entry = parts.find((e) => e.part.id === id);
      if (!entry) return;

      const updatedPart = { ...entry.part, name };
      if (cloneFrom) {
        // Clone the stance from the source part
        updatedPart.stance = cloneFrom.stance;
      }

      if (!entry.isSaved) {
        // First save — POST to backend
        createPart(selectedSongId, {
          name: updatedPart.name,
          startTime: updatedPart.startTime,
          endTime: updatedPart.endTime,
          stance: updatedPart.stance,
        })
          .then((serverPart) => {
            setParts((prev) =>
              prev.map((e) =>
                e.part.id === id ? { part: serverPart, isSaved: true } : e,
              ),
            );
          })
          .catch((err) => {
            pushError('SongDesigner', `Failed to save part: ${err.message}`);
          });
      } else {
        // Update existing
        setParts((prev) =>
          prev.map((e) => (e.part.id === id ? { ...e, part: updatedPart } : e)),
        );
        updatePart(selectedSongId, id, { name, stance: updatedPart.stance }).catch((err) => {
          pushError('SongDesigner', `Failed to update part: ${err.message}`);
        });
      }
    },
    [selectedSongId, parts],
  );

  if (!selectedSongId) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-secondary)' }}>
        <div className="text-center">
          <div className="text-lg mb-2">No song selected</div>
          <div className="text-sm">
            Select a song from the{' '}
            <button
              className="underline cursor-pointer border-none bg-transparent outline-none"
              style={{ color: 'var(--accent)' }}
              onClick={() => useAppStore.getState().setActiveComponent('songs')}
            >
              Songs
            </button>
            {' '}view to start designing parts.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            Song Parts
          </span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {parts.filter((p) => p.isSaved).length} part{parts.filter((p) => p.isSaved).length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={handleAddPart}
          className="flex items-center gap-1 px-3 py-1.5 rounded text-sm cursor-pointer border-none outline-none"
          style={{
            background: 'var(--accent)',
            color: 'var(--bg-primary)',
            fontWeight: 600,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
          title="Add part at playhead position"
        >
          + Add Part
        </button>
      </div>

      {/* Parts track */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading parts...</span>
          </div>
        ) : (
          <PartsTrack
            parts={parts}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onNameSelect={handleNameSelect}
          />
        )}
      </div>

      {/* Legend */}
      <div
        className="flex items-center gap-4 px-4 py-1.5 shrink-0 text-[10px] font-mono uppercase"
        style={{
          borderTop: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          background: 'var(--bg-secondary)',
        }}
      >
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#0070cc' }} />
          Right
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#cc6600' }} />
          Left
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm" style={{ background: '#00886a' }} />
          Centered
        </span>
        <span className="ml-auto" style={{ opacity: 0.6 }}>
          drag handles to resize &middot; click name to rename &middot; click stance badge to cycle
        </span>
      </div>
    </div>
  );
}
