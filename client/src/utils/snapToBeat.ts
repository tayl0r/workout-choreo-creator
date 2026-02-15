/**
 * Binary search for the nearest beat to a given time.
 * Returns the original time if the beats array is empty.
 */
export function snapToBeat(time: number, beats: number[]): number {
  if (beats.length === 0) return time;

  let lo = 0;
  let hi = beats.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid] < time) lo = mid + 1;
    else hi = mid;
  }

  if (lo > 0 && Math.abs(beats[lo - 1] - time) < Math.abs(beats[lo] - time)) {
    return beats[lo - 1];
  }
  return beats[lo];
}
