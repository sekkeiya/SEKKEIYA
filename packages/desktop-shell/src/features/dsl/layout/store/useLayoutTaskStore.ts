import { create } from 'zustand';

export interface ZoneRect {
  x: number;
  z: number;
  width: number;
  depth: number;
}

export interface Room {
  id: string;
  name: string;
  color?: string;
  createdAtMs?: number;
  /** どの階の部屋か（0=1F）。未設定は 1F 扱い（既存データはそのまま使える）。 */
  floorIndex?: number;
  /**
   * 室の範囲（中心＋幅/奥行、world）。「用途もレイアウト範囲も室が持つ」モデルの正データ。
   * 壁・床がある場合は実輪郭（measureRoomFromSlab 等）で同期でき、壁がまだ無い
   * 初期のバブル設計段階では明示配置する。ゾーン（機能マーカー）とは別物。
   * 未設定の既存部屋は、後方互換で所属ゾーンの rect から範囲を拾う。
   */
  rect?: ZoneRect;
  /**
   * 部屋の用途カテゴリ（LDK / 寝室 / トイレ …）。roomCategories のキー。
   * 「用途は部屋（室）が持つ」モデルの正データ。ゾーンの category は
   * 室内の機能サブ分割（LDK 内のリビング/ダイニング/キッチン等）に限定する。
   * 消費側（自動レイアウト・ラベル）は resolveCategoryKey(zone, room) で
   * zone.category ?? room.category の順に解決する（後方互換）。
   */
  category?: string;
}

export interface ZoneLayoutVersion {
  id: string;
  name: string;
  createdAtMs: number;
  items: any[];
}

export interface ZoneCirculation {
  id: string;
  type: 'main' | 'sub';
  width: number;
  usage?: 'guest' | 'staff' | 'delivery' | 'emergency';
  points: { x: number; z: number }[];
}

export interface CirculationPattern {
  id: string;
  name: string;
  isActive?: boolean;
  circulations: ZoneCirculation[];
  createdAtMs?: number;
  updatedAtMs?: number;
}

export interface ZoneNode {
  id: string;
  roomId?: string;
  name: string;
  targetSeats: number;
  category?: string;
  color?: string;
  rect?: ZoneRect;
  createdBy?: 'user' | 'ai';
  createdAtMs?: number;
  versions?: ZoneLayoutVersion[];
  /** どの階のゾーンか（0=1F）。未設定は 1F 扱い（既存データはそのまま使える）。
   *  平面図ではアクティブ階のゾーンだけ実体表示し、他階は「他階トレース」トグルで薄く出す。 */
  floorIndex?: number;
}

interface ZoneActuals {
  [zoneId: string]: { actualSeats: number }
}

interface LayoutTaskState {
  rooms: Room[];
  zones: ZoneNode[];
  circulations: ZoneCirculation[]; // Legacy / Current active pattern's circulations for ease of use
  circulationPatterns: CirculationPattern[];
  activeCirculationPatternId: string | null;
  activeZoneId: string | null;
  selectedZoneIds: string[];
  /** ツリーで選択中の部屋（Room）。平面ではその部屋の全ゾーンをハイライトする。
   *  ゾーン選択（activeZoneId）とは排他: 片方を立てるともう片方は解除する。 */
  selectedRoomId: string | null;
  zoneActuals: ZoneActuals;
  zoneClipboard: ZoneNode | null;
  setRooms: (rooms: Room[]) => void;
  setZones: (zones: ZoneNode[]) => void;
  setCirculations: (circulations: ZoneCirculation[]) => void;
  setCirculationPatterns: (patterns: CirculationPattern[]) => void;
  setActiveCirculationPatternId: (id: string | null) => void;
  setActiveZoneId: (zoneId: string | null) => void;
  setSelectedRoomId: (roomId: string | null) => void;
  setSelectedZoneIds: (ids: string[]) => void;
  toggleSelectedZoneId: (id: string) => void;
  setZoneActuals: (actuals: ZoneActuals) => void;
  setZoneClipboard: (zone: ZoneNode | null) => void;
}

export const useLayoutTaskStore = create<LayoutTaskState>((set) => ({
  rooms: [],
  zones: [],
  circulations: [],
  circulationPatterns: [],
  activeCirculationPatternId: null,
  activeZoneId: null,
  selectedZoneIds: [],
  selectedRoomId: null,
  zoneActuals: {},
  zoneClipboard: null,
  setRooms: (rooms) => set({ rooms }),
  setZones: (zones) => set({ zones }),
  setCirculations: (circulations) => set({ circulations }),
  setCirculationPatterns: (patterns) => set({ circulationPatterns: patterns }),
  setActiveCirculationPatternId: (id) => set({ activeCirculationPatternId: id }),
  setActiveZoneId: (zoneId) => set({
    activeZoneId: zoneId,
    selectedZoneIds: zoneId ? [zoneId] : [],
    // ゾーンを選んだら部屋選択は解除（排他）
    ...(zoneId ? { selectedRoomId: null } : {}),
  }),
  setSelectedRoomId: (roomId) => set({
    selectedRoomId: roomId,
    // 部屋を選んだらゾーン選択は解除（排他）＝平面は部屋全体をハイライト
    ...(roomId ? { activeZoneId: null, selectedZoneIds: [] } : {}),
  }),
  setSelectedZoneIds: (ids) => set({ selectedZoneIds: ids }),
  toggleSelectedZoneId: (id) =>
    set((s) => ({
      selectedZoneIds: s.selectedZoneIds.includes(id)
        ? s.selectedZoneIds.filter((x) => x !== id)
        : [...s.selectedZoneIds, id],
    })),
  setZoneActuals: (actuals) => set({ zoneActuals: actuals }),
  setZoneClipboard: (zone) => set({ zoneClipboard: zone }),
}));
