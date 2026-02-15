import type { Song, YouTubeResult, MoveEntry, SongPart } from '../types';

const API_BASE = '/api';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.text();
    let message: string;
    try {
      const parsed = JSON.parse(errorBody);
      message = parsed.error || parsed.message || response.statusText;
    } catch {
      message = errorBody || response.statusText;
    }
    throw new Error(message);
  }
  return response.json();
}

export async function fetchSongs(): Promise<Song[]> {
  const response = await fetch(`${API_BASE}/songs`);
  return handleResponse<Song[]>(response);
}

export async function fetchSong(id: number): Promise<Song> {
  const response = await fetch(`${API_BASE}/songs/${id}`);
  return handleResponse<Song>(response);
}

export async function updateSong(id: number, data: { name: string }): Promise<Song> {
  const response = await fetch(`${API_BASE}/songs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<Song>(response);
}

export async function deleteSong(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/songs/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || response.statusText);
  }
}

export function getSongAudioUrl(id: number): string {
  return `${API_BASE}/songs/${id}/audio`;
}

export async function searchYouTube(query: string): Promise<YouTubeResult[]> {
  const response = await fetch(`${API_BASE}/youtube/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return handleResponse<YouTubeResult[]>(response);
}

export async function downloadSong(url: string, title: string): Promise<Song> {
  const response = await fetch(`${API_BASE}/youtube/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, title }),
  });
  return handleResponse<Song>(response);
}

export async function fetchMoves(tag?: string): Promise<MoveEntry[]> {
  const params = tag ? `?tag=${encodeURIComponent(tag)}` : '';
  const response = await fetch(`${API_BASE}/moves${params}`);
  return handleResponse<MoveEntry[]>(response);
}

export async function createMove(raw: string): Promise<MoveEntry> {
  const response = await fetch(`${API_BASE}/moves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  return handleResponse<MoveEntry>(response);
}

export async function updateMove(id: string, raw: string): Promise<MoveEntry> {
  const response = await fetch(`${API_BASE}/moves/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });
  return handleResponse<MoveEntry>(response);
}

export async function suggestMoveDescription(name: string, hint?: string): Promise<{ description: string }> {
  const response = await fetch(`${API_BASE}/moves/suggest-description`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, hint }),
  });
  return handleResponse<{ description: string }>(response);
}

export async function deleteMove(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/moves/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || response.statusText);
  }
}

// ----- Parts API -----

export async function fetchParts(songId: number): Promise<SongPart[]> {
  const response = await fetch(`${API_BASE}/songs/${songId}/parts`);
  return handleResponse<SongPart[]>(response);
}

export async function createPart(
  songId: number,
  data: { name: string; startTime: number; endTime: number; stance: string },
): Promise<SongPart> {
  const response = await fetch(`${API_BASE}/songs/${songId}/parts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<SongPart>(response);
}

export async function updatePart(
  songId: number,
  partId: string,
  data: Partial<{ name: string; startTime: number; endTime: number; stance: string }>,
): Promise<SongPart> {
  const response = await fetch(`${API_BASE}/songs/${songId}/parts/${encodeURIComponent(partId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return handleResponse<SongPart>(response);
}

export async function deletePart(songId: number, partId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/songs/${songId}/parts/${encodeURIComponent(partId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || response.statusText);
  }
}
