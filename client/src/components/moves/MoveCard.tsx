import { useState, useRef, useEffect, useCallback } from 'react';

/** Parse tags from a line, stripping brackets and splitting on commas/whitespace. */
export function parseTags(line: string): string[] {
  return line.replace(/[\[\]]/g, '').split(/[,\s]+/).map(t => t.trim()).filter(Boolean);
}

/** Wrap bare/comma-separated tags in brackets for display. */
function tagsToDisplay(raw: string): string {
  const lines = raw.split('\n');
  if (lines[2] === undefined) return raw;
  const tags = parseTags(lines[2]);
  if (tags.length === 0) return raw;
  lines[2] = tags.map(t => `[${t}]`).join(' ');
  return lines.join('\n');
}

/** Strip bracket wrappers from the tags line before saving. */
function tagsToStorage(raw: string): string {
  const lines = raw.split('\n');
  if (lines[2] === undefined) return raw;
  lines[2] = parseTags(lines[2]).join(', ');
  return lines.join('\n');
}

type NavigateDirection = 'up' | 'down' | 'left' | 'right';

interface MoveCardProps {
  initialRaw: string;
  serverId: string | null;
  onSaved: (oldId: string | null, newEntry: { id: string; name: string; raw: string }) => void;
  onDeleted: (id: string | null) => void;
  onError: (msg: string) => void;
  onNavigate?: (direction: NavigateDirection) => void;
  autoFocus?: boolean;
}

