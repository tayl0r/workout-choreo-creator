import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchSongs, updateSong, deleteSong } from '../../services/api';
import { useAppStore } from '../../stores/appStore';
import { pushError } from '../../stores/errorStore';
import type { Song } from '../../types';
import { formatTime as formatDuration } from '../../utils/formatTime';

interface SongLibraryProps {
  refreshKey: number;
}

function SongLibrary({ refreshKey }: SongLibraryProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { selectedSongId, setSelectedSongId } = useAppStore();
  const editInputRef = useRef<HTMLInputElement>(null);

  const loadSongs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSongs();
      setSongs(data);
    } catch (err) {
      pushError('SongLibrary', err instanceof Error ? err.message : 'Failed to load songs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSongs();
  }, [loadSongs, refreshKey]);

  useEffect(() => {
    if (editingId !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const filteredSongs = songs.filter((song) =>
    song.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleRename = async (song: Song) => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === song.name) {
      setEditingId(null);
      return;
    }
    try {
      await updateSong(song.id, { name: trimmed });
      setSongs((prev) =>
        prev.map((s) => (s.id === song.id ? { ...s, name: trimmed } : s))
      );
    } catch (err) {
      pushError('SongLibrary', err instanceof Error ? err.message : 'Failed to rename');
    }
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteSong(id);
      setSongs((prev) => prev.filter((s) => s.id !== id));
      if (selectedSongId === id) {
        setSelectedSongId(null);
      }
    } catch (err) {
      pushError('SongLibrary', err instanceof Error ? err.message : 'Failed to delete');
    }
    setDeletingId(null);
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--bg-secondary)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Library
          </h2>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
            }}
          >
            {songs.length}
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 shrink-0">
        <input
          type="text"
          placeholder="Filter songs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 text-sm rounded outline-none transition-colors duration-150"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
          }}
        />
      </div>

      {/* Song list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div
              className="animate-spin rounded-full h-6 w-6"
              style={{ border: '2px solid var(--border)', borderTopColor: 'var(--accent)' }}
            />
          </div>
        ) : filteredSongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {songs.length === 0
                ? 'No songs yet. Search YouTube to add songs.'
                : 'No songs match your filter.'}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filteredSongs.map((song) => {
              const isSelected = selectedSongId === song.id;
              const isEditing = editingId === song.id;
              const isDeleting = deletingId === song.id;

              return (
                <div key={song.id}>
                  <div
                    className="flex items-center px-4 py-2 cursor-pointer transition-colors duration-100 group"
                    style={{
                      background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                      borderLeft: isSelected
                        ? '3px solid var(--accent)'
                        : '3px solid transparent',
                    }}
                    onClick={() => {
                      if (!isEditing && !isDeleting) {
                        setSelectedSongId(song.id);
                      }
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'var(--bg-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {/* Song info */}
                    <div className="flex-1 min-w-0 mr-2">
                      {isEditing ? (
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(song);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onBlur={() => handleRename(song)}
                          className="w-full px-2 py-0.5 text-sm rounded outline-none"
                          style={{
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--accent)',
                          }}
                        />
                      ) : (
                        <div
                          className="text-sm font-medium truncate"
                          style={{ color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}
                        >
                          {song.name}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {formatDuration(song.duration)}
                        </span>
                        {song.bpm && (
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {song.bpm} BPM
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(song.id);
                          setEditName(song.name);
                        }}
                        className="p-1 rounded cursor-pointer border-none outline-none text-xs transition-colors duration-100"
                        style={{
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--text-primary)';
                          e.currentTarget.style.background = 'var(--bg-tertiary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-secondary)';
                          e.currentTarget.style.background = 'transparent';
                        }}
                        title="Rename"
                      >
                        {'\u270E'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(song.id);
                        }}
                        className="p-1 rounded cursor-pointer border-none outline-none text-xs transition-colors duration-100"
                        style={{
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--danger)';
                          e.currentTarget.style.background = 'var(--bg-tertiary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-secondary)';
                          e.currentTarget.style.background = 'transparent';
                        }}
                        title="Delete"
                      >
                        {'\u2715'}
                      </button>
                    </div>
                  </div>

                  {/* Delete confirmation */}
                  {isDeleting && (
                    <div
                      className="flex items-center gap-2 px-4 py-2 text-xs"
                      style={{
                        background: 'rgba(255, 68, 102, 0.08)',
                        borderLeft: '3px solid var(--danger)',
                      }}
                    >
                      <span style={{ color: 'var(--danger)' }}>Delete this song?</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(song.id);
                        }}
                        className="px-2 py-0.5 rounded cursor-pointer border-none outline-none text-xs font-medium"
                        style={{
                          background: 'var(--danger)',
                          color: '#fff',
                        }}
                      >
                        Yes
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(null);
                        }}
                        className="px-2 py-0.5 rounded cursor-pointer border-none outline-none text-xs font-medium"
                        style={{
                          background: 'var(--bg-tertiary)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        No
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SongLibrary;
