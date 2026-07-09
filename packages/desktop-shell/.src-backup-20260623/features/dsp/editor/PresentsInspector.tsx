import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Box, Typography, TextField, Slider, Divider, IconButton, Switch, MenuItem, Collapse, Tab, Tabs } from '@mui/material';
import { useDspStore } from '../store/useDspStore';
import { useAIDriveStore, resolveAssetPreviewUrl } from '../../../store/useAIDriveStore';
import { BRAND } from '../../../styles/theme';
import type { PresentationElement, PresentationPage } from '../types/dsp.types';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import ViewQuiltRoundedIcon from '@mui/icons-material/ViewQuiltRounded';
import TextFieldsRoundedIcon from '@mui/icons-material/TextFieldsRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import { DeckTemplatePanel } from './DeckTemplatePanel';

// ─── Template Definitions ──────────────────────────────────────────────────────

type TemplateElement = Omit<PresentationElement, 'id'>;

interface DesignTemplate {
  id: string;
  label: string;
  previewBg?: string;
  previewContent?: React.ReactNode;
  build: (cW: number, cH: number) => TemplateElement[];
}

const ACCENT = '#29b6f6';
const DARK_BG = '#1a1a2e';

const LAYOUT_TEMPLATES: DesignTemplate[] = [
  {
    id: 'title',
    label: 'タイトルスライド',
    previewBg: DARK_BG,
    build: (cW, cH) => [
      { type: 'shape', x: 0, y: 0, w: cW, h: cH, zIndex: 0, rotation: 0, opacity: 100, data: { shapeType: 'rect', fill: DARK_BG } },
      { type: 'shape', x: 0, y: cH * 0.55, w: cW, h: cH * 0.45, zIndex: 1, rotation: 0, opacity: 100, data: { shapeType: 'rect', fill: '#16213e' } },
      { type: 'line', x: cW * 0.08, y: cH * 0.42, w: cW * 0.12, h: 0, zIndex: 2, rotation: 0, opacity: 100, data: { fill: ACCENT, stroke: ACCENT, strokeWidth: '4' } },
      { type: 'text', x: cW * 0.08, y: cH * 0.2, w: cW * 0.84, h: cH * 0.22, zIndex: 3, rotation: 0, opacity: 100, data: { text: 'プレゼンテーションタイトル', fontSize: '72px', color: '#ffffff', textAlign: 'left', fontWeight: '700' } },
      { type: 'text', x: cW * 0.08, y: cH * 0.48, w: cW * 0.6, h: cH * 0.1, zIndex: 3, rotation: 0, opacity: 100, data: { text: 'サブタイトルや日付・会社名など', fontSize: '28px', color: 'rgba(255,255,255,0.65)', textAlign: 'left', fontWeight: '400' } },
    ],
  },
  {
    id: 'title_content',
    label: 'タイトル＋コンテンツ',
    build: (cW, cH) => [
      { type: 'shape', x: 0, y: 0, w: cW, h: cH * 0.16, zIndex: 0, rotation: 0, opacity: 100, data: { shapeType: 'rect', fill: '#f5f5f7' } },
      { type: 'text', x: cW * 0.05, y: cH * 0.03, w: cW * 0.9, h: cH * 0.12, zIndex: 1, rotation: 0, opacity: 100, data: { text: 'スライドタイトル', fontSize: '48px', color: '#1d1d1f', textAlign: 'left', fontWeight: '700' } },
      { type: 'line', x: cW * 0.05, y: cH * 0.17, w: cW * 0.9, h: 0, zIndex: 2, rotation: 0, opacity: 100, data: { fill: '#d2d2d7', stroke: '#d2d2d7', strokeWidth: '1' } },
      { type: 'text', x: cW * 0.05, y: cH * 0.22, w: cW * 0.9, h: cH * 0.7, zIndex: 3, rotation: 0, opacity: 100, data: { text: 'ここにコンテンツを入力してください。\n\n・ポイント1\n・ポイント2\n・ポイント3', fontSize: '28px', color: '#3a3a3c', textAlign: 'left', fontWeight: '400' } },
    ],
  },
  {
    id: 'two_col',
    label: '2カラム',
    build: (cW, cH) => [
      { type: 'text', x: cW * 0.05, y: cH * 0.04, w: cW * 0.9, h: cH * 0.1, zIndex: 1, rotation: 0, opacity: 100, data: { text: 'スライドタイトル', fontSize: '42px', color: '#1d1d1f', textAlign: 'left', fontWeight: '700' } },
      { type: 'line', x: cW * 0.05, y: cH * 0.15, w: cW * 0.9, h: 0, zIndex: 2, rotation: 0, opacity: 100, data: { fill: '#d2d2d7', stroke: '#d2d2d7', strokeWidth: '1' } },
      { type: 'shape', x: cW * 0.05, y: cH * 0.18, w: cW * 0.42, h: cH * 0.75, zIndex: 3, rotation: 0, opacity: 100, data: { shapeType: 'rect', fill: '#f5f5f7', borderRadius: '12px' } },
      { type: 'text', x: cW * 0.07, y: cH * 0.21, w: cW * 0.38, h: cH * 0.08, zIndex: 4, rotation: 0, opacity: 100, data: { text: '左カラム', fontSize: '28px', color: '#1d1d1f', textAlign: 'left', fontWeight: '600' } },
      { type: 'text', x: cW * 0.07, y: cH * 0.31, w: cW * 0.38, h: cH * 0.58, zIndex: 4, rotation: 0, opacity: 100, data: { text: '・ポイントA\n・ポイントB\n・ポイントC', fontSize: '24px', color: '#3a3a3c', textAlign: 'left', fontWeight: '400' } },
      { type: 'shape', x: cW * 0.53, y: cH * 0.18, w: cW * 0.42, h: cH * 0.75, zIndex: 3, rotation: 0, opacity: 100, data: { shapeType: 'rect', fill: '#f5f5f7', borderRadius: '12px' } },
      { type: 'text', x: cW * 0.55, y: cH * 0.21, w: cW * 0.38, h: cH * 0.08, zIndex: 4, rotation: 0, opacity: 100, data: { text: '右カラム', fontSize: '28px', color: '#1d1d1f', textAlign: 'left', fontWeight: '600' } },
      { type: 'text', x: cW * 0.55, y: cH * 0.31, w: cW * 0.38, h: cH * 0.58, zIndex: 4, rotation: 0, opacity: 100, data: { text: '・ポイントD\n・ポイントE\n・ポイントF', fontSize: '24px', color: '#3a3a3c', textAlign: 'left', fontWeight: '400' } },
    ],
  },
  {
    id: 'image_left',
    label: '画像＋テキスト（左画像）',
    build: (cW, cH) => [
      { type: 'image', x: 0, y: 0, w: cW * 0.48, h: cH, zIndex: 1, rotation: 0, opacity: 100, data: { src: '', alt: '画像をドロップ' } },
      { type: 'text', x: cW * 0.54, y: cH * 0.18, w: cW * 0.4, h: cH * 0.12, zIndex: 2, rotation: 0, opacity: 100, data: { text: 'タイトル', fontSize: '52px', color: '#1d1d1f', textAlign: 'left', fontWeight: '700' } },
      { type: 'line', x: cW * 0.54, y: cH * 0.32, w: cW * 0.08, h: 0, zIndex: 3, rotation: 0, opacity: 100, data: { fill: ACCENT, stroke: ACCENT, strokeWidth: '4' } },
      { type: 'text', x: cW * 0.54, y: cH * 0.38, w: cW * 0.4, h: cH * 0.44, zIndex: 2, rotation: 0, opacity: 100, data: { text: 'ここに説明文を入力します。\nプロジェクトの特徴や\n重要なポイントを簡潔に。', fontSize: '26px', color: '#3a3a3c', textAlign: 'left', fontWeight: '400' } },
    ],
  },
  {
    id: 'image_right',
    label: '画像＋テキスト（右画像）',
    build: (cW, cH) => [
      { type: 'image', x: cW * 0.52, y: 0, w: cW * 0.48, h: cH, zIndex: 1, rotation: 0, opacity: 100, data: { src: '', alt: '画像をドロップ' } },
      { type: 'text', x: cW * 0.06, y: cH * 0.18, w: cW * 0.4, h: cH * 0.12, zIndex: 2, rotation: 0, opacity: 100, data: { text: 'タイトル', fontSize: '52px', color: '#1d1d1f', textAlign: 'left', fontWeight: '700' } },
      { type: 'line', x: cW * 0.06, y: cH * 0.32, w: cW * 0.08, h: 0, zIndex: 3, rotation: 0, opacity: 100, data: { fill: ACCENT, stroke: ACCENT, strokeWidth: '4' } },
      { type: 'text', x: cW * 0.06, y: cH * 0.38, w: cW * 0.4, h: cH * 0.44, zIndex: 2, rotation: 0, opacity: 100, data: { text: 'ここに説明文を入力します。\nプロジェクトの特徴や\n重要なポイントを簡潔に。', fontSize: '26px', color: '#3a3a3c', textAlign: 'left', fontWeight: '400' } },
    ],
  },
  {
    id: 'fullimage',
    label: '全面画像',
    previewBg: '#000',
    build: (cW, cH) => [
      { type: 'image', x: 0, y: 0, w: cW, h: cH, zIndex: 1, rotation: 0, opacity: 100, data: { src: '', alt: '画像をドロップ' } },
      { type: 'shape', x: 0, y: cH * 0.65, w: cW, h: cH * 0.35, zIndex: 2, rotation: 0, opacity: 100, data: { shapeType: 'rect', fill: 'rgba(0,0,0,0.5)', borderRadius: '0px' } },
      { type: 'text', x: cW * 0.06, y: cH * 0.7, w: cW * 0.88, h: cH * 0.15, zIndex: 3, rotation: 0, opacity: 100, data: { text: 'キャプションやタイトル', fontSize: '52px', color: '#ffffff', textAlign: 'left', fontWeight: '700' } },
      { type: 'text', x: cW * 0.06, y: cH * 0.86, w: cW * 0.6, h: cH * 0.1, zIndex: 3, rotation: 0, opacity: 100, data: { text: 'サブテキストを入力', fontSize: '24px', color: 'rgba(255,255,255,0.75)', textAlign: 'left', fontWeight: '400' } },
    ],
  },
  {
    id: 'section',
    label: 'セクション区切り',
    previewBg: ACCENT,
    build: (cW, cH) => [
      { type: 'shape', x: 0, y: 0, w: cW, h: cH, zIndex: 0, rotation: 0, opacity: 100, data: { shapeType: 'rect', fill: ACCENT } },
      { type: 'shape', x: 0, y: 0, w: cW * 0.04, h: cH, zIndex: 1, rotation: 0, opacity: 100, data: { shapeType: 'rect', fill: 'rgba(0,0,0,0.15)' } },
      { type: 'text', x: cW * 0.1, y: cH * 0.32, w: cW * 0.8, h: cH * 0.22, zIndex: 2, rotation: 0, opacity: 100, data: { text: 'Section 01', fontSize: '28px', color: 'rgba(255,255,255,0.6)', textAlign: 'left', fontWeight: '500' } },
      { type: 'text', x: cW * 0.1, y: cH * 0.46, w: cW * 0.8, h: cH * 0.22, zIndex: 2, rotation: 0, opacity: 100, data: { text: 'セクションタイトル', fontSize: '72px', color: '#ffffff', textAlign: 'left', fontWeight: '700' } },
    ],
  },
  {
    id: 'timeline',
    label: 'タイムライン',
    build: (cW, cH) => {
      const steps = ['Step 1', 'Step 2', 'Step 3', 'Step 4'];
      const dotY = cH * 0.5;
      const startX = cW * 0.08;
      const endX = cW * 0.92;
      const gap = (endX - startX) / (steps.length - 1);
      const els: TemplateElement[] = [
        { type: 'text', x: cW * 0.05, y: cH * 0.06, w: cW * 0.9, h: cH * 0.1, zIndex: 1, rotation: 0, opacity: 100, data: { text: 'プロセス・タイムライン', fontSize: '42px', color: '#1d1d1f', textAlign: 'center', fontWeight: '700' } },
        { type: 'line', x: startX, y: dotY, w: endX - startX, h: 0, zIndex: 2, rotation: 0, opacity: 100, data: { fill: '#d2d2d7', stroke: '#d2d2d7', strokeWidth: '2' } },
      ];
      steps.forEach((label, i) => {
        const cx = startX + gap * i;
        els.push(
          { type: 'shape', x: cx - 18, y: dotY - 18, w: 36, h: 36, zIndex: 3, rotation: 0, opacity: 100, data: { shapeType: 'circle', fill: ACCENT, border: `3px solid ${ACCENT}`, borderRadius: '50%' } },
          { type: 'text', x: cx - 80, y: dotY + 28, w: 160, h: cH * 0.08, zIndex: 4, rotation: 0, opacity: 100, data: { text: label, fontSize: '22px', color: '#1d1d1f', textAlign: 'center', fontWeight: '600' } },
          { type: 'text', x: cx - 80, y: i % 2 === 0 ? dotY - cH * 0.22 : dotY + 28 + cH * 0.09, w: 160, h: cH * 0.18, zIndex: 4, rotation: 0, opacity: 100, data: { text: '説明テキスト', fontSize: '18px', color: '#6e6e73', textAlign: 'center', fontWeight: '400' } },
        );
      });
      return els;
    },
  },
  {
    id: 'compare',
    label: '比較（A vs B）',
    build: (cW, cH) => [
      { type: 'text', x: cW * 0.05, y: cH * 0.04, w: cW * 0.9, h: cH * 0.1, zIndex: 1, rotation: 0, opacity: 100, data: { text: '比較・対照', fontSize: '42px', color: '#1d1d1f', textAlign: 'center', fontWeight: '700' } },
      { type: 'shape', x: cW * 0.03, y: cH * 0.17, w: cW * 0.44, h: cH * 0.76, zIndex: 2, rotation: 0, opacity: 100, data: { shapeType: 'rect', fill: '#f0f9ff', borderRadius: '16px', border: `2px solid ${ACCENT}` } },
      { type: 'text', x: cW * 0.03, y: cH * 0.2, w: cW * 0.44, h: cH * 0.1, zIndex: 3, rotation: 0, opacity: 100, data: { text: 'プランA', fontSize: '34px', color: ACCENT, textAlign: 'center', fontWeight: '700' } },
      { type: 'text', x: cW * 0.05, y: cH * 0.32, w: cW * 0.4, h: cH * 0.56, zIndex: 3, rotation: 0, opacity: 100, data: { text: '✓ 特徴1\n✓ 特徴2\n✓ 特徴3\n✗ デメリット1', fontSize: '22px', color: '#1d1d1f', textAlign: 'left', fontWeight: '400' } },
      { type: 'shape', x: cW * 0.53, y: cH * 0.17, w: cW * 0.44, h: cH * 0.76, zIndex: 2, rotation: 0, opacity: 100, data: { shapeType: 'rect', fill: '#fff8f0', borderRadius: '16px', border: '2px solid #ff9800' } },
      { type: 'text', x: cW * 0.53, y: cH * 0.2, w: cW * 0.44, h: cH * 0.1, zIndex: 3, rotation: 0, opacity: 100, data: { text: 'プランB', fontSize: '34px', color: '#ff9800', textAlign: 'center', fontWeight: '700' } },
      { type: 'text', x: cW * 0.55, y: cH * 0.32, w: cW * 0.4, h: cH * 0.56, zIndex: 3, rotation: 0, opacity: 100, data: { text: '✓ 特徴1\n✓ 特徴2\n✗ デメリット1\n✗ デメリット2', fontSize: '22px', color: '#1d1d1f', textAlign: 'left', fontWeight: '400' } },
      { type: 'text', x: cW * 0.47, y: cH * 0.45, w: cW * 0.06, h: cH * 0.1, zIndex: 4, rotation: 0, opacity: 100, data: { text: 'vs', fontSize: '28px', color: '#86868b', textAlign: 'center', fontWeight: '700' } },
    ],
  },
  {
    id: 'kpi',
    label: 'KPI / 数値ボード',
    build: (cW, cH) => [
      { type: 'text', x: cW * 0.05, y: cH * 0.04, w: cW * 0.9, h: cH * 0.1, zIndex: 1, rotation: 0, opacity: 100, data: { text: 'プロジェクト実績', fontSize: '42px', color: '#1d1d1f', textAlign: 'center', fontWeight: '700' } },
      ...([
        { val: '120%', label: '目標達成率', color: '#30d158' },
        { val: '3.2万', label: '総面積（㎡）', color: ACCENT },
        { val: '98点', label: '顧客満足度', color: '#ff9f0a' },
      ].map((item, i) => {
        const x = cW * (0.05 + i * 0.32);
        return [
          { type: 'shape' as const, x, y: cH * 0.2, w: cW * 0.28, h: cH * 0.6, zIndex: 2, rotation: 0, opacity: 100, data: { shapeType: 'rect' as const, fill: '#f5f5f7', borderRadius: '20px' } },
          { type: 'text' as const, x, y: cH * 0.32, w: cW * 0.28, h: cH * 0.2, zIndex: 3, rotation: 0, opacity: 100, data: { text: item.val, fontSize: '64px', color: item.color, textAlign: 'center' as const, fontWeight: '700' } },
          { type: 'text' as const, x, y: cH * 0.56, w: cW * 0.28, h: cH * 0.12, zIndex: 3, rotation: 0, opacity: 100, data: { text: item.label, fontSize: '22px', color: '#6e6e73', textAlign: 'center' as const, fontWeight: '500' } },
        ];
      })).flat(),
    ],
  },
  {
    id: 'quote',
    label: '引用スライド',
    previewBg: '#1d1d1f',
    build: (cW, cH) => [
      { type: 'shape', x: 0, y: 0, w: cW, h: cH, zIndex: 0, rotation: 0, opacity: 100, data: { shapeType: 'rect', fill: '#1d1d1f' } },
      { type: 'text', x: cW * 0.08, y: cH * 0.08, w: cW * 0.12, h: cH * 0.22, zIndex: 1, rotation: 0, opacity: 100, data: { text: '"', fontSize: '200px', color: ACCENT, textAlign: 'left', fontWeight: '700' } },
      { type: 'text', x: cW * 0.1, y: cH * 0.26, w: cW * 0.8, h: cH * 0.38, zIndex: 2, rotation: 0, opacity: 100, data: { text: 'デザインとは、単なる見た目ではなく、\nどのように機能するかである。', fontSize: '40px', color: '#ffffff', textAlign: 'center', fontWeight: '500' } },
      { type: 'line', x: cW * 0.35, y: cH * 0.68, w: cW * 0.3, h: 0, zIndex: 3, rotation: 0, opacity: 100, data: { fill: ACCENT, stroke: ACCENT, strokeWidth: '2' } },
      { type: 'text', x: cW * 0.1, y: cH * 0.72, w: cW * 0.8, h: cH * 0.1, zIndex: 2, rotation: 0, opacity: 100, data: { text: '— 出典・著者名', fontSize: '22px', color: 'rgba(255,255,255,0.55)', textAlign: 'center', fontWeight: '400' } },
    ],
  },
  {
    id: 'grid4',
    label: '4グリッド',
    build: (cW, cH) => {
      const cells = [
        { label: 'アイテム1', icon: '📐' }, { label: 'アイテム2', icon: '🏗️' },
        { label: 'アイテム3', icon: '🌿' }, { label: 'アイテム4', icon: '💡' },
      ];
      const pad = cW * 0.04;
      const cellW = (cW - pad * 3) / 2;
      const cellH = (cH * 0.8 - pad) / 2;
      return [
        { type: 'text', x: pad, y: cH * 0.03, w: cW - pad * 2, h: cH * 0.1, zIndex: 1, rotation: 0, opacity: 100, data: { text: 'セクションタイトル', fontSize: '40px', color: '#1d1d1f', textAlign: 'center', fontWeight: '700' } },
        ...cells.map((c, i): TemplateElement[] => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = pad + col * (cellW + pad);
          const y = cH * 0.16 + row * (cellH + pad);
          return [
            { type: 'shape', x, y, w: cellW, h: cellH, zIndex: 2, rotation: 0, opacity: 100, data: { shapeType: 'rect', fill: '#f5f5f7', borderRadius: '16px' } } as TemplateElement,
            { type: 'text', x: x + 20, y: y + 20, w: cellW - 40, h: cellH * 0.3, zIndex: 3, rotation: 0, opacity: 100, data: { text: c.icon, fontSize: '48px', color: '#1d1d1f', textAlign: 'center', fontWeight: '400' } } as TemplateElement,
            { type: 'text', x: x + 20, y: y + cellH * 0.42, w: cellW - 40, h: cellH * 0.2, zIndex: 3, rotation: 0, opacity: 100, data: { text: c.label, fontSize: '26px', color: '#1d1d1f', textAlign: 'center', fontWeight: '600' } } as TemplateElement,
            { type: 'text', x: x + 20, y: y + cellH * 0.62, w: cellW - 40, h: cellH * 0.3, zIndex: 3, rotation: 0, opacity: 100, data: { text: '説明文をここに入力します。', fontSize: '18px', color: '#6e6e73', textAlign: 'center', fontWeight: '400' } } as TemplateElement,
          ];
        }).flat(),
      ];
    },
  },
];

