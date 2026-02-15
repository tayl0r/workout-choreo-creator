import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchMoves } from '../../services/api';
import { pushError } from '../../stores/errorStore';
import MoveCard, { parseTags } from './MoveCard';

interface CardEntry {
  key: string;
  id: string | null;
  name: string | null;
  raw: string;
}

function extractTags(raw: string): string[] {
  const lines = raw.split('\n');
  if (lines.length < 3) return [];
  return parseTags(lines[2]);
}

function MovesView() {
  const [cards, setCards] = useState<CardEntry[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMoves = useCallback(async () => {
    try {
      setLoading(true);
      const moves = await fetchMoves();
      setCards(
        moves.map((m) => ({
          key: `move-${m.id}`,
          id: m.id,
          name: m.name,
          raw: m.raw,
        }))
      );
    } catch (err) {
      pushError('MovesView', err instanceof Error ? err.message : 'Failed to load moves');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMoves();
  }, [loadMoves]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const card of cards) {
      for (const tag of extractTags(card.raw)) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [cards]);

  const filteredCards = useMemo(() => {
    if (!activeTag) return cards;
    return cards.filter((card) => extractTags(card.raw).includes(activeTag));
  }, [cards, activeTag]);

  const handleSaved = useCallback(
    (oldId: string | null, newEntry: { id: string; name: string; raw: string }) => {
      setCards((prev) =>
        prev.map((c) =>
          c.id === oldId || (oldId === null && c.id === null && c.raw === '')
            ? { ...c, id: newEntry.id, key: `move-${newEntry.id}`, name: newEntry.name, raw: newEntry.raw }
            : c
        )
      );
    },
    []
  );

  const handleDeleted = useCallback(
    (id: string | null) => {
      if (id === null) {
        // Remove unsaved card
        setCards((prev) => {
          const idx = prev.findIndex((c) => c.id === null);
          if (idx === -1) return prev;
          return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        });
      } else {
        setCards((prev) => prev.filter((c) => c.id !== id));
      }
    },
    []
  );

  const handleAddNew = useCallback(() => {
    setCards((prev) => [
      ...prev,
      { key: `new-${Date.now()}`, id: null, name: null, raw: '' },
    ]);
  }, []);

  const gridRef = useRef<HTMLDivElement>(null);

  const handleNavigate = useCallback(
    (cardIndex: number, direction: 'up' | 'down' | 'left' | 'right') => {
      const grid = gridRef.current;
      if (!grid) return;

      const textareas = grid.querySelectorAll('textarea');
      const cols = Math.round(
        grid.clientWidth /
          (textareas[0]?.closest('[class*="relative"]')?.getBoundingClientRect().width ?? grid.clientWidth)
      );

      let targetIndex: number;
      if (direction === 'up') targetIndex = cardIndex - cols;
      else if (direction === 'down') targetIndex = cardIndex + cols;
      else if (direction === 'left') targetIndex = cardIndex - 1;
      else targetIndex = cardIndex + 1;

      if (targetIndex >= 0 && targetIndex < textareas.length) {
        const target = textareas[targetIndex] as HTMLTextAreaElement;
        target.focus();
        // Place cursor at end for down/right, start for up/left
        const pos = direction === 'up' || direction === 'left' ? target.value.length : 0;
        target.setSelectionRange(pos, pos);
      }
    },
    []
  );

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--bg-secondary)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <h2
          className="text-base font-semibold mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Moves
        </h2>

        {/* Tag filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            className="px-2.5 py-1 text-xs rounded-full cursor-pointer border-none outline-none transition-colors duration-150"
            style={{
              background: activeTag === null ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: activeTag === null ? 'var(--bg-primary)' : 'var(--text-secondary)',
            }}
            onClick={() => setActiveTag(null)}
          >
            all
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              className="px-2.5 py-1 text-xs rounded-full cursor-pointer border-none outline-none transition-colors duration-150"
              style={{
                background: activeTag === tag ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: activeTag === tag ? 'var(--bg-primary)' : 'var(--text-secondary)',
              }}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div
              className="animate-spin rounded-full h-6 w-6"
              style={{
                border: '2px solid var(--border)',
                borderTopColor: 'var(--accent)',
              }}
            />
          </div>
        ) : (
          <div
            ref={gridRef}
            className="grid gap-3"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            }}
          >
            {filteredCards.map((card, i) => (
              <MoveCard
                key={card.key}
                initialRaw={card.raw}
                serverId={card.id}
                onSaved={handleSaved}
                onDeleted={handleDeleted}
                onError={(msg) => pushError('MoveCard', msg)}
                onNavigate={(dir) => handleNavigate(i, dir)}
                autoFocus={card.id === null}
              />
            ))}

            {/* Add new button */}
            <button
              className="rounded cursor-pointer outline-none transition-colors duration-150 flex items-center justify-center"
              style={{
                background: 'transparent',
                border: '2px dashed var(--border)',
                color: 'var(--text-secondary)',
                minHeight: '80px',
                fontSize: '24px',
              }}
              onClick={handleAddNew}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.color = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              title="Add new move"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MovesView;
