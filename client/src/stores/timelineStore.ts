import { create } from 'zustand';

interface TimelineState {
  duration: number;
  beats: number[];
  pxPerSec: number;
  scrollLeft: number;
  totalWidth: number;
  currentTime: number;
  setSync: (info: Partial<Omit<TimelineState, 'setSync'>>) => void;
}

export const useTimelineStore = create<TimelineState>()((set) => ({
  duration: 0,
  beats: [],
  pxPerSec: 50,
  scrollLeft: 0,
  totalWidth: 0,
  currentTime: 0,
  setSync: (info) => set(info),
}));
