// useRoomCreateToolStore — 「自動部屋作成」ツールの ON/OFF。
//   Room/Zone モードのパネルからボタンで構え、平面図で床（スラブ）をクリックすると
//   その輪郭から部屋（Room＋Zone）が作られる。連続でクリックして各部屋を作れるよう、
//   作成後もツールは構えたまま（ボタン再クリック / Esc で解除）。
import { create } from "zustand";

interface RoomCreateToolState {
  active: boolean;
  setActive: (active: boolean) => void;
}

export const useRoomCreateToolStore = create<RoomCreateToolState>((set) => ({
  active: false,
  setActive: (active) => set({ active }),
}));