function MoveCard({
  initialRaw,
  serverId,
  onSaved,
  onDeleted,
  onError,
  onNavigate,
  autoFocus = false,
}: MoveCardProps) {
  const [raw, setRaw] = useState(() => tagsToDisplay(initialRaw));
  const [lastSavedRaw, setLastSavedRaw] = useState(() => tagsToDisplay(initialRaw));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [suggesting, setSuggesting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(serverId);
  const isSavingRef = useRef(false);
  const doSaveRef = useRef<(text: string) => void>(() => {});

  // Keep idRef in sync with serverId prop
  useEffect(() => {
    idRef.current = serverId;
  }, [serverId]);

  // Auto-height adjustment
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [raw, adjustHeight]);

  // Auto-focus for new cards
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const doSave = useCallback(async (text: string) => {
    if (isSavingRef.current) return;

    // Strip the leading "#" and all whitespace — if nothing remains, treat as empty
    const stripped = text.replace(/#/g, '').trim();

    // Empty / only "#": delete
    if (!stripped) {
      if (idRef.current) {
        try {
          isSavingRef.current = true;
          const { deleteMove } = await import('../../services/api');
          await deleteMove(idRef.current);
          onDeleted(idRef.current);
        } catch (err) {
          onError(err instanceof Error ? err.message : 'Failed to delete move');
        } finally {
          isSavingRef.current = false;
        }
      } else {
        onDeleted(null);
      }
      return;
    }

    // Validate: name must not be empty
    const nameMatch = text.match(/^#\s*(.*)/);
    const name = nameMatch ? nameMatch[1].trim() : '';
    if (!name) {
      onError('Move must have a name');
      return;
    }

    setStatus('saving');

    try {
      isSavingRef.current = true;
      let result: { id: string; name: string; raw: string };

      const textForServer = tagsToStorage(text);
      if (idRef.current === null) {
        const { createMove } = await import('../../services/api');
        result = await createMove(textForServer);
      } else {
        const { updateMove } = await import('../../services/api');
        result = await updateMove(idRef.current, textForServer);
      }

      const oldId = idRef.current;
      idRef.current = result.id;
      setLastSavedRaw(text);
      setStatus('saved');

      // Clear any existing status fade timer
      if (statusFadeRef.current) clearTimeout(statusFadeRef.current);
      statusFadeRef.current = setTimeout(() => setStatus('idle'), 1500);

      onSaved(oldId, result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save move';
      setStatus('idle');
      onError(msg);
    } finally {
      isSavingRef.current = false;
    }
  }, [onSaved, onDeleted, onError]);

  // Keep ref in sync so debounce/timeout closures always call the latest doSave
  doSaveRef.current = doSave;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      let value = e.target.value;
      const cursorPos = e.target.selectionStart;

      // Auto-wrap bare tags in brackets when space is typed on the tags line
      const lines = value.split('\n');
      if (lines.length >= 3) {
        const tagsLineStart = lines[0].length + 1 + lines[1].length + 1;
        const tagsLineEnd = tagsLineStart + lines[2].length;
        const onTagsLine = cursorPos >= tagsLineStart && cursorPos <= tagsLineEnd;

        if (onTagsLine && value[cursorPos - 1] === ' ') {
          const tags = parseTags(lines[2]);
          if (tags.length > 0) {
            lines[2] = tags.map(t => `[${t}]`).join(' ') + ' ';
            value = lines.join('\n');
            const newCursorPos = tagsLineStart + lines[2].length;
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.selectionStart = newCursorPos;
                textareaRef.current.selectionEnd = newCursorPos;
              }
            }, 0);
          }
        }
      }

      setRaw(value);

      // Reset debounce timer
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        doSaveRef.current(value);
      }, 3000);
    },
    [lastSavedRaw]
  );

  const handleBlur = useCallback(() => {
    // Clear debounce since we're saving now
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const stripped = raw.replace(/#/g, '').trim();
    // Save if changed, or delete if empty (even if unchanged — handles blank new cards)
    if (raw !== lastSavedRaw || (!stripped && idRef.current === null)) {
      doSave(raw);
    }
  }, [raw, lastSavedRaw, doSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!onNavigate) return;
      const el = e.currentTarget;
      const { selectionStart, value } = el;

      if (e.key === 'ArrowUp') {
        const firstNewline = value.indexOf('\n');
        const onFirstLine = firstNewline === -1 || selectionStart <= firstNewline;
        if (onFirstLine) {
          e.preventDefault();
          onNavigate('up');
        }
      } else if (e.key === 'ArrowDown') {
        const lastNewline = value.lastIndexOf('\n');
        const onLastLine = lastNewline === -1 || selectionStart > lastNewline;
        if (onLastLine) {
          e.preventDefault();
          onNavigate('down');
        }
      } else if (e.key === 'ArrowLeft') {
        if (selectionStart === 0) {
          e.preventDefault();
          onNavigate('left');
        }
      } else if (e.key === 'ArrowRight') {
        if (selectionStart === value.length) {
          e.preventDefault();
          onNavigate('right');
        }
      }
    },
    [onNavigate]
  );

  // Determine if suggest button should show
  const lines = raw.split('\n');
  const firstLine = lines[0]?.trim() ?? '';
  const moveName = firstLine.startsWith('#') ? firstLine.slice(1).trim() : '';
  const secondLine = lines[1]?.trim() ?? '';
  const hasHint = secondLine.startsWith('*');
  const showSuggest = moveName.length > 0 && (secondLine.length === 0 || hasHint);

  const handleSuggest = useCallback(async () => {
    const lines = raw.split('\n');
    const firstLine = lines[0]?.trim() ?? '';
    const name = firstLine.startsWith('#') ? firstLine.slice(1).trim() : '';
    if (!name) return;

    // Extract hint from line 2 if it starts with *
    const secondLine = lines[1]?.trim() ?? '';
    const hint = secondLine.startsWith('*') ? secondLine.slice(1).trim() : undefined;
    // Lines after the hint (or after line 1 if no hint)
    const restLines = hint ? lines.slice(2) : lines.slice(1);

    setSuggesting(true);
    try {
      const { suggestMoveDescription } = await import('../../services/api');
      const { description } = await suggestMoveDescription(name, hint);
      const cleanDesc = description.replace(/\n{2,}/g, '\n').trim();
      const nonBlank = restLines.filter(l => l.trim().length > 0);
      const newLines = [lines[0], cleanDesc, ...nonBlank];
      const newRaw = newLines.join('\n');
      setRaw(newRaw);
      // Trigger a save via debounce
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        doSaveRef.current(newRaw);
      }, 1000);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to suggest description');
    } finally {
      setSuggesting(false);
    }
  }, [raw]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (statusFadeRef.current) clearTimeout(statusFadeRef.current);
    };
  }, []);

  return (
    <div
      className="relative rounded"
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Status indicator */}
      {status !== 'idle' && (
        <div
          className="absolute top-1.5 right-2 text-xs font-medium"
          style={{
            color: status === 'saved' ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          {status === 'saving' ? 'saving...' : 'saved'}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={raw}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        className="w-full p-3 text-sm rounded outline-none"
        style={{
          background: 'transparent',
          color: 'var(--text-primary)',
          fontFamily: 'monospace',
          resize: 'none',
          overflow: 'hidden',
          border: 'none',
          minHeight: '60px',
        }}
      />

      {/* Suggest description button */}
      {showSuggest && (
        <div className="px-3 pb-2">
          <button
            onClick={handleSuggest}
            disabled={suggesting}
            className="text-xs px-2 py-0.5 rounded cursor-pointer"
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              opacity: suggesting ? 0.6 : 1,
            }}
          >
            {suggesting ? 'suggesting...' : '✦ suggest'}
          </button>
        </div>
      )}

    </div>
  );
}

export default MoveCard;
