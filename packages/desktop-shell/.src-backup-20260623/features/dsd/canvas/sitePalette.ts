import type { SiteElementType } from '../store/useDsdStore';

export interface SiteElementDef {
  key: SiteElementType;
  label: string;
  defaultW: number;
  defaultH: number;
  clean: { fill: string; stroke: string; text: string };
  bold:  { fill: string; stroke: string; text: string };
  dark:  { fill: string; stroke: string; text: string };
}

export const SITE_ELEMENT_DEFS: SiteElementDef[] = [
  {
    key: 'road',
    label: '道路',
    defaultW: 48, defaultH: 6,
    clean: { fill: '#e0e0e0', stroke: '#9e9e9e', text: '#616161' },
    bold:  { fill: '#bdbdbd', stroke: '#757575', text: '#212121' },
    dark:  { fill: 'rgba(158,158,158,0.3)', stroke: '#9e9e9e', text: '#bdbdbd' },
  },
  {
    key: 'building',
    label: '隣棟',
    defaultW: 10, defaultH: 8,
    clean: { fill: '#cfd8dc', stroke: '#78909c', text: '#37474f' },
    bold:  { fill: '#90a4ae', stroke: '#546e7a', text: '#ffffff' },
    dark:  { fill: 'rgba(144,164,174,0.28)', stroke: '#90a4ae', text: '#cfd8dc' },
  },
  {
    key: 'green',
    label: '緑地・公園',
    defaultW: 20, defaultH: 20,
    clean: { fill: '#c8e6c9', stroke: '#66bb6a', text: '#2e7d32' },
    bold:  { fill: '#66bb6a', stroke: '#388e3c', text: '#ffffff' },
    dark:  { fill: 'rgba(102,187,106,0.3)', stroke: '#81c784', text: '#c8e6c9' },
  },
  {
    key: 'water',
    label: '水・川',
    defaultW: 30, defaultH: 5,
    clean: { fill: '#b3e5fc', stroke: '#039be5', text: '#01579b' },
    bold:  { fill: '#4fc3f7', stroke: '#0288d1', text: '#ffffff' },
    dark:  { fill: 'rgba(79,195,247,0.28)', stroke: '#4fc3f7', text: '#b3e5fc' },
  },
  {
    key: 'parking',
    label: '駐車場',
    defaultW: 15, defaultH: 10,
    clean: { fill: '#f5f5f5', stroke: '#9e9e9e', text: '#757575' },
    bold:  { fill: '#e0e0e0', stroke: '#757575', text: '#424242' },
    dark:  { fill: 'rgba(189,189,189,0.2)', stroke: '#bdbdbd', text: '#e0e0e0' },
  },
  {
    key: 'plaza',
    label: '広場・空地',
    defaultW: 20, defaultH: 20,
    clean: { fill: '#fff8e1', stroke: '#ffd54f', text: '#f57f17' },
    bold:  { fill: '#ffe082', stroke: '#f9a825', text: '#795548' },
    dark:  { fill: 'rgba(255,213,79,0.22)', stroke: '#ffd54f', text: '#fff8e1' },
  },
];

export function siteElementDef(key: SiteElementType): SiteElementDef {
  return SITE_ELEMENT_DEFS.find(d => d.key === key) ?? SITE_ELEMENT_DEFS[0];
}
