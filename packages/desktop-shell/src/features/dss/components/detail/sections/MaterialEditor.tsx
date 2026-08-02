/**
 * SECTION 1「素材」の編集 UI（作成者向け）。
 *
 * 状態と永続化は DssMaterialPresets が持ち、このファイルは描画だけを担う。
 * 骨格は閲覧モード（MaterialSection）と揃えている — 部位ごとのスウォッチ行が並び、
 * その下に「保存済みの組み合わせ」。編集側はそこに名前のインライン編集・素材の追加/削除・
 * 既定の指定が乗る。3D ビューアと「部位にする」アクションバーは MaterialSection が描く。
 */
import React, { useState } from 'react';
import { Box, Typography, TextField, CircularProgress } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CallSplitRoundedIcon from '@mui/icons-material/CallSplitRounded';
import AddAPhotoRoundedIcon from '@mui/icons-material/AddAPhotoRounded';
import type { EnumeratedSlot } from '../../../../shared/material/applyMaterial';
import type {
  MaterialPresetSlot, MaterialPresetOption, MaterialPresetMember, MaterialVariant,
} from '../../../../shared/material/materialPresets';
import { slotDisplayTitle } from '../../../utils/materialSlotLabel';
import { swatchVisualOf, variantVisualOf } from '../../../utils/materialSectionView';
import { Swatch } from './materialSectionParts';

const EDIT_ACCENT = '#f472b6';

/** 編集リストの 1 行。DssMaterialPresets の rows と同じ形。 */
export interface MaterialEditorRow {
  key: string;
  label: string;
  members: MaterialPresetMember[];
  preset?: MaterialPresetSlot;
  repSlot: EnumeratedSlot;
  isGroup: boolean;
}

export interface MaterialEditorProps {
  /** 登録済みの部位（preset を持つ行）。 */
  registeredRows: MaterialEditorRow[];
  /** まだどの部位にも属していないパーツ。 */
  unregisteredRows: MaterialEditorRow[];
  presets: MaterialPresetSlot[];
  variants: MaterialVariant[];
  selection: Record<string, string>;
  selectedKeys: string[];
  selectedVariantId: string | null;
  saving: boolean;
  /** モデルのサムネイル。「元のまま」スウォッチと、サムネ未保存パターンの下地に使う。 */
  modelThumbUrl?: string;
  /** GLB の解析待ち（slots が 0 件）。 */
  analyzing: boolean;
  canAutoGroup: boolean;
  canSaveVariant: boolean;

  onToggleRow: (key: string) => void;
  onUngroupRow: (key: string) => void;
  onAutoGroup: () => void;
  onSetLabel: (key: string, label: string) => void;
  onCommitLabel: () => void;
  onSelectOption: (key: string, optionId: string) => void;
  onClearOption: (key: string) => void;
  onSetDefaultOption: (key: string, optionId: string) => void;
  onRemoveOption: (key: string, optionId: string) => void;
  onOpenPicker: (anchor: HTMLElement, rowKey: string, repSlot: EnumeratedSlot) => void;
  onSaveCurrentAsVariant: () => void;
  onApplyVariant: (variant: MaterialVariant) => void;
  onApplyDefault: () => void;
  onRenameVariant: (id: string, title: string) => void;
  onCommitVariants: () => void;
  onSetDefaultVariant: (id: string) => void;
  onRemoveVariant: (id: string) => void;
}

