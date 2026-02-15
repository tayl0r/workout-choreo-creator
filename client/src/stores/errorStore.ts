import { create } from 'zustand';

export interface ErrorEntry {
  id: string;
  message: string;
  source: string;
  timestamp: number;
}

interface ErrorState {
  errors: ErrorEntry[];
  isOpen: boolean;
  pushError: (source: string, message: string) => void;
  dismissError: (id: string) => void;
  clearErrors: () => void;
  toggleOpen: () => void;
}

export const useErrorStore = create<ErrorState>()((set) => ({
  errors: [],
  isOpen: false,
  pushError: (source, message) =>
    set((state) => ({
      errors: [
        ...state.errors,
        {
          id: crypto.randomUUID(),
          message,
          source,
          timestamp: Date.now(),
        },
      ],
      isOpen: true,
    })),
  dismissError: (id) =>
    set((state) => {
      const errors = state.errors.filter((e) => e.id !== id);
      return { errors, isOpen: errors.length > 0 ? state.isOpen : false };
    }),
  clearErrors: () => set({ errors: [], isOpen: false }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
}));

/** Standalone function — callable from anywhere without hooks */
export function pushError(source: string, message: string) {
  useErrorStore.getState().pushError(source, message);
}

/** Standalone function — callable from anywhere without hooks */
export function clearErrors() {
  useErrorStore.getState().clearErrors();
}
