import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMemo } from 'react';

/**
 * リサーチボードの「関係ラベル（接続詞）」プリセット。
 * エッジの relation はこの key を指す。ビルトイン＋ユーザーのカスタムを合わせて使う。
 * 接続詞で読めるようにする（例: A「だから」B）。データフロー用の「入力」「出力」も既定に含む。
 */
export interface ConnectorPreset {
  key: string;
  label: string;
  color: string;
  dash?: string;
  /** ビルトイン（削除不可）。AI が使うのは builtin の supports/contradicts/applies/derives のみ。 */
  builtin?: boolean;
}

export const BUILTIN_CONNECTORS: ConnectorPreset[] = [
  { key: 'supports',    label: 'だから', color: '#26a69a', builtin: true },
  { key: 'contradicts', label: 'でも',   color: '#f87171', dash: '6 4', builtin: true },
  { key: 'applies',     label: '例えば', color: '#4facfe', builtin: true },
  { key: 'derives',     label: 'つまり', color: '#a18cd1', builtin: true },
  { key: 'input',       label: '入力',   color: '#ffb74d', builtin: true },
  { key: 'output',      label: '出力',   color: '#63c58f', builtin: true },
];

export const DEFAULT_CONNECTOR_KEY = 'supports';

/** カスタムプリセットの色パレット（追加ダイアログの選択肢）。 */
export const CONNECTOR_COLOR_CHOICES = [
  '#26a69a', '#4facfe', '#a18cd1', '#f87171', '#ffb74d', '#63c58f', '#ec4899', '#888780',
];

interface ConnectorState {
  custom: ConnectorPreset[];
  /** カスタムプリセットを追加して key を返す。 */
  addPreset: (label: string, color: string) => string;
  removePreset: (key: string) => void;
}

export const useConnectorStore = create<ConnectorState>()(
  persist(
    (set, get) => ({
      custom: [],
      addPreset: (label, color) => {
        const key = 'c_' + Math.random().toString(36).slice(2, 7);
        set({ custom: [...get().custom, { key, label: label.trim() || 'ラベル', color }] });
        return key;
      },
      removePreset: (key) => set({ custom: get().custom.filter(c => c.key !== key) }),
    }),
    { name: 'sekkeiya-research-connectors' },
  ),
);

/** ビルトイン＋カスタムの全プリセット（非React・module 用）。 */
export function allConnectors(): ConnectorPreset[] {
  return [...BUILTIN_CONNECTORS, ...useConnectorStore.getState().custom];
}

/** key からプリセットを解決（見つからなければ既定）。 */
export function getConnector(key: string): ConnectorPreset {
  return allConnectors().find(c => c.key === key) ?? BUILTIN_CONNECTORS[0];
}

/** React 用: カスタムの変更に追従する全プリセット。 */
export function useConnectors(): ConnectorPreset[] {
  const custom = useConnectorStore(s => s.custom);
  return useMemo(() => [...BUILTIN_CONNECTORS, ...custom], [custom]);
}
