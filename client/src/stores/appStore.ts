import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ActiveComponent } from '../types';

const VALID_COMPONENTS: ActiveComponent[] = [
  'songs', 'song-designer', 'part-designer', 'sequences', 'moves', 'debug',
];

function parseHash(): { component: ActiveComponent; songId: number | null } {
  const hash = window.location.hash.slice(1); // remove #
  const parts = hash.split('/').filter(Boolean);
  const component = VALID_COMPONENTS.includes(parts[0] as ActiveComponent)
    ? (parts[0] as ActiveComponent)
    : 'songs';
  const songId = parts[1] ? parseInt(parts[1], 10) || null : null;
  return { component, songId };
}

function updateHash(component: ActiveComponent, songId: number | null) {
  const hash = songId ? `#${component}/${songId}` : `#${component}`;
  if (window.location.hash !== hash) {
    history.replaceState(null, '', hash);
  }
}

interface AppState {
  activeComponent: ActiveComponent;
  setActiveComponent: (c: ActiveComponent) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  selectedSongId: number | null;
  setSelectedSongId: (id: number | null) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;
}

const initial = parseHash();

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeComponent: initial.component,
      setActiveComponent: (c) =>
        set((state) => {
          const keepSongId = c === 'songs' || c === 'song-designer';
          updateHash(c, keepSongId ? state.selectedSongId : null);
          return { activeComponent: c };
        }),
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      selectedSongId: initial.songId,
      setSelectedSongId: (id) =>
        set((state) => {
          updateHash(state.activeComponent, id);
          return { selectedSongId: id };
        }),
      isPlaying: false,
      setIsPlaying: (p) => set({ isPlaying: p }),
    }),
    {
      name: 'choreo-creator-app',
      partialize: (state) => ({ sidebarOpen: state.sidebarOpen }),
    }
  )
);
