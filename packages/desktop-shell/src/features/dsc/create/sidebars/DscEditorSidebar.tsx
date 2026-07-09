// @ts-nocheck
import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import { useDscStore } from '../../store/useDscStore';
import { BRAND } from '../../../../styles/theme';
import { CommunityTemplatesTab } from './CommunityTemplatesTab';

const ACCENT = '#ffa726';
type TabKey = 'parts' | 'templates' | 'layers' | 'community';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const d3 = (w, h, d) => ({ width: w, height: h, depth: d });
const p3 = (x, y, z) => [x, y, z];
let _ctr = 0;
const freshId = () => `comp_${Date.now()}_${++_ctr}`;

// ─── Part sections ──────────────────────────────────────────────────────────────

const PART_SECTIONS = [
  {
    label: '板材',
    parts: [
      { type: 'top_board',    label: '天板',   desc: '800×24×400 mm' },
      { type: 'bottom_board', label: '底板',   desc: '764×18×400 mm' },
      { type: 'side_panel',   label: '側板',   desc: '18×720×400 mm' },
      { type: 'back_panel',   label: '背板',   desc: '764×720×9 mm'  },
      { type: 'panel',        label: '水平板', desc: '400×18×350 mm' },
      { type: 'shelf',        label: '棚板',   desc: '400×18×300 mm' },
    ],
  },
  {
    label: 'フレーム・扉',
    parts: [
      { type: 'leg',   label: '脚',         desc: '60×700×60 mm'  },
      { type: 'frame', label: '縦フレーム', desc: '30×720×30 mm'  },
      { type: 'door',  label: '扉',         desc: '300×600×18 mm' },
    ],
  },
];

// ─── Template data ──────────────────────────────────────────────────────────────
// 3DSS categoryOptions に準拠したカテゴリ編成（全 35 テンプレート）