const TEXT_TEMPLATES: DesignTemplate[] = [
  {
    id: 'h1',
    label: '大見出し (H1)',
    build: (cW) => [{ type: 'text', x: cW * 0.05, y: 100, w: cW * 0.9, h: 100, zIndex: 10, rotation: 0, opacity: 100, data: { text: '大見出しテキスト', fontSize: '72px', color: '#1d1d1f', textAlign: 'left', fontWeight: '700' } }],
  },
  {
    id: 'h2',
    label: '中見出し (H2)',
    build: (cW) => [{ type: 'text', x: cW * 0.05, y: 100, w: cW * 0.9, h: 80, zIndex: 10, rotation: 0, opacity: 100, data: { text: '中見出しテキスト', fontSize: '48px', color: '#1d1d1f', textAlign: 'left', fontWeight: '600' } }],
  },
  {
    id: 'body',
    label: '本文テキスト',
    build: (cW) => [{ type: 'text', x: cW * 0.05, y: 100, w: cW * 0.9, h: 200, zIndex: 10, rotation: 0, opacity: 100, data: { text: '本文テキストをここに入力します。プロジェクトの概要や詳細説明など。', fontSize: '28px', color: '#3a3a3c', textAlign: 'left', fontWeight: '400' } }],
  },
  {
    id: 'caption',
    label: 'キャプション',
    build: (cW) => [{ type: 'text', x: cW * 0.05, y: 100, w: cW * 0.9, h: 60, zIndex: 10, rotation: 0, opacity: 100, data: { text: 'キャプションや補足説明', fontSize: '18px', color: '#86868b', textAlign: 'left', fontWeight: '400' } }],
  },
  {
    id: 'accent_box',
    label: '強調ボックス',
    build: (cW) => [{ type: 'text', x: cW * 0.05, y: 100, w: cW * 0.5, h: 120, zIndex: 10, rotation: 0, opacity: 100, data: { text: '重要なポイントやCTA', fontSize: '28px', color: '#ffffff', textAlign: 'center', fontWeight: '600', bgcolor: ACCENT, borderRadius: '12px', padding: 2, boxShadow: '0 4px 24px rgba(41,182,246,0.3)' } }],
  },
  {
    id: 'sticky',
    label: '付箋メモ',
    build: () => [{ type: 'text', x: 200, y: 200, w: 200, h: 200, zIndex: 10, rotation: 0, opacity: 100, data: { text: 'アイデア・メモ', fontSize: '20px', color: '#1d1d1f', textAlign: 'center', bgcolor: '#fff9c4', borderRadius: '8px', padding: 2, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' } }],
  },
  {
    id: 'section_header',
    label: 'セクションヘッダー',
    build: (cW, cH) => [
      { type: 'line', x: cW * 0.05, y: 110, w: 40, h: 0, zIndex: 9, rotation: 0, opacity: 100, data: { fill: ACCENT, stroke: ACCENT, strokeWidth: '5' } },
      { type: 'text', x: cW * 0.05 + 56, y: 90, w: cW * 0.8, h: 70, zIndex: 10, rotation: 0, opacity: 100, data: { text: 'セクションタイトル', fontSize: '40px', color: '#1d1d1f', textAlign: 'left', fontWeight: '700' } },
    ],
  },
  {
    id: 'badge',
    label: 'バッジ＋テキスト',
    build: () => [
      { type: 'shape', x: 200, y: 200, w: 44, h: 44, zIndex: 10, rotation: 0, opacity: 100, data: { shapeType: 'circle', fill: ACCENT, borderRadius: '50%' } },
      { type: 'text', x: 200, y: 200, w: 44, h: 44, zIndex: 11, rotation: 0, opacity: 100, data: { text: '1', fontSize: '22px', color: '#fff', textAlign: 'center', fontWeight: '700' } },
      { type: 'text', x: 256, y: 208, w: 300, h: 44, zIndex: 11, rotation: 0, opacity: 100, data: { text: 'ポイントテキスト', fontSize: '26px', color: '#1d1d1f', textAlign: 'left', fontWeight: '600' } },
    ],
  },
];

const SHAPE_TEMPLATES: DesignTemplate[] = [
  {
    id: 'divider',
    label: '区切り線',
    build: (cW, cH) => [{ type: 'line', x: cW * 0.05, y: cH * 0.5, w: cW * 0.9, h: 0, zIndex: 10, rotation: 0, opacity: 100, data: { fill: '#d2d2d7', stroke: '#d2d2d7', strokeWidth: '1' } }],
  },
  {
    id: 'accent_line',
    label: 'アクセントライン',
    build: (cW, cH) => [{ type: 'line', x: cW * 0.05, y: cH * 0.5, w: cW * 0.15, h: 0, zIndex: 10, rotation: 0, opacity: 100, data: { fill: ACCENT, stroke: ACCENT, strokeWidth: '6' } }],
  },
  {
    id: 'card_light',
    label: '角丸ボックス（ライト）',
    build: () => [{ type: 'shape', x: 200, y: 200, w: 300, h: 200, zIndex: 10, rotation: 0, opacity: 100, data: { shapeType: 'rect', fill: '#f5f5f7', borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' } }],
  },
  {
    id: 'card_dark',
    label: '角丸ボックス（ダーク）',
    build: () => [{ type: 'shape', x: 200, y: 200, w: 300, h: 200, zIndex: 10, rotation: 0, opacity: 100, data: { shapeType: 'rect', fill: '#1d1d1f', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.24)' } }],
  },
  {
    id: 'circle',
    label: 'サークル',
    build: () => [{ type: 'shape', x: 300, y: 200, w: 120, h: 120, zIndex: 10, rotation: 0, opacity: 100, data: { shapeType: 'circle', fill: ACCENT, borderRadius: '50%' } }],
  },
  {
    id: 'pill',
    label: 'ピル（ラベル）',
    build: () => [{ type: 'shape', x: 200, y: 200, w: 200, h: 56, zIndex: 10, rotation: 0, opacity: 100, data: { shapeType: 'rect', fill: 'rgba(41,182,246,0.15)', borderRadius: '28px', border: `2px solid ${ACCENT}` } }],
  },
];

// ─── Template Tab Type ────────────────────────────────────────────────────────

type TemplateTabType = 'layouts' | 'images' | 'texts' | 'shapes' | 'models';

// ─── Template Card ─────────────────────────────────────────────────────────────

const TemplateCard: React.FC<{ template: DesignTemplate; onAdd: (t: DesignTemplate) => void; bg?: string }> = ({ template, onAdd, bg }) => (
  <Box
    onClick={() => onAdd(template)}
    title={template.label}
    sx={{
      width: 80, height: 54,
      borderRadius: 1.5,
      border: '1px solid rgba(255,255,255,0.1)',
      bgcolor: bg || '#f5f5f7',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      transition: 'all 0.15s',
      '&:hover': { borderColor: ACCENT, boxShadow: `0 0 0 2px ${ACCENT}44`, transform: 'scale(1.04)' },
    }}
  >
    <Typography sx={{ fontSize: 9, color: bg ? '#fff' : '#3a3a3c', textAlign: 'center', lineHeight: 1.3, px: 0.5, fontWeight: 500 }}>
      {template.label}
    </Typography>
  </Box>
);

// ─── Asset Thumbnail ───────────────────────────────────────────────────────────

const AssetThumb: React.FC<{ asset: any; onAdd: () => void }> = ({ asset, onAdd }) => {
  const url = resolveAssetPreviewUrl(asset) || '';
  return (
    <Box
      onClick={onAdd}
      title={asset.name || asset.title || ''}
      sx={{
        width: 72, height: 72, borderRadius: 1.5, overflow: 'hidden', flexShrink: 0,
        border: '1px solid rgba(255,255,255,0.08)',
        bgcolor: '#2a2a2a', cursor: 'pointer',
        transition: 'all 0.15s',
        '&:hover': { borderColor: ACCENT, transform: 'scale(1.05)' },
      }}
    >
      {url ? (
        <Box component="img" src={url} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 9, color: 'text.secondary', textAlign: 'center', px: 0.5 }}>{asset.name || 'Model'}</Typography>
        </Box>
      )}
    </Box>
  );
};

// ─── Main Inspector Component ──────────────────────────────────────────────────

type TopTabType = 'properties' | 'deck' | 'parts' | 'layers';

export const PresentsInspector: React.FC = () => {
  const { presentation, selectedPageId, selectedElementIds, updateElements, addElement, addElements, projectId, inspectorActiveTopTab, setInspectorActiveTopTab, showRightSidebar, replacePresentation, appendPages } = useDspStore();
  const allAssets = useAIDriveStore(s => s.assets);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const [templateTab, setTemplateTab] = useState<TemplateTabType>('layouts');

  useEffect(() => {
    if (!showRightSidebar) {
      setPortalNode(null);
      return;
    }
    let unmounted = false;
    let timer: any = null;
    const findNode = () => {
      if (unmounted) return;
      const node = document.getElementById('dsp-right-sidebar-portal');
      if (node) { setPortalNode(node); } else { timer = setTimeout(findNode, 100); }
    };
    findNode();
    return () => { unmounted = true; if (timer) clearTimeout(timer); };
  }, [showRightSidebar]);

  // AI Drive assets — projectId フィルタなし、全非削除アセットを対象にする
  const imageAssets = React.useMemo(() =>
    allAssets.filter(a =>
      !(a as any).isDeleted &&
      ((a as any).itemType === 'image' || (a as any).category === 'image' || a.type === 'image' || (a.name || '').match(/\.(png|jpg|jpeg|gif|webp|svg)/i))
    ),
    [allAssets]
  );

  const modelAssets = React.useMemo(() =>
    allAssets.filter(a =>
      !(a as any).isDeleted &&
      ((a as any).itemType === 'model' || (a as any).category === 'model' || (a as any).toolType || a.type === 'model' || (a as any).appScope)
    ).slice(0, 30),
    [allAssets]
  );

  if (!portalNode) return null;

  const page = presentation?.pages.find(p => p.id === selectedPageId);
  const element = page?.elements.find(e => e.id === selectedElementIds[0]);
  const canvasW = presentation?.canvasSize?.width || 1587;
  const canvasH = presentation?.canvasSize?.height || 1122;

  const applyLayoutTemplate = (t: DesignTemplate) => {
    if (!selectedPageId) return;
    addElements(selectedPageId, t.build(canvasW, canvasH));
  };

  const addAssetImage = (asset: any) => {
    if (!selectedPageId) return;
    const url = resolveAssetPreviewUrl(asset) || '';
    addElement(selectedPageId, {
      type: 'image',
      x: canvasW * 0.1, y: canvasH * 0.1, w: 400, h: 300, zIndex: 10, rotation: 0, opacity: 100,
      data: { src: url, alt: asset.name || '', assetId: asset.id, name: asset.name || '' }
    });
  };

  const addAssetModel = (asset: any) => {
    if (!selectedPageId) return;
    const url = resolveAssetPreviewUrl(asset) || '';
    addElement(selectedPageId, {
      type: 'modelCard',
      x: canvasW * 0.1, y: canvasH * 0.1, w: 280, h: 280, zIndex: 10, rotation: 0, opacity: 100,
      data: { title: asset.name || asset.title || 'Model', subtitle: asset.toolType || asset.type || '', thumbnailUrl: url }
    });
  };

  // ─── Deck tab (full deck templates) ─────────────────────────────────────────
  const renderDeck = () => (
    <DeckTemplatePanel
      canvasW={canvasW}
      canvasH={canvasH}
      presentation={presentation}
      onApplyTemplate={(content, mode) => {
        if (mode === 'replace') replacePresentation(content);
        else appendPages(content.pages);
      }}
    />
  );

  // ─── Parts tab definitions (layouts / images / texts / shapes / models) ─────
  type PartsTabType = 'layouts' | 'images' | 'texts' | 'shapes' | 'models';
  const PARTS_TABS: { key: PartsTabType; label: string; icon: React.ReactNode }[] = [
    { key: 'layouts', label: 'レイアウト', icon: <ViewQuiltRoundedIcon  sx={{ fontSize: 14 }} /> },
    { key: 'images',  label: '画像',       icon: <ImageRoundedIcon      sx={{ fontSize: 14 }} /> },
    { key: 'texts',   label: 'テキスト',   icon: <TextFieldsRoundedIcon sx={{ fontSize: 14 }} /> },
    { key: 'shapes',  label: '図形',       icon: <CategoryRoundedIcon   sx={{ fontSize: 14 }} /> },
    { key: 'models',  label: '3Dモデル',   icon: <ViewInArIcon          sx={{ fontSize: 14 }} /> },
  ];

  const renderMaterials = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── タブバー ────────────────────────────────────────────────────────── */}
      <Box sx={{ flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Tabs
          value={templateTab}
          onChange={(_, v) => setTemplateTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 38,
            '& .MuiTabs-indicator': { bgcolor: ACCENT, height: 2 },
            '& .MuiTabs-scrollButtons': { color: 'rgba(255,255,255,0.3)' },
          }}
        >
          {PARTS_TABS.map(t => (
            <Tab
              key={t.key}
              value={t.key}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {t.icon}
                  <span>{t.label}</span>
                </Box>
              }
              sx={{
                minHeight: 38,
                py: 0.5,
                px: 1,
                minWidth: 0,
                fontSize: 11,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.4)',
                textTransform: 'none',
                '&.Mui-selected': { color: ACCENT },
              }}
            />
          ))}
        </Tabs>
      </Box>

      {/* ── タブコンテンツ ───────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>

        {/* レイアウト */}
        {templateTab === 'layouts' && (
          <Box sx={{ p: 1.5 }}>
            {LAYOUT_TEMPLATES.length === 0 ? (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', textAlign: 'center', mt: 4 }}>
                レイアウトテンプレートはありません
              </Typography>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                {LAYOUT_TEMPLATES.map(t => (
                  <TemplateCard key={t.id} template={t} onAdd={applyLayoutTemplate} bg={t.previewBg} />
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* AI Drive 画像 */}
        {templateTab === 'images' && (
          <Box sx={{ p: 1.5 }}>
            {imageAssets.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <ImageRoundedIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.12)', mb: 1 }} />
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.6 }}>
                  AI Drive に画像を追加すると<br />ここに表示されます
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75 }}>
                {imageAssets.map(a => (
                  <AssetThumb key={a.id} asset={a} onAdd={() => addAssetImage(a)} />
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* テキスト素材 */}
        {templateTab === 'texts' && (
          <Box sx={{ p: 1.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
              {TEXT_TEMPLATES.map(t => (
                <TemplateCard key={t.id} template={t} onAdd={applyLayoutTemplate} />
              ))}
            </Box>
          </Box>
        )}

        {/* 図形素材 */}
        {templateTab === 'shapes' && (
          <Box sx={{ p: 1.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
              {SHAPE_TEMPLATES.map(t => (
                <TemplateCard key={t.id} template={t} onAdd={applyLayoutTemplate} />
              ))}
            </Box>
          </Box>
        )}

        {/* 3Dモデル */}
        {templateTab === 'models' && (
          <Box sx={{ p: 1.5 }}>
            {modelAssets.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <ViewInArIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.12)', mb: 1 }} />
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.6 }}>
                  AI Drive に3Dモデルを追加すると<br />ここに表示されます
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75 }}>
                {modelAssets.map(a => (
                  <AssetThumb key={a.id} asset={a} onAdd={() => addAssetModel(a)} />
                ))}
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );

  const renderProperties = () => {
    const handleChange = (key: string, value: any) => {
      updateElements(selectedElementIds.map(id => ({ id, updates: { [key]: value } })));
    };

    if (!element) {
      return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>キャンバス設定</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13, mb: 2, mt: 1 }}>
              要素を選択していない場合は、スライド全体のキャンバスサイズを変更できます。
            </Typography>
            <TextField
              select fullWidth size="small" label="キャンバスサイズ"
              value={`${canvasW}x${canvasH}`}
              onChange={(e) => {
                const [w, h] = e.target.value.split('x').map(Number);
                const names: Record<string, string> = { '1587x1122': 'A3 横 (Landscape)', '1122x1587': 'A3 縦 (Portrait)', '1122x794': 'A4 横 (Landscape)', '794x1122': 'A4 縦 (Portrait)', '1200x675': '16:9 スクリーン' };
                useDspStore.getState().setCanvasSize({ width: w, height: h, name: names[`${w}x${h}`] || 'カスタム' });
              }}
              InputProps={{ sx: { color: 'white', fontSize: 13 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }}
            >
              <MenuItem value="1587x1122">A3 横 (Landscape)</MenuItem>
              <MenuItem value="1122x1587">A3 縦 (Portrait)</MenuItem>
              <MenuItem value="1122x794">A4 横 (Landscape)</MenuItem>
              <MenuItem value="794x1122">A4 縦 (Portrait)</MenuItem>
              <MenuItem value="1200x675">16:9 スクリーン</MenuItem>
            </TextField>
          </Box>
        </Box>
      );
    }

    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box>
          <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>位置とサイズ</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            <TextField label="X" size="small" type="number" value={element.x} onChange={e => handleChange('x', Number(e.target.value))} InputProps={{ sx: { color: 'white', fontSize: 13 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }} />
            <TextField label="Y" size="small" type="number" value={element.y} onChange={e => handleChange('y', Number(e.target.value))} InputProps={{ sx: { color: 'white', fontSize: 13 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }} />
            <TextField label="幅 (W)" size="small" type="number" value={element.w} onChange={e => handleChange('w', Number(e.target.value))} InputProps={{ sx: { color: 'white', fontSize: 13 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }} />
            <TextField label="高さ (H)" size="small" type="number" value={element.h} onChange={e => handleChange('h', Number(e.target.value))} InputProps={{ sx: { color: 'white', fontSize: 13 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', width: 60, fontSize: 12 }}>不透明度</Typography>
            <Slider size="small" value={element.opacity ?? 100} min={0} max={100} onChange={(_, v) => handleChange('opacity', v)} />
            <Typography variant="body2" sx={{ width: 30, textAlign: 'right', fontSize: 12 }}>{element.opacity ?? 100}%</Typography>
          </Box>
        </Box>

        <Divider sx={{ borderColor: BRAND.line }} />

        {element.type === 'text' && (
          <Box>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>テキスト設定</Typography>
            <TextField label="テキスト内容" size="small" multiline rows={3} value={(element.data as any).text || ''} onChange={e => handleChange('data', { ...element.data, text: e.target.value })} fullWidth sx={{ mt: 1, mb: 2 }} InputProps={{ sx: { color: 'white', fontSize: 13 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }} />
            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <TextField label="フォントサイズ" size="small" value={(element.data as any).fontSize || '16px'} onChange={e => handleChange('data', { ...element.data, fontSize: e.target.value })} fullWidth InputProps={{ sx: { color: 'white', fontSize: 13 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }} />
              <TextField label="色" size="small" type="color" value={(element.data as any).color || '#ffffff'} onChange={e => handleChange('data', { ...element.data, color: e.target.value })} fullWidth sx={{ '& input': { p: 0, height: 36 } }} InputProps={{ sx: { color: 'white', fontSize: 13 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, mt: 2, bgcolor: 'rgba(255,255,255,0.05)', p: 0.5, borderRadius: 1 }}>
              <IconButton size="small" onClick={() => handleChange('data', { ...element.data, textAlign: 'left' })} sx={{ color: (element.data as any).textAlign === 'left' ? ACCENT : 'text.secondary' }}><FormatAlignLeftIcon fontSize="small" /></IconButton>
              <IconButton size="small" onClick={() => handleChange('data', { ...element.data, textAlign: 'center' })} sx={{ color: (!(element.data as any).textAlign || (element.data as any).textAlign === 'center') ? ACCENT : 'text.secondary' }}><FormatAlignCenterIcon fontSize="small" /></IconButton>
              <IconButton size="small" onClick={() => handleChange('data', { ...element.data, textAlign: 'right' })} sx={{ color: (element.data as any).textAlign === 'right' ? ACCENT : 'text.secondary' }}><FormatAlignRightIcon fontSize="small" /></IconButton>
            </Box>
          </Box>
        )}

        {element.type === 'link' && (
          <Box>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>リンク設定</Typography>
            <TextField label="URL" size="small" value={(element.data as any).url || ''} onChange={e => handleChange('data', { ...element.data, url: e.target.value })} fullWidth sx={{ mt: 1, mb: 2 }} InputProps={{ sx: { color: 'white', fontSize: 13 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }} />
            <TextField label="表示テキスト" size="small" value={(element.data as any).text || ''} onChange={e => handleChange('data', { ...element.data, text: e.target.value })} fullWidth sx={{ mb: 2 }} InputProps={{ sx: { color: 'white', fontSize: 13 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }} />
            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <TextField label="フォントサイズ" size="small" value={(element.data as any).fontSize || '14px'} onChange={e => handleChange('data', { ...element.data, fontSize: e.target.value })} fullWidth InputProps={{ sx: { color: 'white', fontSize: 13 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }} />
              <TextField label="色" size="small" type="color" value={(element.data as any).color || '#007aff'} onChange={e => handleChange('data', { ...element.data, color: e.target.value })} fullWidth sx={{ '& input': { p: 0, height: 36 } }} InputProps={{ sx: { color: 'white', fontSize: 13 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }} />
            </Box>
          </Box>
        )}

        {element.type === 'image' && (
          <Box>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>画像</Typography>

            {/* Upload / replace button */}
            <Box
              onClick={() => {
                const auth = require('firebase/auth').getAuth();
                const userId = auth.currentUser?.uid;
                if (!projectId || !userId) return;
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (ev: any) => {
                  const file = ev.target.files?.[0];
                  if (!file) return;
                  try {
                    const { dspAssetUploadService } = await import('../upload/dspAssetUploadService');
                    const result = await dspAssetUploadService.uploadLocalImage(projectId!, file, userId!);
                    updateElements([{ id: element.id, updates: { data: { ...element.data, src: result.src, assetId: result.assetId, storagePath: result.storagePath, mimeType: result.mimeType, name: result.name } } }], true);
                  } catch(e) { console.error(e); }
                };
                input.click();
              }}
              sx={{ mt: 1, mb: 1.5, p: 1.5, borderRadius: 1.5, border: `1px dashed ${ACCENT}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'rgba(41,182,246,0.05)', '&:hover': { bgcolor: 'rgba(41,182,246,0.12)' }, transition: 'all 0.15s' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <Typography sx={{ color: ACCENT, fontSize: 13, fontWeight: 600 }}>
                {(element.data as any).src ? '画像を差し替え' : 'ファイルから画像を追加'}
              </Typography>
            </Box>

            {/* Current image preview */}
            {(element.data as any).src && (
              <Box sx={{ mb: 1.5, borderRadius: 1, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Box component="img" src={(element.data as any).src} sx={{ width: '100%', maxHeight: 120, objectFit: 'cover', display: 'block' }} />
                <Box sx={{ p: 1, bgcolor: 'rgba(255,255,255,0.03)' }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{(element.data as any).name || 'image'}</Typography>
                </Box>
              </Box>
            )}

            {/* AI Drive image candidates */}
            {imageAssets.length > 0 && (
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                  AI Drive から選択 ({imageAssets.length}件):
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75, maxHeight: 220, overflowY: 'auto', pr: 0.5 }}>
                  {imageAssets.map(a => {
                    const url = resolveAssetPreviewUrl(a) || '';
                    return (
                      <Box
                        key={a.id}
                        onClick={() => updateElements([{ id: element.id, updates: { data: { ...element.data, src: url, assetId: a.id, name: a.name || '' } } }], true)}
                        title={a.name || ''}
                        sx={{ aspectRatio: '1', borderRadius: 1, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', '&:hover': { borderColor: ACCENT, transform: 'scale(1.04)' }, transition: 'all 0.15s', bgcolor: '#222' }}
                      >
                        {url
                          ? <Box component="img" src={url} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Typography sx={{ fontSize: 8, color: 'text.secondary', textAlign: 'center', px: 0.25 }}>{a.name}</Typography></Box>
                        }
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}
          </Box>
        )}

        {(element.type === 'image' || element.type === 'shape' || element.type === 'modelCard') && (
          <Box>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>表示設定</Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <TextField label="背景色/塗りの色" size="small" type="color" value={(element.data as any).fill || '#000000'} onChange={e => handleChange('data', { ...element.data, fill: e.target.value })} fullWidth sx={{ '& input': { p: 0, height: 36 } }} InputProps={{ sx: { color: 'white', fontSize: 13 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }} />
            </Box>
          </Box>
        )}

        {element.type === 'line' && (
          <Box>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>線の設定</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField label="線の色" size="small" type="color" value={(element.data as any).stroke || '#86868b'} onChange={e => handleChange('data', { ...element.data, stroke: e.target.value })} fullWidth sx={{ '& input': { p: 0, height: 36 } }} InputProps={{ sx: { color: 'white', fontSize: 13 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }} />
                <TextField label="太さ" size="small" type="number" value={parseInt((element.data as any).strokeWidth || '3')} onChange={e => handleChange('data', { ...element.data, strokeWidth: e.target.value })} fullWidth InputProps={{ sx: { color: 'white', fontSize: 13 }, inputProps: { min: 1, max: 20 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }} />
              </Box>
              <TextField select label="種類" size="small" value={(element.data as any).strokeDasharray || 'none'} onChange={e => handleChange('data', { ...element.data, strokeDasharray: e.target.value })} fullWidth InputProps={{ sx: { color: 'white', fontSize: 13 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }} SelectProps={{ MenuProps: { PaperProps: { sx: { bgcolor: '#2A2A2A', border: '1px solid #444', color: '#fff' } } } }}>
                <MenuItem value="none">実線 (Solid)</MenuItem>
                <MenuItem value="5,5">点線 (Dotted)</MenuItem>
                <MenuItem value="15,10">破線 (Dashed)</MenuItem>
              </TextField>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1, bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                <Typography sx={{ color: 'text.primary', fontSize: 13 }}>矢印を表示</Typography>
                <Switch size="small" checked={(element.data as any).showArrow || false} onChange={e => handleChange('data', { ...element.data, showArrow: e.target.checked })} />
              </Box>
            </Box>
          </Box>
        )}

        {element.type === 'drawing' && (
          <Box>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>手書き設定</Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <TextField label="線の色" size="small" type="color" value={(element.data as any).stroke || '#1d1d1f'} onChange={e => handleChange('data', { ...element.data, stroke: e.target.value })} fullWidth sx={{ '& input': { p: 0, height: 36 } }} InputProps={{ sx: { color: 'white', fontSize: 13 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }} />
              <TextField label="太さ" size="small" type="number" value={(element.data as any).strokeWidth || 3} onChange={e => handleChange('data', { ...element.data, strokeWidth: Number(e.target.value) })} fullWidth InputProps={{ sx: { color: 'white', fontSize: 13 }, inputProps: { min: 1, max: 20 } }} InputLabelProps={{ sx: { color: 'text.secondary' } }} />
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  const renderLayers = () => {
    if (!page || page.elements.length === 0) {
      return <Typography variant="caption" color="text.secondary" sx={{ p: 2, display: 'block' }}>レイヤーはありません</Typography>;
    }
    return (
      <Box sx={{ p: 1 }}>
        {[...page.elements].reverse().map(el => (
          <Box
            key={el.id}
            sx={{ px: 2, py: 1, my: 0.5, borderRadius: 1, bgcolor: selectedElementIds.includes(el.id) ? 'rgba(41,182,246,0.15)' : 'rgba(255,255,255,0.02)', border: `1px solid ${selectedElementIds.includes(el.id) ? ACCENT : 'transparent'}`, cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}
            onClick={(e) => {
              if (e.shiftKey) {
                const newIds = selectedElementIds.includes(el.id) ? selectedElementIds.filter(id => id !== el.id) : [...selectedElementIds, el.id];
                useDspStore.getState().setSelectedElementIds(newIds);
              } else {
                useDspStore.getState().setSelectedElementIds([el.id]);
              }
            }}
          >
            <Typography variant="body2" sx={{ color: selectedElementIds.includes(el.id) ? ACCENT : 'text.primary', fontSize: 13 }}>
              {el.type === 'text' ? 'テキスト' : el.type === 'shape' ? '図形' : el.type === 'image' ? '画像' : el.type === 'line' ? '線' : el.type === 'link' ? 'リンク' : el.type === 'drawing' ? '手書き' : el.type} (z:{el.zIndex ?? 0})
            </Typography>
            {el.type === 'text' && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {(el.data as any).text || 'Blank'}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    );
  };

  const content = (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: BRAND.bg, overflowY: 'auto' }}>
      {inspectorActiveTopTab === 'properties' && renderProperties()}
      {inspectorActiveTopTab === 'deck' && renderDeck()}
      {inspectorActiveTopTab === 'parts' && renderMaterials()}
      {inspectorActiveTopTab === 'layers' && renderLayers()}
    </Box>
  );

  return createPortal(content, portalNode);
};
