import { create } from 'zustand';
import type { GalleryKind, GalleryScope } from './galleryTypes';

// Gallery のフィルタ状態。専用サイドバー（GallerySidebar）と本体（GalleryPage）で共有する。
interface GalleryStoreState {
  kind: GalleryKind | 'all';
  scope: GalleryScope;
  search: string;
  setKind: (kind: GalleryKind | 'all') => void;
  setScope: (scope: GalleryScope) => void;
  setSearch: (search: string) => void;
}

export const useGalleryStore = create<GalleryStoreState>((set) => ({
  kind: 'all',
  scope: 'all',
  search: '',
  setKind: (kind) => set({ kind }),
  setScope: (scope) => set({ scope }),
  setSearch: (search) => set({ search }),
}));
