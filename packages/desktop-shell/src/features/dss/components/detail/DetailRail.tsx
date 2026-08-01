import React from 'react';
import { Box, Typography } from '@mui/material';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

/**
 * 左レール（DetailRail）1行分の項目。
 * `count`/`state` の意味は mode によって変わる（下記コンポーネント doc 参照）。
 */
export type RailItem = {
  id: string;
  label: string;
  count?: number;
  state?: 'done' | 'empty' | 'auto' | 'editing';
};

export interface DetailRailUsage {
  layouts: number;
  items: number;
  names: string[];
}

export interface DetailRailMaintenanceActions {
  onRegisterLinks: () => void;
  onCatalog: () => void;
  onAutoFill: () => void;
  onSaveThumb: () => void;
}

export interface DetailRailProps {
  mode: 'view' | 'edit';
  items: RailItem[];
  activeId: string | null;
  onJump: (id: string) => void;
  /** 閲覧モードのみ・非 null のときだけ「USED IN」ブロックを表示する。 */
  usage?: DetailRailUsage | null;
  /** 編集モードのみ・非 null のときだけ「情報を充実させる」ブロックを表示する。 */
  maintenanceActions?: DetailRailMaintenanceActions | null;
}

const RAIL_WIDTH: Record<DetailRailProps['mode'], number> = {
  view: 176,
  edit: 190,
};

const ACTIVE_ROW_SX = {
  bgcolor: 'rgba(59,130,246,0.16)',
  borderLeft: '2px solid #3b82f6',
} as const;

const ACTIVE_LABEL_SX = {
  fontWeight: 700,
  color: '#93c5fd',
} as const;

/**
 * 状態バッジ（編集モードの各行右側）。デザイン 504-543 行に準拠:
 * - done: 個数（例: "4"）を薄いグレーで表示
 * - editing: 「編集中」を強調色で表示（行自体もアクティブ行スタイル）
 * - empty: 「未」の丸ピル + ラベルを薄く
 * - auto: 「自動」の丸ピル
 */
const EditStateBadge: React.FC<{ item: RailItem; active: boolean }> = ({ item, active }) => {
  if (active) {
    return (
      <Typography component="span" sx={{ fontSize: '10.5px', color: '#93c5fd', flexShrink: 0 }}>
        編集中
      </Typography>
    );
  }
  if (item.state === 'empty') {
    return (
      <Typography
        component="span"
        sx={{
          fontSize: '10px',
          lineHeight: 1.4,
          padding: '1px 6px',
          borderRadius: '999px',
          border: '1px solid rgba(255,255,255,0.2)',
          color: 'rgba(255,255,255,0.5)',
          flexShrink: 0,
        }}
      >
        未
      </Typography>
    );
  }
  if (item.state === 'auto') {
    return (
      <Typography
        component="span"
        sx={{
          fontSize: '10px',
          lineHeight: 1.4,
          padding: '1px 6px',
          borderRadius: '999px',
          border: '1px solid rgba(255,255,255,0.2)',
          color: 'rgba(255,255,255,0.5)',
          flexShrink: 0,
        }}
      >
        自動
      </Typography>
    );
  }
  if (item.state === 'done') {
    // 「概要」行のような、個数を持たない完了セクションはチェックアイコンで表す。
    if (item.count === undefined) {
      return <CheckRoundedIcon sx={{ fontSize: 14, color: '#86efac', flexShrink: 0 }} />;
    }
    return (
      <Typography component="span" sx={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
        {item.count}
      </Typography>
    );
  }
  return null;
};

const RailRow: React.FC<{ mode: 'view' | 'edit'; item: RailItem; active: boolean; onJump: (id: string) => void }> = ({
  mode,
  item,
  active,
  onJump,
}) => {
  // デザイン準拠: 未登録（empty）・自動生成（auto）セクションはラベルを薄く表示する
  // （504-543行: 「4 アニメ」= empty も「6 同じ作者」= auto も同じ rgba(255,255,255,0.45)）。
  const dimmed = mode === 'edit' && (item.state === 'empty' || item.state === 'auto') && !active;
  return (
    <Box
      component="button"
      type="button"
      onClick={() => onJump(item.id)}
      data-rail-item-id={item.id}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 8px',
        borderRadius: '6px',
        border: 'none',
        borderLeft: '2px solid transparent',
        background: 'transparent',
        width: '100%',
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        ...(active ? ACTIVE_ROW_SX : null),
      }}
    >
      <Typography
        component="span"
        sx={{
          flex: 1,
          fontSize: '12.5px',
          color: dimmed ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.72)',
          ...(active ? ACTIVE_LABEL_SX : null),
        }}
      >
        {item.label}
      </Typography>
      {mode === 'view' ? (
        item.count !== undefined && (
          <Typography component="span" sx={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
            {item.count}
          </Typography>
        )
      ) : (
        <EditStateBadge item={item} active={active} />
      )}
    </Box>
  );
};

