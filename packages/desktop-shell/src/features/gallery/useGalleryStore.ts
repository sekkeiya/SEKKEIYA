import { create } from 'zustand';
import type { GalleryItem, GalleryKind, GalleryScope } from './galleryTypes';

export type GalleryDensity = 'compact' | 'default' | 'large';

// Gallery のフィルタ状態。専用サイドバー（GallerySidebar）と本体（GalleryPage）で共有する。
interface GalleryStoreState {
  kind: GalleryKind | 'all';
  scope: GalleryScope;
  search: string;
  selectedItem: GalleryItem | null;
  density: GalleryDensity;
  setKind: (kind: GalleryKind | 'all') => void;
  setScope: (scope: GalleryScope) => void;
  setSearch: (search: string) => void;
  setSelectedItem: (item: GalleryItem | null) => void;
  setDensity: (density: GalleryDensity) => void;
}

export const useGalleryStore = create<GalleryStoreState>((set) => ({
  kind: 'all',
  scope: 'all',
  search: '',
  selectedItem: null,
  density: 'default',
  setKind: (kind) => set({ kind }),
  setScope: (scope) => set({ scope }),
  setSearch: (search) => set({ search }),
  setSelectedItem: (item) => set({ selectedItem: item }),
  setDensity: (density) => set({ density }),
}));