const TEMPLATE_CATEGORIES = [
  // ──────────────────────────────────────────────────
  // ソファ・ロビーチェア
  // ──────────────────────────────────────────────────
  {
    category: 'ソファ・ロビーチェア',
    catColor: '#6a5a9a',
    templates: [
      {
        key: 'sofa_1p', label: '1人掛けソファ', desc: 'W750×H780×D700', color: '#5a5a8a',
        components: [
          { type: 'panel',      name: 'ベース',       dimensions: d3(750,400,700), position: p3(0,0,0),       color: '#4a4a7a' },
          { type: 'side_panel', name: '左アーム',     dimensions: d3(100,200,700), position: p3(-325,400,0),  color: '#4a4a7a' },
          { type: 'side_panel', name: '右アーム',     dimensions: d3(100,200,700), position: p3(325,400,0),   color: '#4a4a7a' },
          { type: 'back_panel', name: '背もたれ',     dimensions: d3(750,380,100), position: p3(0,400,300),   color: '#5a5a8a' },
          { type: 'panel',      name: '座クッション', dimensions: d3(530,90,560),  position: p3(0,400,-20),   color: '#6a6a9a' },
        ],
      },
      {
        key: 'sofa_2p', label: '2人掛けソファ', desc: 'W1400×H780×D700', color: '#5a5a8a',
        components: [
          { type: 'panel',      name: 'ベース',           dimensions: d3(1400,400,700), position: p3(0,0,0),        color: '#4a4a7a' },
          { type: 'side_panel', name: '左アーム',         dimensions: d3(100,200,700),  position: p3(-600,400,0),   color: '#4a4a7a' },
          { type: 'side_panel', name: '右アーム',         dimensions: d3(100,200,700),  position: p3(600,400,0),    color: '#4a4a7a' },
          { type: 'back_panel', name: '背もたれ',         dimensions: d3(1400,380,100), position: p3(0,400,300),    color: '#5a5a8a' },
          { type: 'panel',      name: '左座クッション',   dimensions: d3(555,90,560),   position: p3(-302,400,-20), color: '#6a6a9a' },
          { type: 'panel',      name: '右座クッション',   dimensions: d3(555,90,560),   position: p3(302,400,-20),  color: '#6a6a9a' },
        ],
      },
      {
        key: 'sofa_3p', label: '3人掛けソファ', desc: 'W2050×H780×D700', color: '#5a5a8a',
        components: [
          { type: 'panel',      name: 'ベース',           dimensions: d3(2050,400,700), position: p3(0,0,0),        color: '#4a4a7a' },
          { type: 'side_panel', name: '左アーム',         dimensions: d3(100,200,700),  position: p3(-875,400,0),   color: '#4a4a7a' },
          { type: 'side_panel', name: '右アーム',         dimensions: d3(100,200,700),  position: p3(875,400,0),    color: '#4a4a7a' },
          { type: 'back_panel', name: '背もたれ',         dimensions: d3(2050,380,100), position: p3(0,400,300),    color: '#5a5a8a' },
          { type: 'panel',      name: '左座クッション',   dimensions: d3(560,90,560),   position: p3(-590,400,-20), color: '#6a6a9a' },
          { type: 'panel',      name: '中座クッション',   dimensions: d3(560,90,560),   position: p3(0,400,-20),    color: '#6a6a9a' },
          { type: 'panel',      name: '右座クッション',   dimensions: d3(560,90,560),   position: p3(590,400,-20),  color: '#6a6a9a' },
        ],
      },
      {
        key: 'lobby_bench', label: 'ロビーベンチ', desc: 'W1200×H450×D400', color: '#7a6a4a',
        components: [
          { type: 'top_board', name: '天板',   dimensions: d3(1200,40,400), position: p3(0,380,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'leg',       name: '左前脚', dimensions: d3(50,380,50),   position: p3(-550,0,-150), color: '#a07850' },
          { type: 'leg',       name: '右前脚', dimensions: d3(50,380,50),   position: p3(550,0,-150),  color: '#a07850' },
          { type: 'leg',       name: '左後脚', dimensions: d3(50,380,50),   position: p3(-550,0,150),  color: '#a07850' },
          { type: 'leg',       name: '右後脚', dimensions: d3(50,380,50),   position: p3(550,0,150),   color: '#a07850' },
        ],
      },
      {
        key: 'box_chair', label: 'ボックスチェア', desc: 'W600×H850×D600', color: '#5a4a8a',
        components: [
          { type: 'panel',      name: 'ベース',       dimensions: d3(600,430,600), position: p3(0,0,0),     color: '#4a3a7a' },
          { type: 'back_panel', name: '背もたれ',     dimensions: d3(600,420,100), position: p3(0,430,250), color: '#5a4a8a' },
          { type: 'panel',      name: '座クッション', dimensions: d3(560,90,460),  position: p3(0,430,-20), color: '#6a5a9a' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────
  // チェア
  // ──────────────────────────────────────────────────
  {
    category: 'チェア',
    catColor: '#4a7a5a',
    templates: [
      {
        key: 'arm_chair', label: 'アームチェア', desc: 'W600×H840×D560', color: '#7a6a4a',
        components: [
          { type: 'panel',      name: '座面',     dimensions: d3(460,30,460), position: p3(0,450,0),      color: 'light-dark(#785a35, #c8a882)' },
          { type: 'leg',        name: '左前脚',   dimensions: d3(40,450,40),  position: p3(-200,0,-200),  color: '#a07850' },
          { type: 'leg',        name: '右前脚',   dimensions: d3(40,450,40),  position: p3(200,0,-200),   color: '#a07850' },
          { type: 'frame',      name: '左後脚',   dimensions: d3(40,840,40),  position: p3(-200,0,200),   color: '#a07850' },
          { type: 'frame',      name: '右後脚',   dimensions: d3(40,840,40),  position: p3(200,0,200),    color: '#a07850' },
          { type: 'back_panel', name: '背もたれ', dimensions: d3(420,360,20), position: p3(0,470,200),    color: '#b8986a' },
          { type: 'panel',      name: '左肘掛け', dimensions: d3(20,60,380),  position: p3(-250,500,-10), color: '#b8986a' },
          { type: 'panel',      name: '右肘掛け', dimensions: d3(20,60,380),  position: p3(250,500,-10),  color: '#b8986a' },
        ],
      },
      {
        key: 'armless_chair', label: 'アームレスチェア', desc: 'W450×H800×D420', color: '#7a6a4a',
        components: [
          { type: 'panel',      name: '座面',     dimensions: d3(450,25,420), position: p3(0,415,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'leg',        name: '左前脚',   dimensions: d3(40,415,40),  position: p3(-185,0,-165), color: '#a07850' },
          { type: 'leg',        name: '右前脚',   dimensions: d3(40,415,40),  position: p3(185,0,-165),  color: '#a07850' },
          { type: 'frame',      name: '左後脚',   dimensions: d3(40,785,40),  position: p3(-185,0,165),  color: '#a07850' },
          { type: 'frame',      name: '右後脚',   dimensions: d3(40,785,40),  position: p3(185,0,165),   color: '#a07850' },
          { type: 'back_panel', name: '背もたれ', dimensions: d3(410,350,20), position: p3(0,440,165),   color: 'light-dark(#785a35, #c8a882)' },
        ],
      },
      {
        key: 'counter_chair', label: 'カウンターチェア', desc: 'W430×H1050×D380', color: '#5a6a7a',
        components: [
          { type: 'panel',      name: '座面',         dimensions: d3(380,25,350), position: p3(0,750,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'frame',      name: '左前脚',       dimensions: d3(35,750,35),  position: p3(-170,0,-145), color: '#a07850' },
          { type: 'frame',      name: '右前脚',       dimensions: d3(35,750,35),  position: p3(170,0,-145),  color: '#a07850' },
          { type: 'frame',      name: '左後脚',       dimensions: d3(35,1025,35), position: p3(-170,0,145),  color: '#a07850' },
          { type: 'frame',      name: '右後脚',       dimensions: d3(35,1025,35), position: p3(170,0,145),   color: '#a07850' },
          { type: 'back_panel', name: '背もたれ',     dimensions: d3(340,250,20), position: p3(0,775,145),   color: '#b8986a' },
          { type: 'panel',      name: 'フットレスト', dimensions: d3(310,20,30),  position: p3(0,380,-80),   color: '#a07850' },
        ],
      },
      {
        key: 'stacking_chair', label: 'スタッキングチェア', desc: 'W450×H830×D480', color: '#7a7a7a',
        components: [
          { type: 'panel',      name: '座面',     dimensions: d3(420,20,400), position: p3(0,440,0),    color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
          { type: 'frame',      name: '左前脚',   dimensions: d3(20,440,20),  position: p3(-200,0,-190), color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
          { type: 'frame',      name: '右前脚',   dimensions: d3(20,440,20),  position: p3(200,0,-190),  color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
          { type: 'frame',      name: '左後脚',   dimensions: d3(20,830,20),  position: p3(-200,0,190),  color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
          { type: 'frame',      name: '右後脚',   dimensions: d3(20,830,20),  position: p3(200,0,190),   color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
          { type: 'back_panel', name: '背もたれ', dimensions: d3(380,300,15), position: p3(0,460,190),   color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
        ],
      },
      {
        key: 'stool', label: 'スツール', desc: 'W400×H480×D400', color: '#7a6a4a',
        components: [
          { type: 'top_board', name: '座面',   dimensions: d3(380,35,380), position: p3(0,440,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'leg',       name: '左前脚', dimensions: d3(40,440,40),  position: p3(-155,0,-155), color: '#a07850' },
          { type: 'leg',       name: '右前脚', dimensions: d3(40,440,40),  position: p3(155,0,-155),  color: '#a07850' },
          { type: 'leg',       name: '左後脚', dimensions: d3(40,440,40),  position: p3(-155,0,155),  color: '#a07850' },
          { type: 'leg',       name: '右後脚', dimensions: d3(40,440,40),  position: p3(155,0,155),   color: '#a07850' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────
  // テーブル
  // ──────────────────────────────────────────────────
  {
    category: 'テーブル',
    catColor: '#7a6a3a',
    templates: [
      {
        key: 'dining_table', label: 'ダイニングテーブル', desc: 'W1400×H720×D800', color: '#7a6a4a',
        components: [
          { type: 'top_board', name: '天板',   dimensions: d3(1400,30,800), position: p3(0,690,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'leg',       name: '左前脚', dimensions: d3(70,690,70),   position: p3(-620,0,-340), color: '#a07850' },
          { type: 'leg',       name: '右前脚', dimensions: d3(70,690,70),   position: p3(620,0,-340),  color: '#a07850' },
          { type: 'leg',       name: '左後脚', dimensions: d3(70,690,70),   position: p3(-620,0,340),  color: '#a07850' },
          { type: 'leg',       name: '右後脚', dimensions: d3(70,690,70),   position: p3(620,0,340),   color: '#a07850' },
        ],
      },
      {
        key: 'low_table', label: 'ローテーブル', desc: 'W900×H350×D500', color: '#6a5a3a',
        components: [
          { type: 'top_board', name: '天板',   dimensions: d3(900,25,500), position: p3(0,325,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'leg',       name: '左前脚', dimensions: d3(50,325,50),  position: p3(-400,0,-200), color: '#a07850' },
          { type: 'leg',       name: '右前脚', dimensions: d3(50,325,50),  position: p3(400,0,-200),  color: '#a07850' },
          { type: 'leg',       name: '左後脚', dimensions: d3(50,325,50),  position: p3(-400,0,200),  color: '#a07850' },
          { type: 'leg',       name: '右後脚', dimensions: d3(50,325,50),  position: p3(400,0,200),   color: '#a07850' },
        ],
      },
      {
        key: 'meeting_table', label: '会議テーブル', desc: 'W2400×H720×D1000', color: '#5a6a7a',
        components: [
          { type: 'top_board', name: '天板',   dimensions: d3(2400,30,1000), position: p3(0,690,0),     color: 'light-dark(#785a35, #c8a882)' },
          { type: 'leg',       name: '左前脚', dimensions: d3(80,690,80),    position: p3(-1100,0,-450), color: '#a07850' },
          { type: 'leg',       name: '右前脚', dimensions: d3(80,690,80),    position: p3(1100,0,-450),  color: '#a07850' },
          { type: 'leg',       name: '左後脚', dimensions: d3(80,690,80),    position: p3(-1100,0,450),  color: '#a07850' },
          { type: 'leg',       name: '右後脚', dimensions: d3(80,690,80),    position: p3(1100,0,450),   color: '#a07850' },
        ],
      },
      {
        key: 'reception_table', label: '応接テーブル', desc: 'W1200×H430×D600', color: '#6a5a3a',
        components: [
          { type: 'top_board', name: '天板',   dimensions: d3(1200,30,600), position: p3(0,400,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'leg',       name: '左前脚', dimensions: d3(50,400,50),   position: p3(-550,0,-250), color: '#a07850' },
          { type: 'leg',       name: '右前脚', dimensions: d3(50,400,50),   position: p3(550,0,-250),  color: '#a07850' },
          { type: 'leg',       name: '左後脚', dimensions: d3(50,400,50),   position: p3(-550,0,250),  color: '#a07850' },
          { type: 'leg',       name: '右後脚', dimensions: d3(50,400,50),   position: p3(550,0,250),   color: '#a07850' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────
  // エグゼクティブ・応接家具
  // ──────────────────────────────────────────────────
  {
    category: 'エグゼクティブ',
    catColor: '#3a2a1a',
    templates: [
      {
        key: 'exec_desk', label: 'エグゼクティブデスク', desc: 'W1800×H720×D900', color: '#3a2a1a',
        components: [
          { type: 'top_board',  name: '天板',     dimensions: d3(1800,30,900), position: p3(0,690,0),    color: '#5a3820' },
          { type: 'side_panel', name: '左袖板',   dimensions: d3(30,690,900),  position: p3(-885,0,0),   color: '#4a2818' },
          { type: 'side_panel', name: '右袖板',   dimensions: d3(30,690,900),  position: p3(885,0,0),    color: '#4a2818' },
          { type: 'shelf',      name: '引き出し', dimensions: d3(1740,80,840), position: p3(0,400,0),    color: '#3a1808' },
        ],
      },
      {
        key: 'reception_set', label: '応接セット（ソファ+テーブル）', desc: 'W2400×H850×D1800', color: '#5a4a3a',
        components: [
          // 応接テーブル
          { type: 'top_board', name: 'テーブル天板', dimensions: d3(1200,30,600), position: p3(0,400,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'leg',       name: 'TL左前脚',     dimensions: d3(50,400,50),   position: p3(-550,0,-250), color: '#a07850' },
          { type: 'leg',       name: 'TL右前脚',     dimensions: d3(50,400,50),   position: p3(550,0,-250),  color: '#a07850' },
          { type: 'leg',       name: 'TL左後脚',     dimensions: d3(50,400,50),   position: p3(-550,0,250),  color: '#a07850' },
          { type: 'leg',       name: 'TL右後脚',     dimensions: d3(50,400,50),   position: p3(550,0,250),   color: '#a07850' },
          // 奥のソファ (z+750寄り)
          { type: 'panel',      name: 'ソファベース',   dimensions: d3(1400,380,700), position: p3(0,0,1050),   color: '#4a4a6a' },
          { type: 'side_panel', name: 'ソファ左アーム', dimensions: d3(100,180,700),  position: p3(-600,380,1050), color: '#4a4a6a' },
          { type: 'side_panel', name: 'ソファ右アーム', dimensions: d3(100,180,700),  position: p3(600,380,1050),  color: '#4a4a6a' },
          { type: 'back_panel', name: 'ソファ背もたれ', dimensions: d3(1400,360,100), position: p3(0,380,1350),   color: '#5a5a7a' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────
  // キャビネット
  // ──────────────────────────────────────────────────
  {
    category: 'キャビネット',
    catColor: '#4a7a6a',
    templates: [
      {
        key: 'bookshelf', label: '本棚', desc: 'W800×H720×D300', color: '#5c8a5c',
        components: [
          { type: 'side_panel',   name: '左側板', dimensions: d3(18,720,300),  position: p3(-391,0,0),   color: 'light-dark(#785a35, #c8a882)' },
          { type: 'side_panel',   name: '右側板', dimensions: d3(18,720,300),  position: p3(391,0,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'bottom_board', name: '底板',   dimensions: d3(764,18,300),  position: p3(0,18,0),     color: 'light-dark(#785a35, #c8a882)' },
          { type: 'top_board',    name: '天板',   dimensions: d3(800,18,300),  position: p3(0,702,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'shelf',        name: '棚板1',  dimensions: d3(764,18,300),  position: p3(0,250,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'shelf',        name: '棚板2',  dimensions: d3(764,18,300),  position: p3(0,480,0),    color: 'light-dark(#785a35, #c8a882)' },
        ],
      },
      {
        key: 'cabinet', label: 'キャビネット（扉付き）', desc: 'W800×H900×D400', color: '#8a5c5c',
        components: [
          { type: 'side_panel',   name: '左側板', dimensions: d3(18,900,400),  position: p3(-391,0,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'side_panel',   name: '右側板', dimensions: d3(18,900,400),  position: p3(391,0,0),     color: 'light-dark(#785a35, #c8a882)' },
          { type: 'bottom_board', name: '底板',   dimensions: d3(764,18,400),  position: p3(0,18,0),      color: 'light-dark(#785a35, #c8a882)' },
          { type: 'top_board',    name: '天板',   dimensions: d3(800,18,400),  position: p3(0,882,0),     color: 'light-dark(#785a35, #c8a882)' },
          { type: 'shelf',        name: '中棚板', dimensions: d3(764,18,400),  position: p3(0,450,0),     color: 'light-dark(#785a35, #c8a882)' },
          { type: 'door',         name: '左扉',   dimensions: d3(382,864,18),  position: p3(-191,18,-191), color: '#b89a6e' },
          { type: 'door',         name: '右扉',   dimensions: d3(382,864,18),  position: p3(191,18,-191),  color: '#b89a6e' },
        ],
      },
      {
        key: 'open_shelf', label: 'オープンシェルフ', desc: 'W600×H1800×D300', color: '#6a5c8a',
        components: [
          { type: 'side_panel',   name: '左側板', dimensions: d3(18,1800,300), position: p3(-291,0,0),   color: 'light-dark(#785a35, #c8a882)' },
          { type: 'side_panel',   name: '右側板', dimensions: d3(18,1800,300), position: p3(291,0,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'bottom_board', name: '底板',   dimensions: d3(564,18,300),  position: p3(0,18,0),     color: 'light-dark(#785a35, #c8a882)' },
          { type: 'top_board',    name: '天板',   dimensions: d3(600,18,300),  position: p3(0,1782,0),   color: 'light-dark(#785a35, #c8a882)' },
          { type: 'shelf',        name: '棚板1',  dimensions: d3(564,18,300),  position: p3(0,400,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'shelf',        name: '棚板2',  dimensions: d3(564,18,300),  position: p3(0,720,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'shelf',        name: '棚板3',  dimensions: d3(564,18,300),  position: p3(0,1100,0),   color: 'light-dark(#785a35, #c8a882)' },
          { type: 'shelf',        name: '棚板4',  dimensions: d3(564,18,300),  position: p3(0,1450,0),   color: 'light-dark(#785a35, #c8a882)' },
        ],
      },
      {
        key: 'locker', label: 'ロッカー（2段）', desc: 'W300×H1800×D450', color: '#5a6a7a',
        components: [
          { type: 'side_panel',   name: '左側板', dimensions: d3(18,1800,450), position: p3(-141,0,0),   color: 'light-dark(#785a35, #c8a882)' },
          { type: 'side_panel',   name: '右側板', dimensions: d3(18,1800,450), position: p3(141,0,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'bottom_board', name: '底板',   dimensions: d3(264,18,450),  position: p3(0,18,0),     color: 'light-dark(#785a35, #c8a882)' },
          { type: 'top_board',    name: '天板',   dimensions: d3(300,18,450),  position: p3(0,1782,0),   color: 'light-dark(#785a35, #c8a882)' },
          { type: 'shelf',        name: '中棚板', dimensions: d3(264,18,450),  position: p3(0,900,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'door',         name: '上扉',   dimensions: d3(264,882,18),  position: p3(0,918,-216), color: '#b89a6e' },
          { type: 'door',         name: '下扉',   dimensions: d3(264,882,18),  position: p3(0,18,-216),  color: '#b89a6e' },
        ],
      },
      {
        key: 'dish_cabinet', label: '食器棚', desc: 'W900×H2000×D400', color: '#5a8a7a',
        components: [
          { type: 'side_panel',   name: '左側板', dimensions: d3(18,2000,400), position: p3(-441,0,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'side_panel',   name: '右側板', dimensions: d3(18,2000,400), position: p3(441,0,0),     color: 'light-dark(#785a35, #c8a882)' },
          { type: 'bottom_board', name: '底板',   dimensions: d3(864,18,400),  position: p3(0,18,0),      color: 'light-dark(#785a35, #c8a882)' },
          { type: 'top_board',    name: '天板',   dimensions: d3(900,18,400),  position: p3(0,1982,0),    color: 'light-dark(#785a35, #c8a882)' },
          { type: 'shelf',        name: '中棚板', dimensions: d3(864,18,400),  position: p3(0,950,0),     color: 'light-dark(#785a35, #c8a882)' },
          { type: 'door',         name: '左下扉', dimensions: d3(432,932,18),  position: p3(-216,18,-191), color: '#b89a6e' },
          { type: 'door',         name: '右下扉', dimensions: d3(432,932,18),  position: p3(216,18,-191),  color: '#b89a6e' },
          { type: 'shelf',        name: '上棚板', dimensions: d3(864,18,180),  position: p3(0,1600,110),  color: 'light-dark(#785a35, #c8a882)' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────
  // ベッド
  // ──────────────────────────────────────────────────
  {
    category: 'ベッド',
    catColor: '#5a6a8a',
    templates: [
      {
        key: 'single_bed', label: 'シングルベッド', desc: 'W1050×H560×D2100', color: '#6a5a4a',
        components: [
          { type: 'panel',      name: 'ベッドフレーム', dimensions: d3(1050,200,2100), position: p3(0,0,0),      color: '#9a7850' },
          { type: 'back_panel', name: 'ヘッドボード',   dimensions: d3(1050,560,80),   position: p3(0,200,-1010), color: '#8a6840' },
          { type: 'panel',      name: 'マットレス',     dimensions: d3(970,210,1960),  position: p3(0,200,0),    color: 'var(--brand-fg)' },
        ],
      },
      {
        key: 'semi_double_bed', label: 'セミダブルベッド', desc: 'W1300×H560×D2100', color: '#6a5a4a',
        components: [
          { type: 'panel',      name: 'ベッドフレーム', dimensions: d3(1300,200,2100), position: p3(0,0,0),      color: '#9a7850' },
          { type: 'back_panel', name: 'ヘッドボード',   dimensions: d3(1300,560,80),   position: p3(0,200,-1010), color: '#8a6840' },
          { type: 'panel',      name: 'マットレス',     dimensions: d3(1220,210,1960), position: p3(0,200,0),    color: 'var(--brand-fg)' },
        ],
      },
      {
        key: 'double_bed', label: 'ダブルベッド', desc: 'W1600×H560×D2100', color: '#6a5a4a',
        components: [
          { type: 'panel',      name: 'ベッドフレーム', dimensions: d3(1600,200,2100), position: p3(0,0,0),      color: '#9a7850' },
          { type: 'back_panel', name: 'ヘッドボード',   dimensions: d3(1600,560,80),   position: p3(0,200,-1010), color: '#8a6840' },
          { type: 'panel',      name: 'マットレス',     dimensions: d3(1520,210,1960), position: p3(0,200,0),    color: 'var(--brand-fg)' },
        ],
      },
      {
        key: 'bunk_bed', label: '二段ベッド', desc: 'W1050×H1600×D2100', color: '#5a6a7a',
        components: [
          // 下段
          { type: 'panel',      name: '下段フレーム',   dimensions: d3(1050,200,2100), position: p3(0,0,0),       color: '#8a6840' },
          { type: 'panel',      name: '下段マットレス', dimensions: d3(970,180,1960),  position: p3(0,200,0),     color: 'var(--brand-fg)' },
          // 上段
          { type: 'panel',      name: '上段フレーム',   dimensions: d3(1050,200,2100), position: p3(0,800,0),     color: '#8a6840' },
          { type: 'panel',      name: '上段マットレス', dimensions: d3(970,180,1960),  position: p3(0,1000,0),    color: 'var(--brand-fg)' },
          // 柱・ヘッドボード
          { type: 'frame',      name: '左前柱',         dimensions: d3(60,1600,60),    position: p3(-465,0,-1020), color: '#7a5830' },
          { type: 'frame',      name: '右前柱',         dimensions: d3(60,1600,60),    position: p3(465,0,-1020),  color: '#7a5830' },
          { type: 'frame',      name: '左後柱',         dimensions: d3(60,1600,60),    position: p3(-465,0,1020),  color: '#7a5830' },
          { type: 'frame',      name: '右後柱',         dimensions: d3(60,1600,60),    position: p3(465,0,1020),   color: '#7a5830' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────
  // 和家具
  // ──────────────────────────────────────────────────
  {
    category: '和家具',
    catColor: '#7a5a3a',
    templates: [
      {
        key: 'zaisu', label: '座椅子', desc: 'W580×H580×D680', color: '#7a4a2a',
        components: [
          { type: 'panel',      name: 'ベース',       dimensions: d3(580,150,680), position: p3(0,0,0),     color: '#7a4a2a' },
          { type: 'panel',      name: '座クッション', dimensions: d3(550,70,500),  position: p3(0,150,-10), color: '#9a6a4a' },
          { type: 'back_panel', name: '背もたれ',     dimensions: d3(550,430,90),  position: p3(0,150,295), color: '#8a5a3a' },
        ],
      },
      {
        key: 'zataku', label: '座卓', desc: 'W1200×H320×D600', color: '#7a5a3a',
        components: [
          { type: 'top_board', name: '天板',   dimensions: d3(1200,30,600), position: p3(0,290,0),    color: '#9a7850' },
          { type: 'leg',       name: '左前脚', dimensions: d3(50,290,50),   position: p3(-550,0,-250), color: '#7a5830' },
          { type: 'leg',       name: '右前脚', dimensions: d3(50,290,50),   position: p3(550,0,-250),  color: '#7a5830' },
          { type: 'leg',       name: '左後脚', dimensions: d3(50,290,50),   position: p3(-550,0,250),  color: '#7a5830' },
          { type: 'leg',       name: '右後脚', dimensions: d3(50,290,50),   position: p3(550,0,250),   color: '#7a5830' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────
  // アウトドア家具
  // ──────────────────────────────────────────────────
  {
    category: 'アウトドア家具',
    catColor: '#3a6a3a',
    templates: [
      {
        key: 'garden_chair', label: 'ガーデンチェア', desc: 'W520×H850×D560', color: '#4a6a2a',
        components: [
          { type: 'panel',      name: '座面',     dimensions: d3(460,20,420), position: p3(0,440,0),    color: '#8a6a40' },
          { type: 'leg',        name: '左前脚',   dimensions: d3(40,440,40),  position: p3(-200,0,-195), color: '#5a3a10' },
          { type: 'leg',        name: '右前脚',   dimensions: d3(40,440,40),  position: p3(200,0,-195),  color: '#5a3a10' },
          { type: 'frame',      name: '左後脚',   dimensions: d3(40,800,40),  position: p3(-200,0,195),  color: '#5a3a10' },
          { type: 'frame',      name: '右後脚',   dimensions: d3(40,800,40),  position: p3(200,0,195),   color: '#5a3a10' },
          { type: 'back_panel', name: '背もたれ', dimensions: d3(420,330,20), position: p3(0,460,195),   color: '#8a6a40' },
        ],
      },
      {
        key: 'garden_bench', label: 'ガーデンベンチ', desc: 'W1200×H800×D500', color: '#4a6a2a',
        components: [
          { type: 'top_board',  name: '座板',     dimensions: d3(1200,25,450), position: p3(0,440,0),    color: '#8a6a40' },
          { type: 'back_panel', name: '背もたれ', dimensions: d3(1200,340,20), position: p3(0,465,200),  color: '#7a5a30' },
          { type: 'leg',        name: '左前脚',   dimensions: d3(50,440,50),   position: p3(-550,0,-175), color: '#5a3a10' },
          { type: 'leg',        name: '右前脚',   dimensions: d3(50,440,50),   position: p3(550,0,-175),  color: '#5a3a10' },
          { type: 'leg',        name: '左後脚',   dimensions: d3(50,800,50),   position: p3(-550,0,200),  color: '#5a3a10' },
          { type: 'leg',        name: '右後脚',   dimensions: d3(50,800,50),   position: p3(550,0,200),   color: '#5a3a10' },
        ],
      },
      {
        key: 'garden_table', label: 'ガーデンテーブル', desc: 'W800×H720×D800', color: '#4a6a2a',
        components: [
          { type: 'top_board', name: '天板',   dimensions: d3(800,25,800), position: p3(0,695,0),    color: '#8a6a40' },
          { type: 'leg',       name: '左前脚', dimensions: d3(60,695,60),  position: p3(-340,0,-340), color: '#5a3a10' },
          { type: 'leg',       name: '右前脚', dimensions: d3(60,695,60),  position: p3(340,0,-340),  color: '#5a3a10' },
          { type: 'leg',       name: '左後脚', dimensions: d3(60,695,60),  position: p3(-340,0,340),  color: '#5a3a10' },
          { type: 'leg',       name: '右後脚', dimensions: d3(60,695,60),  position: p3(340,0,340),   color: '#5a3a10' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────
  // キッズ家具
  // ──────────────────────────────────────────────────
  {
    category: 'キッズ家具',
    catColor: '#8a5a2a',
    templates: [
      {
        key: 'kids_desk', label: '学習デスク', desc: 'W1000×H720×D500', color: '#c8843a',
        components: [
          { type: 'top_board',  name: '天板',     dimensions: d3(1000,25,500), position: p3(0,695,0),    color: 'light-dark(#9e6f0f, #f0c060)' },
          { type: 'side_panel', name: '左側板',   dimensions: d3(25,700,500),  position: p3(-487,0,0),   color: 'light-dark(#996814, #e8b050)' },
          { type: 'side_panel', name: '右側板',   dimensions: d3(25,700,500),  position: p3(487,0,0),    color: 'light-dark(#996814, #e8b050)' },
          { type: 'shelf',      name: '棚板',     dimensions: d3(950,18,200),  position: p3(0,400,150),  color: 'light-dark(#9e6f0f, #f0c060)' },
          { type: 'back_panel', name: '背板',     dimensions: d3(950,300,9),   position: p3(0,400,246),  color: '#d09040' },
        ],
      },
      {
        key: 'kids_chair', label: 'キッズチェア', desc: 'W360×H640×D340', color: '#c8543a',
        components: [
          { type: 'panel',      name: '座面',     dimensions: d3(340,20,320), position: p3(0,340,0),    color: 'light-dark(#a0570e, #f0a050)' },
          { type: 'leg',        name: '左前脚',   dimensions: d3(30,340,30),  position: p3(-145,0,-130), color: '#c07830' },
          { type: 'leg',        name: '右前脚',   dimensions: d3(30,340,30),  position: p3(145,0,-130),  color: '#c07830' },
          { type: 'frame',      name: '左後脚',   dimensions: d3(30,620,30),  position: p3(-145,0,130),  color: '#c07830' },
          { type: 'frame',      name: '右後脚',   dimensions: d3(30,620,30),  position: p3(145,0,130),   color: '#c07830' },
          { type: 'back_panel', name: '背もたれ', dimensions: d3(280,260,15), position: p3(0,360,130),   color: 'light-dark(#a0570e, #f0a050)' },
        ],
      },
    ],
  },

  // ──────────────────────────────────────────────────
  // 備品
  // ──────────────────────────────────────────────────
  {
    category: '備品',
    catColor: '#6a6a6a',
    templates: [
      {
        key: 'partition', label: 'パーティション', desc: 'W900×H1500×D40', color: '#6a6a6a',
        components: [
          { type: 'back_panel', name: 'パネル',  dimensions: d3(900,1500,40), position: p3(0,0,0),    color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
          { type: 'leg',        name: '左台座',  dimensions: d3(40,80,200),   position: p3(-430,0,0), color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
          { type: 'leg',        name: '右台座',  dimensions: d3(40,80,200),   position: p3(430,0,0),  color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
        ],
      },
      {
        key: 'hanger_rack', label: 'ハンガーラック', desc: 'W900×H1700×D500', color: 'rgb(var(--brand-fg-rgb) / 0.65)',
        components: [
          { type: 'frame', name: '左柱',       dimensions: d3(30,1700,30), position: p3(-420,0,0),    color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
          { type: 'frame', name: '右柱',       dimensions: d3(30,1700,30), position: p3(420,0,0),     color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
          { type: 'panel', name: 'ハンガーバー', dimensions: d3(840,25,25), position: p3(0,1600,0),   color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
          { type: 'leg',   name: '左前横桟',   dimensions: d3(30,30,250),  position: p3(-420,80,-110), color: '#7a7a7a' },
          { type: 'leg',   name: '右前横桟',   dimensions: d3(30,30,250),  position: p3(420,80,-110),  color: '#7a7a7a' },
          { type: 'leg',   name: '左後横桟',   dimensions: d3(30,30,250),  position: p3(-420,80,110),  color: '#7a7a7a' },
          { type: 'leg',   name: '右後横桟',   dimensions: d3(30,30,250),  position: p3(420,80,110),   color: '#7a7a7a' },
        ],
      },
      {
        key: 'steel_shelf', label: 'スチール棚', desc: 'W900×H1800×D450', color: '#7a7a8a',
        components: [
          { type: 'frame', name: '左前柱', dimensions: d3(40,1800,40),  position: p3(-430,0,-205), color: '#808090' },
          { type: 'frame', name: '右前柱', dimensions: d3(40,1800,40),  position: p3(430,0,-205),  color: '#808090' },
          { type: 'frame', name: '左後柱', dimensions: d3(40,1800,40),  position: p3(-430,0,205),  color: '#808090' },
          { type: 'frame', name: '右後柱', dimensions: d3(40,1800,40),  position: p3(430,0,205),   color: '#808090' },
          { type: 'shelf', name: '棚板1',  dimensions: d3(820,25,410),  position: p3(0,300,0),     color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
          { type: 'shelf', name: '棚板2',  dimensions: d3(820,25,410),  position: p3(0,700,0),     color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
          { type: 'shelf', name: '棚板3',  dimensions: d3(820,25,410),  position: p3(0,1200,0),    color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
          { type: 'shelf', name: '棚板4',  dimensions: d3(820,25,410),  position: p3(0,1700,0),    color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
        ],
      },
    ],
  },
];

// ─── Furniture type detection & part filter ────────────────────────────────────

type FurnitureType = 'table' | 'chair' | 'sofa' | 'bed' | 'cabinet' | 'other';

function detectFurnitureType(name: string, components: any[]): FurnitureType {
  const n = (name || '').toLowerCase();
  if (/テーブル|デスク|卓/.test(n))               return 'table';
  if (/チェア|スツール|椅子|座椅子/.test(n))       return 'chair';
  if (/ソファ|ベンチ/.test(n))                     return 'sofa';
  if (/ベッド|ベット/.test(n))                     return 'bed';
  if (/棚|キャビネット|ロッカー|シェルフ/.test(n))  return 'cabinet';
  const types = new Set(components.map((c: any) => c.type));
  if (types.has('top_board') && types.has('leg'))    return 'table';
  if (types.has('shelf') || types.has('bottom_board')) return 'cabinet';
  return 'other';
}

const PARTS_FOR_TYPE: Record<FurnitureType, Set<string>> = {
  cabinet: new Set(['top_board', 'bottom_board', 'side_panel', 'back_panel', 'panel', 'shelf', 'door']),
  table:   new Set(['top_board', 'panel', 'shelf', 'leg', 'frame']),
  chair:   new Set(['panel', 'back_panel', 'leg', 'frame']),
  sofa:    new Set(['panel', 'side_panel', 'back_panel', 'top_board', 'leg']),
  bed:     new Set(['panel', 'back_panel', 'frame', 'leg']),
  other:   new Set(['top_board', 'bottom_board', 'side_panel', 'back_panel', 'panel', 'shelf', 'leg', 'frame', 'door']),
};

const FURNITURE_TYPE_LABELS: Record<FurnitureType, string> = {
  cabinet: 'キャビネット',
  table:   'テーブル',
  chair:   'チェア',
  sofa:    'ソファ',
  bed:     'ベッド',
  other:   '',
};

// ─── Parts Tab ──────────────────────────────────────────────────────────────────

const PartsTab: React.FC = () => {
  const addComponent  = useDscStore(s => s.addComponent);
  const furnitureName = useDscStore(s => s.furnitureName);
  const components    = useDscStore(s => s.components);

  const furnitureType    = detectFurnitureType(furnitureName, components);
  const allowedParts     = PARTS_FOR_TYPE[furnitureType];
  const typeLabel        = FURNITURE_TYPE_LABELS[furnitureType];

  const visibleSections = PART_SECTIONS
    .map(sec => ({ ...sec, parts: sec.parts.filter(p => allowedParts.has(p.type)) }))
    .filter(sec => sec.parts.length > 0);

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
      {typeLabel && (
        <Box sx={{ mb: 1.5, px: 1, py: 0.5, borderRadius: 1, bgcolor: 'rgba(255,167,38,0.08)', border: '1px solid rgba(255,167,38,0.18)', display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: ACCENT, flexShrink: 0 }} />
          <Typography sx={{ fontSize: 10, color: 'light-dark(rgba(173,103,0,0.8), rgba(255,167,38,0.8))', fontWeight: 600 }}>
            {typeLabel}向けパーツを表示中
          </Typography>
        </Box>
      )}
      {visibleSections.map(sec => (
        <Box key={sec.label} sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.35)', textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.75 }}>
            {sec.label}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {sec.parts.map(({ type, label, desc }) => (
              <Box
                key={type}
                onClick={() => addComponent(type)}
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  px: 1.25, py: 0.85, borderRadius: 1.5,
                  border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)',
                  bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
                  cursor: 'pointer', transition: 'all 0.15s',
                  '&:hover': { borderColor: ACCENT, bgcolor: 'rgba(255,167,38,0.06)' },
                }}
              >
                <Box>
                  <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.85)', fontSize: 12, fontWeight: 600 }}>{label}</Typography>
                  <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.35)', fontSize: 10 }}>{desc}</Typography>
                </Box>
                <AddIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.3)' }} />
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

// ─── Templates Tab ──────────────────────────────────────────────────────────────

const TemplatesTab: React.FC = () => {
  const setComponents    = useDscStore(s => s.setComponents);
  const setFurnitureName = useDscStore(s => s.setFurnitureName);
  const components       = useDscStore(s => s.components);
  const [activeCat, setActiveCat] = React.useState<string>('すべて');

  const catNames = ['すべて', ...TEMPLATE_CATEGORIES.map(c => c.category)];

  const filtered = activeCat === 'すべて'
    ? TEMPLATE_CATEGORIES
    : TEMPLATE_CATEGORIES.filter(c => c.category === activeCat);

  const handleLoad = (tmpl) => {
    if (components.length > 0) {
      if (!window.confirm(`「${tmpl.label}」を読み込みます。\n現在のパーツはすべて置き換えられます。`)) return;
    }
    const comps = tmpl.components.map(c => ({ ...c, id: freshId(), rotation: [0, 0, 0] }));
    setComponents(comps);
    setFurnitureName(tmpl.label);
  };

  // カテゴリに対応する catColor を返す
  const catColorOf = (catName: string) =>
    TEMPLATE_CATEGORIES.find(c => c.category === catName)?.catColor ?? ACCENT;

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

      {/* カテゴリフィルター */}
      <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.06)', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {catNames.map(cat => {
            const isActive = activeCat === cat;
            const col = cat === 'すべて' ? ACCENT : catColorOf(cat);
            return (
              <Box
                key={cat}
                onClick={() => setActiveCat(cat)}
                sx={{
                  px: 0.9, py: 0.3, borderRadius: 1, cursor: 'pointer', fontSize: 10, fontWeight: 600,
                  bgcolor: isActive ? `${col}28` : 'transparent',
                  color: isActive ? col : 'rgb(var(--brand-fg-rgb) / 0.38)',
                  border: `1px solid ${isActive ? col : 'rgb(var(--brand-fg-rgb) / 0.1)'}`,
                  transition: 'all 0.15s',
                  '&:hover': { color: col, borderColor: col },
                }}
              >
                {cat === 'すべて' ? 'ALL' : cat.replace('・応接家具', '').replace('家具', '')}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* テンプレート一覧 */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
        {filtered.map(({ category, catColor, templates }) => (
          <Box key={category} sx={{ mb: 2 }}>
            {activeCat === 'すべて' && (
              <Typography sx={{ fontSize: 9, fontWeight: 700, color: catColor, textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box component="span" sx={{ display: 'inline-block', width: 6, height: 6, borderRadius: 0.5, bgcolor: catColor, flexShrink: 0 }} />
                {category}
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {templates.map(tmpl => (
                <Box
                  key={tmpl.key}
                  onClick={() => handleLoad(tmpl)}
                  sx={{
                    px: 1.25, py: 0.9, borderRadius: 1.5, cursor: 'pointer',
                    border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)',
                    bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: catColor, bgcolor: `color-mix(in srgb, ${catColor} 8%, transparent)` },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ width: 7, height: 7, borderRadius: 0.75, bgcolor: tmpl.color, flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.88)', fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{tmpl.label}</Typography>
                      <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.32)', fontSize: 9 }}>{tmpl.desc}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 9, color: 'rgb(var(--brand-fg-rgb) / 0.22)', flexShrink: 0 }}>{tmpl.components.length}P</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// ─── Layers Tab ─────────────────────────────────────────────────────────────────

const LayersTab: React.FC = () => {
  const { components, selectedId, selectComponent, removeComponent, duplicateComponent } = useDscStore();
  return (
    <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.35)', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1 }}>
        コンポーネント ({components.length})
      </Typography>
      {components.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <ViewInArIcon sx={{ fontSize: 36, color: 'light-dark(rgba(173,103,0,0.2), rgba(255,167,38,0.2))', mb: 1 }} />
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.3)', lineHeight: 1.6 }}>
            パーツタブからパーツを<br />追加してください
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {[...components].reverse().map(comp => (
            <Box
              key={comp.id}
              onClick={() => selectComponent(comp.id)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                px: 1.25, py: 0.75, borderRadius: 1.5, cursor: 'pointer',
                bgcolor: selectedId === comp.id ? 'rgba(255,167,38,0.12)' : 'transparent',
                border: `1px solid ${selectedId === comp.id ? ACCENT : 'transparent'}`,
                '&:hover': { bgcolor: selectedId === comp.id ? 'rgba(255,167,38,0.16)' : 'rgb(var(--brand-fg-rgb) / 0.04)' },
                '&:hover .layer-actions': { opacity: 1 },
                transition: 'all 0.12s',
              }}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: selectedId === comp.id ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {comp.name}
                </Typography>
                <Typography sx={{ fontSize: 9, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>
                  {comp.dimensions.width}×{comp.dimensions.depth}×{comp.dimensions.height}mm
                </Typography>
              </Box>
              <Box className="layer-actions" sx={{ display: 'flex', alignItems: 'center', opacity: 0.3, transition: 'opacity 0.12s' }}>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); duplicateComponent(comp.id); }}
                  sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', p: 0.4, '&:hover': { color: ACCENT } }}>
                  <ContentCopyRoundedIcon sx={{ fontSize: 11 }} />
                </IconButton>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); removeComponent(comp.id); }}
                  sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', p: 0.4, '&:hover': { color: '#ff4d4f' } }}>
                  <DeleteIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

// ─── Tab definitions ────────────────────────────────────────────────────────────

const TAB_DEFS = [
  { key: 'parts'      as TabKey, icon: <ViewInArIcon sx={{ fontSize: 15 }} />,           label: 'パーツ'   },
  { key: 'templates'  as TabKey, icon: <AutoFixHighRoundedIcon sx={{ fontSize: 15 }} />, label: 'テンプレ' },
  { key: 'community'  as TabKey, icon: <PeopleAltRoundedIcon sx={{ fontSize: 15 }} />,   label: 'マイ/共有' },
  { key: 'layers'     as TabKey, icon: <LayersRoundedIcon sx={{ fontSize: 15 }} />,      label: 'レイヤー' },
];

// ─── Main Export ─────────────────────────────────────────────────────────────────

export const DscEditorSidebar: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<TabKey>('parts');
  const furnitureName = useDscStore(s => s.furnitureName);

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: BRAND.panel, overflow: 'hidden' }}>

      {/* Header */}
      <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${BRAND.line}`, flexShrink: 0 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: 'rgb(var(--brand-fg-rgb) / 0.45)', textTransform: 'uppercase' }}>
          3D SHAPE CREATE
        </Typography>
        <Typography sx={{ fontSize: 12, color: ACCENT, fontWeight: 600, mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {furnitureName}
        </Typography>
      </Box>

      {/* Tab bar */}
      <Box sx={{ display: 'flex', borderBottom: `1px solid ${BRAND.line}`, flexShrink: 0 }}>
        {TAB_DEFS.map(tab => (
          <Box
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            sx={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              py: 0.75, cursor: 'pointer', gap: 0.3,
              borderBottom: activeTab === tab.key ? `2px solid ${ACCENT}` : '2px solid transparent',
              color: activeTab === tab.key ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.4)',
              transition: 'color 0.15s, border-color 0.15s',
              '&:hover': { color: activeTab === tab.key ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.7)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)' },
            }}
          >
            {tab.icon}
            <Typography sx={{ fontSize: 9, fontWeight: 600, letterSpacing: 0.5, lineHeight: 1 }}>{tab.label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {activeTab === 'parts'      && <PartsTab />}
        {activeTab === 'templates'  && <TemplatesTab />}
        {activeTab === 'community'  && <CommunityTemplatesTab />}
        {activeTab === 'layers'     && <LayersTab />}
      </Box>
    </Box>
  );
};