const RAIL_HEADING_SX = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '1px',
  color: 'rgba(255,255,255,0.35)',
  fontFamily: 'ui-monospace, Menlo, monospace',
} as const;

const UsedInBlock: React.FC<{ usage: DetailRailUsage }> = ({ usage }) => (
  <Box
    sx={{
      marginTop: '6px',
      paddingTop: '12px',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}
  >
    <Typography component="div" sx={RAIL_HEADING_SX}>
      USED IN
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <PlaceRoundedIcon sx={{ fontSize: 15, color: '#facc15' }} />
      <Typography component="span" sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>
        {usage.layouts} layouts / {usage.items} items
      </Typography>
    </Box>
    {usage.names.length > 0 && (
      <Typography
        component="div"
        sx={{ fontSize: '10.5px', color: 'rgba(226,232,240,0.6)', lineHeight: 1.6 }}
      >
        {usage.names.map((name, i) => (
          <React.Fragment key={name}>
            {i > 0 && <br />}
            {name}
          </React.Fragment>
        ))}
      </Typography>
    )}
  </Box>
);

const MAINTENANCE_BUTTON_BASE_SX = {
  font: 'inherit', // CSS ショートハンドのため先頭に置く（後続の fontSize/fontWeight を潰さないように）
  height: '30px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '6px',
  fontSize: '11.5px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  border: 'none',
  cursor: 'pointer',
  width: '100%',
} as const;

const MaintenanceActionsBlock: React.FC<{ actions: DetailRailMaintenanceActions }> = ({ actions }) => (
  <Box
    sx={{
      marginTop: '6px',
      paddingTop: '12px',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}
  >
    <Typography component="div" sx={RAIL_HEADING_SX}>
      情報を充実させる
    </Typography>
    <Box
      component="button"
      type="button"
      onClick={actions.onRegisterLinks}
      sx={{ ...MAINTENANCE_BUTTON_BASE_SX, bgcolor: '#2563eb', color: '#fff' }}
    >
      関連URLを自動登録
    </Box>
    <Box
      component="button"
      type="button"
      onClick={actions.onCatalog}
      sx={{ ...MAINTENANCE_BUTTON_BASE_SX, bgcolor: '#16a34a', color: '#fff' }}
    >
      カタログ照合
    </Box>
    <Box
      component="button"
      type="button"
      onClick={actions.onAutoFill}
      sx={{ ...MAINTENANCE_BUTTON_BASE_SX, bgcolor: 'transparent', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.5)' }}
    >
      AI で項目を補完
    </Box>
    <Box
      component="button"
      type="button"
      onClick={actions.onSaveThumb}
      sx={{ ...MAINTENANCE_BUTTON_BASE_SX, bgcolor: 'transparent', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.5)' }}
    >
      この表示をサムネに
    </Box>
  </Box>
);

/**
 * S.Model 詳細画面の左レール。デザイン 73-113 行（閲覧: CONTENTS + USED IN）と
 * 504-543 行（編集: SECTIONS + 状態バッジ + 情報を充実させる）に準拠。
 *
 * - 各行クリックで `onJump(id)`（呼び出し側が該当セクションへスクロールする）。
 * - `activeId` に一致する行がアクティブ行スタイル（背景 + 左ボーダー + 強調文字色）になる。
 * - `usage` は閲覧モードのみ・非 null のときだけ「USED IN」ブロックを描画する。
 * - `maintenanceActions` は編集モードのみ・非 null のときだけ「情報を充実させる」ブロックを描画する。
 * - 幅は mode によって決まる（閲覧 176px / 編集 190px）。
 */
export const DetailRail: React.FC<DetailRailProps> = ({ mode, items, activeId, onJump, usage, maintenanceActions }) => {
  return (
    <Box
      sx={{
        width: RAIL_WIDTH[mode],
        flex: 'none',
        padding: '20px 14px',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        bgcolor: 'rgba(255,255,255,0.015)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <Typography component="div" sx={RAIL_HEADING_SX}>
        {mode === 'view' ? 'CONTENTS' : 'SECTIONS'}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {items.map((item) => (
          <RailRow key={item.id} mode={mode} item={item} active={item.id === activeId} onJump={onJump} />
        ))}
      </Box>
      {mode === 'view' && usage != null && <UsedInBlock usage={usage} />}
      {mode === 'edit' && maintenanceActions != null && <MaintenanceActionsBlock actions={maintenanceActions} />}
    </Box>
  );
};