/** クリックで入力に変わる名前。行の見出しとパターン名で共用する。 */
const InlineName: React.FC<{
  value: string;
  fallback: string;
  fontSize: number;
  onChange: (v: string) => void;
  onCommit: () => void;
}> = ({ value, fallback, fontSize, onChange, onCommit }) => {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <TextField
        autoFocus
        size="small"
        placeholder={fallback}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => { setEditing(false); onCommit(); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        sx={{
          '& .MuiInputBase-input': { color: '#fff', fontSize, py: 0.4 },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
        }}
      />
    );
  }
  return (
    <Box
      component="button"
      type="button"
      title="クリックして名前を編集"
      onClick={() => setEditing(true)}
      sx={{
        font: 'inherit', padding: 0, background: 'none', border: 'none', cursor: 'text',
        fontSize, fontWeight: 600, textAlign: 'left',
        color: value ? '#fff' : 'rgba(148,163,184,0.85)',
        borderBottom: '1px dashed rgba(255,255,255,0.3)',
        '&:hover': { borderBottomColor: 'rgba(255,255,255,0.65)' },
      }}
    >
      {value || fallback}
    </Box>
  );
};

/** ホバーで★（既定）と×（削除）が出るオプションのスウォッチ。 */
const OptionSwatch: React.FC<{
  option: MaterialPresetOption;
  selected: boolean;
  onSelect: () => void;
  onSetDefault: () => void;
  onRemove: () => void;
}> = ({ option, selected, onSelect, onSetDefault, onRemove }) => (
  <Box sx={{ position: 'relative', width: 44, height: 44, flex: 'none', '&:hover .opt-act': { opacity: 1 } }}>
    <Swatch visual={swatchVisualOf(option)} selected={selected} title={option.title || '素材'} onClick={onSelect} />
    <Box
      component="button"
      type="button"
      className={option.isDefault ? undefined : 'opt-act'}
      title={option.isDefault ? '既定（閲覧時の初期表示）' : '既定にする'}
      onClick={onSetDefault}
      sx={{
        position: 'absolute', top: -3, right: -3, width: 17, height: 17, padding: 0,
        borderRadius: '50%', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: option.isDefault ? '#facc15' : 'rgba(20,24,32,0.92)',
        color: option.isDefault ? '#412402' : 'rgba(255,255,255,0.75)',
        opacity: option.isDefault ? 1 : 0, transition: 'opacity 0.15s',
      }}
    >
      <StarRoundedIcon sx={{ fontSize: 11 }} />
    </Box>
    <Box
      component="button"
      type="button"
      className="opt-act"
      title="この素材を削除"
      onClick={onRemove}
      sx={{
        position: 'absolute', bottom: -3, right: -3, width: 17, height: 17, padding: 0,
        borderRadius: '50%', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: 'rgba(20,24,32,0.92)', color: 'rgba(255,255,255,0.75)',
        opacity: 0, transition: 'opacity 0.15s',
        '&:hover': { bgcolor: '#ef4444', color: '#fff' },
      }}
    >
      <CloseRoundedIcon sx={{ fontSize: 11 }} />
    </Box>
  </Box>
);

/** 素材を追加する破線の丸ボタン。押すと素材ピッカーのアンカーになる。 */
const AddSwatch: React.FC<{ onOpen: (anchor: HTMLElement) => void }> = ({ onOpen }) => (
  <Box
    component="button"
    type="button"
    title="素材を追加"
    onClick={(e: React.MouseEvent<HTMLElement>) => onOpen(e.currentTarget)}
    sx={{
      width: 44, height: 44, flex: 'none', padding: 0, borderRadius: '50%', cursor: 'pointer',
      bgcolor: 'transparent', border: '1px dashed rgba(255,255,255,0.35)', color: 'rgba(255,255,255,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      '&:hover': { borderColor: 'rgba(255,255,255,0.7)', color: '#fff' },
    }}
  >
    <AddRoundedIcon sx={{ fontSize: 20 }} />
  </Box>
);

