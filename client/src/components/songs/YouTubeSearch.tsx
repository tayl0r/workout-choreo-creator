import { useState, type FormEvent } from 'react';
import { searchYouTube, downloadSong } from '../../services/api';
import { pushError } from '../../stores/errorStore';
import type { YouTubeResult } from '../../types';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface YouTubeSearchProps {
  onDownloadComplete: () => void;
}

type DownloadStatus = 'idle' | 'downloading' | 'done' | 'error';

function YouTubeSearch({ onDownloadComplete }: YouTubeSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<YouTubeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [downloadStatuses, setDownloadStatuses] = useState<Record<string, DownloadStatus>>({});

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    try {
      setSearching(true);
      setResults([]);
      setDownloadStatuses({});
      const data = await searchYouTube(trimmed);
      data.sort((a, b) => b.view_count - a.view_count);
      setResults(data);
    } catch (err) {
      pushError('YouTubeSearch', err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleDownload = async (result: YouTubeResult) => {
    setDownloadStatuses((prev) => ({ ...prev, [result.id]: 'downloading' }));

    try {
      await downloadSong(result.url, result.title);
      setDownloadStatuses((prev) => ({ ...prev, [result.id]: 'done' }));
      onDownloadComplete();
    } catch (err) {
      setDownloadStatuses((prev) => ({ ...prev, [result.id]: 'error' }));
      pushError('YouTubeSearch.download', err instanceof Error ? err.message : 'Download failed');
    }
  };

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
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Find Songs
        </h2>
      </div>

      {/* Search form */}
      <form
        onSubmit={handleSearch}
        className="flex gap-2 px-4 py-2 shrink-0"
      >
        <input
          type="text"
          placeholder="Search YouTube..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-3 py-1.5 text-sm rounded outline-none transition-colors duration-150"
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
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="px-4 py-1.5 text-sm font-medium rounded cursor-pointer border-none outline-none transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: 'var(--accent)',
            color: 'var(--bg-primary)',
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.background = 'var(--accent-hover)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--accent)';
          }}
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {searching ? (
          <div className="flex items-center justify-center py-8">
            <div
              className="animate-spin rounded-full h-6 w-6"
              style={{ border: '2px solid var(--border)', borderTopColor: 'var(--accent)' }}
            />
          </div>
        ) : results.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {query.trim() ? 'No results found.' : 'Search for songs on YouTube.'}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {results.map((result) => {
              const status = downloadStatuses[result.id] || 'idle';

              return (
                <div
                  key={result.id}
                  className="flex items-start gap-3 px-4 py-2.5 transition-colors duration-100"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Thumbnail */}
                  <img
                    src={result.thumbnail}
                    alt=""
                    className="rounded shrink-0 object-cover"
                    style={{ width: 80, height: 60 }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-medium leading-snug mb-0.5"
                      style={{
                        color: 'var(--text-primary)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                      title={result.title}
                    >
                      {result.title}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        {result.channel} ({formatCount(result.channel_follower_count)} subs)
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {formatDuration(result.duration)}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {formatCount(result.view_count)} views
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {formatCount(result.like_count)} likes
                      </span>
                    </div>
                  </div>

                  {/* Download button */}
                  <div className="shrink-0 pt-1">
                    {status === 'done' ? (
                      <span
                        className="inline-flex items-center justify-center w-8 h-8 rounded text-sm"
                        style={{ color: 'var(--accent)' }}
                        title="Downloaded"
                      >
                        {'\u2713'}
                      </span>
                    ) : status === 'downloading' ? (
                      <div className="flex items-center justify-center w-8 h-8">
                        <div
                          className="animate-spin rounded-full h-4 w-4"
                          style={{ border: '2px solid var(--border)', borderTopColor: 'var(--accent)' }}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDownload(result)}
                        disabled={false}
                        className="flex items-center justify-center w-8 h-8 rounded cursor-pointer border-none outline-none transition-colors duration-150"
                        style={{
                          background: 'var(--bg-tertiary)',
                          color: 'var(--accent)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--accent)';
                          e.currentTarget.style.color = 'var(--bg-primary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg-tertiary)';
                          e.currentTarget.style.color = 'var(--accent)';
                        }}
                        title="Download"
                      >
                        {'\u2193'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default YouTubeSearch;
