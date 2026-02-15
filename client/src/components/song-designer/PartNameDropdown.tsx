import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { SongPart } from '../../types';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface PartNameDropdownProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  existingParts: SongPart[];
  currentName: string;
  onSelect: (name: string, cloneFrom?: SongPart) => void;
  onClose: () => void;
}

export default function PartNameDropdown({ anchorRef, existingParts, currentName, onSelect, onClose }: PartNameDropdownProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Position relative to anchor element
  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 2, left: rect.left });
    }
  }, [anchorRef]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const uniqueNames = [...new Set(existingParts.map((p) => p.name))].filter(Boolean);

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-50 rounded shadow-lg overflow-hidden"
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        minWidth: 200,
        top: pos.top,
        left: pos.left,
      }}
    >
      {/* Create new option */}
      {creating ? (
        <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) {
                onSelect(newName.trim());
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="Part name..."
            className="w-full px-2 py-1 rounded text-sm outline-none"
            style={{
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--accent)',
            }}
          />
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="w-full text-left px-3 py-2 text-sm cursor-pointer border-none outline-none"
          style={{
            background: 'transparent',
            color: 'var(--accent)',
            borderBottom: '1px solid var(--border)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          + Create new
        </button>
      )}

      {/* Existing part names */}
      {uniqueNames.length > 0 && (
        <div className="max-h-48 overflow-y-auto">
          {uniqueNames.map((name) => {
            const example = existingParts.find((p) => p.name === name)!;
            return (
              <button
                key={name}
                onClick={() => onSelect(name, example)}
                className="w-full text-left px-3 py-2 text-sm cursor-pointer border-none outline-none flex justify-between items-center gap-2"
                style={{ background: 'transparent', color: 'var(--text-primary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span>{name}</span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {formatTime(example.startTime)}&ndash;{formatTime(example.endTime)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>,
    document.body,
  );
}