/** 部位 1 行（登録済み・未設定で共用）。 */
const PartRow: React.FC<{
  row: MaterialEditorRow;
  index: number;
  selected: boolean;
  selectedOptionId?: string;
  modelThumbUrl?: string;
  onToggleRow: (key: string) => void;
  onUngroupRow: (key: string) => void;
  onSetLabel: (key: string, label: string) => void;
  onCommitLabel: () => void;
  onSelectOption: (key: string, optionId: string) => void;
  onClearOption: (key: string) => void;
  onSetDefaultOption: (key: string, optionId: string) => void;
  onRemoveOption: (key: string, optionId: string) => void;
  onOpenPicker: (anchor: HTMLElement, rowKey: string, repSlot: EnumeratedSlot) => void;
}> = ({
  row, index, selected, selectedOptionId, modelThumbUrl,
  onToggleRow, onUngroupRow, onSetLabel, onCommitLabel,
  onSelectOption, onClearOption, onSetDefaultOption, onRemoveOption, onOpenPicker,
}) => {
  const options = row.preset?.options ?? [];
  return (
    <Box
      sx={{
        borderRadius: '8px', padding: '8px 10px',
        bgcolor: selected ? 'rgba(59,130,246,0.08)' : 'transparent',
        border: `1px solid ${selected ? 'rgba(59,130,246,0.45)' : 'transparent'}`,
      }}
    >
      <Box
        onClick={() => onToggleRow(row.key)}
        sx={{ display: 'flex', alignItems: 'center', gap: '8px', mb: '8px', cursor: 'pointer' }}
      >
        <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'flex', minWidth: 0 }}>
          <InlineName
            value={row.preset?.label ?? ''}
            fallback={slotDisplayTitle(row.label, row.repSlot.materialName, index)}
            fontSize={12}
            onChange={(v) => onSetLabel(row.key, v)}
            onCommit={onCommitLabel}
          />
        </Box>
        <Typography sx={{ fontSize: 11, color: 'rgba(148,163,184,0.75)' }}>{row.members.length} パーツ</Typography>
        <Box sx={{ flex: 1 }} />
        {row.isGroup && (
          <Box
            component="button"
            type="button"
            onClick={(e) => { e.stopPropagation(); onUngroupRow(row.key); }}
            sx={{
              font: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: 11, color: 'rgba(148,163,184,0.7)',
              display: 'flex', alignItems: 'center', gap: '4px',
              '&:hover': { color: '#fff' },
            }}
          >
            <CallSplitRoundedIcon sx={{ fontSize: 13 }} />グループ解除
          </Box>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Swatch
          visual={{ imageUrl: modelThumbUrl, color: '#3a4150' }}
          selected={!selectedOptionId}
          title="元のまま"
          onClick={() => onClearOption(row.key)}
        />
        {options.map((opt) => (
          <OptionSwatch
            key={opt.id}
            option={opt}
            selected={selectedOptionId === opt.id}
            onSelect={() => onSelectOption(row.key, opt.id)}
            onSetDefault={() => onSetDefaultOption(row.key, opt.id)}
            onRemove={() => onRemoveOption(row.key, opt.id)}
          />
        ))}
        <AddSwatch onOpen={(anchor) => onOpenPicker(anchor, row.key, row.repSlot)} />
      </Box>
    </Box>
  );
};

