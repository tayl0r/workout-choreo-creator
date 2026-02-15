/**
 * Format seconds as m:ss (e.g. 3:07).
 * Used across timeline, song library, and song designer components.
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