export const MaterialEditor: React.FC<MaterialEditorProps> = ({
  registeredRows, unregisteredRows, presets, variants, selection, selectedKeys, selectedVariantId,
  saving, modelThumbUrl, analyzing, canAutoGroup, canSaveVariant,
  onToggleRow, onUngroupRow, onAutoGroup, onSetLabel, onCommitLabel,
  onSelectOption, onClearOption, onSetDefaultOption, onRemoveOption, onOpenPicker,
  onSaveCurrentAsVariant, onApplyVariant, onApplyDefault,
  onRenameVariant, onCommitVariants, onSetDefaultVariant, onRemoveVariant,
}) => {
  const [showUnregistered, setShowUnregistered] = useState(false);

  const rowProps = {
    modelThumbUrl,
    onToggleRow, onUngroupRow, onSetLabel, onCommitLabel,
    onSelectOption, onClearOption, onSetDefaultOption, onRemoveOption, onOpenPicker,
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {saving && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <CircularProgress size={12} sx={{ color: EDIT_ACCENT }} />
          <Typography sx={{ fontSize: 11, color: 'rgba(148,163,184,0.8)' }}>保存中…</Typography>
        </Box>
      )}

      {analyzing ? (
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
          モデルを解析中…（部位が出ない場合は単一マテリアルの可能性があります）
        </Typography>
      ) : (
        <>
          {registeredRows.length === 0 && (
            <Typography sx={{ fontSize: 12, color: 'rgba(148,163,184,0.8)' }}>
              まだ部位がありません。ビューアでパーツをクリックして選び、「部位にする」を押してください。
            </Typography>
          )}
          {registeredRows.map((row, index) => (
            <PartRow
              key={row.key}
              row={row}
              index={index}
              selected={selectedKeys.includes(row.key)}
              selectedOptionId={selection[row.key]}
              {...rowProps}
            />
          ))}

          {unregisteredRows.length > 0 && (
            <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.07)', pt: '11px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => setShowUnregistered((v) => !v)}
                  sx={{
                    font: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px',
                    fontSize: 11, color: 'rgba(148,163,184,0.7)', '&:hover': { color: '#fff' },
                  }}
                >
                  {showUnregistered ? <ExpandMoreRoundedIcon sx={{ fontSize: 16 }} /> : <ChevronRightRoundedIcon sx={{ fontSize: 16 }} />}
                  未設定のパーツ {unregisteredRows.length}
                </Box>
                <Box sx={{ flex: 1 }} />
                {canAutoGroup && (
                  <Box
                    component="button"
                    type="button"
                    onClick={onAutoGroup}
                    title="素材名や色が同じ単独パーツを自動でまとめる"
                    sx={{
                      font: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '4px',
                      fontSize: 11, color: EDIT_ACCENT, '&:hover': { color: '#f9a8d4' },
                    }}
                  >
                    <AutoAwesomeRoundedIcon sx={{ fontSize: 13 }} />同じ素材でまとめる
                  </Box>
                )}
              </Box>
              {showUnregistered && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '12px', mt: '10px' }}>
                  {unregisteredRows.map((row, i) => (
                    <PartRow
                      key={row.key}
                      row={row}
                      index={registeredRows.length + i}
                      selected={selectedKeys.includes(row.key)}
                      selectedOptionId={selection[row.key]}
                      {...rowProps}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}
        </>
      )}

      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.09)', pt: '13px' }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#fff', mb: '9px' }}>保存済みの組み合わせ</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 132px)', gap: '10px' }}>
          {/* 元の見た目：名前も★も×も持たないことで「編集不可」と分かる。 */}
          <Box
            component="button"
            type="button"
            aria-pressed={selectedVariantId === null}
            onClick={onApplyDefault}
            sx={{
              font: 'inherit', textAlign: 'left', padding: 0, background: 'none', border: 'none', cursor: 'pointer',
              '&:hover .pattern-thumb': { transform: 'translateY(-2px)' },
            }}
          >
            <Box
              className="pattern-thumb"
              sx={{
                aspectRatio: '4 / 3', borderRadius: '8px', overflow: 'hidden', bgcolor: '#3a4150',
                border: selectedVariantId === null ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.14)',
                transition: 'transform 0.15s, border-color 0.15s',
              }}
            >
              {modelThumbUrl && (
                <Box component="img" src={modelThumbUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              )}
            </Box>
            <Typography sx={{ fontSize: 11.5, mt: '5px', fontWeight: 600, color: '#fff' }} noWrap>元の見た目</Typography>
          </Box>

          {variants.map((v) => {
            const isSel = selectedVariantId === v.id;
            const visual = variantVisualOf(presets, v, modelThumbUrl);
            return (
              <Box key={v.id} sx={{ '&:hover .var-act': { opacity: 1 } }}>
                <Box sx={{ position: 'relative' }}>
                  <Box
                    component="button"
                    type="button"
                    aria-pressed={isSel}
                    onClick={() => onApplyVariant(v)}
                    sx={{
                      display: 'block', width: '100%', padding: 0, background: 'none', border: 'none', cursor: 'pointer',
                      '&:hover .pattern-thumb': { transform: 'translateY(-2px)' },
                    }}
                  >
                    <Box
                      className="pattern-thumb"
                      sx={{
                        position: 'relative',
                        aspectRatio: '4 / 3', borderRadius: '8px', overflow: 'hidden', bgcolor: visual.color,
                        border: isSel ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.14)',
                        transition: 'transform 0.15s, border-color 0.15s',
                      }}
                    >
                      {visual.imageUrl && (
                        <Box component="img" src={visual.imageUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      )}
                      {visual.badge && (
                        <Box
                          sx={{
                            position: 'absolute', right: 5, bottom: 5,
                            width: 22, height: 22, borderRadius: '50%', overflow: 'hidden',
                            bgcolor: visual.badge.color,
                            border: '1px solid rgba(0,0,0,0.45)',
                            boxShadow: '0 0 0 1px rgba(255,255,255,0.35)',
                          }}
                        >
                          {visual.badge.imageUrl && (
                            <Box component="img" src={visual.badge.imageUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          )}
                        </Box>
                      )}
                    </Box>
                  </Box>
                  <Box
                    component="button"
                    type="button"
                    className={v.isDefault ? undefined : 'var-act'}
                    title={v.isDefault ? '既定（閲覧時の初期表示）' : '既定にする'}
                    onClick={() => onSetDefaultVariant(v.id)}
                    sx={{
                      position: 'absolute', top: 4, left: 4, width: 20, height: 20, padding: 0,
                      borderRadius: '50%', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: v.isDefault ? '#facc15' : 'rgba(20,24,32,0.92)',
                      color: v.isDefault ? '#412402' : 'rgba(255,255,255,0.75)',
                      opacity: v.isDefault ? 1 : 0, transition: 'opacity 0.15s',
                    }}
                  >
                    <StarRoundedIcon sx={{ fontSize: 13 }} />
                  </Box>
                  <Box
                    component="button"
                    type="button"
                    className="var-act"
                    title="このパターンを削除"
                    onClick={() => onRemoveVariant(v.id)}
                    sx={{
                      position: 'absolute', top: 4, right: 4, width: 20, height: 20, padding: 0,
                      borderRadius: '50%', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: 'rgba(20,24,32,0.92)', color: 'rgba(255,255,255,0.75)',
                      opacity: 0, transition: 'opacity 0.15s',
                      '&:hover': { bgcolor: '#ef4444', color: '#fff' },
                    }}
                  >
                    <CloseRoundedIcon sx={{ fontSize: 13 }} />
                  </Box>
                </Box>
                <Box sx={{ mt: '5px' }}>
                  <InlineName
                    value={v.title ?? ''}
                    fallback="パターン名"
                    fontSize={11.5}
                    onChange={(t) => onRenameVariant(v.id, t)}
                    onCommit={onCommitVariants}
                  />
                </Box>
              </Box>
            );
          })}

          <Box
            component="button"
            type="button"
            disabled={!canSaveVariant}
            title={canSaveVariant ? '今のビューアの見た目をパターンとして保存' : '先に部位へ素材を登録してください'}
            onClick={onSaveCurrentAsVariant}
            sx={{
              font: 'inherit', padding: 0, background: 'none', border: 'none',
              cursor: canSaveVariant ? 'pointer' : 'not-allowed',
              opacity: canSaveVariant ? 1 : 0.4,
            }}
          >
            <Box
              sx={{
                aspectRatio: '4 / 3', borderRadius: '8px',
                border: `1px dashed ${EDIT_ACCENT}8c`, color: EDIT_ACCENT,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
                transition: 'border-color 0.15s',
                '&:hover': { borderColor: EDIT_ACCENT },
              }}
            >
              <AddAPhotoRoundedIcon sx={{ fontSize: 20 }} />
              <Typography sx={{ fontSize: 10.5 }}>今の見た目を保存</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
