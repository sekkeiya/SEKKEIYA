import type { ZoneCategory } from '../store/useDsdStore';

export interface CategoryDef {
  key: ZoneCategory;
  label: string;
  short: string;
  clean: { fill: string; stroke: string; text: string };
  bold:  { fill: string; stroke: string; text: string };
  dark:  { fill: string; stroke: string; text: string };
}

// Category color palette — three variants per style.
export const CATEGORY_DEFS: CategoryDef[] = [
  {
    key: 'ldk',     label: 'LDK',        short: 'LDK',
    clean: { fill: '#fff3e0', stroke: '#ef6c00', text: '#bf360c' },
    bold:  { fill: '#ff9800', stroke: '#e65100', text: '#ffffff' },
    dark:  { fill: 'rgba(255,167,38,0.22)', stroke: '#ffa726', text: '#ffcc80' },
  },
  {
    key: 'bedroom', label: '寝室',        short: '寝室',
    clean: { fill: '#e3f2fd', stroke: '#1976d2', text: '#0d47a1' },
    bold:  { fill: '#42a5f5', stroke: '#1565c0', text: '#ffffff' },
    dark:  { fill: 'rgba(66,165,245,0.22)', stroke: '#64b5f6', text: '#bbdefb' },
  },
  {
    key: 'water',   label: '水回り',      short: '水',
    clean: { fill: '#e0f7fa', stroke: '#00838f', text: '#006064' },
    bold:  { fill: '#26c6da', stroke: '#00838f', text: '#ffffff' },
    dark:  { fill: 'rgba(38,198,218,0.22)', stroke: '#4dd0e1', text: '#b2ebf2' },
  },
  {
    key: 'entry',   label: '玄関',        short: '玄関',
    clean: { fill: '#f3e5f5', stroke: '#7b1fa2', text: '#4a148c' },
    bold:  { fill: '#ab47bc', stroke: '#7b1fa2', text: '#ffffff' },
    dark:  { fill: 'rgba(171,71,188,0.22)', stroke: '#ba68c8', text: '#e1bee7' },
  },
  {
    key: 'work',    label: '書斎・仕事',  short: '書斎',
    clean: { fill: '#ede7f6', stroke: '#5e35b1', text: '#311b92' },
    bold:  { fill: '#7e57c2', stroke: '#5e35b1', text: '#ffffff' },
    dark:  { fill: 'rgba(126,87,194,0.22)', stroke: '#9575cd', text: '#d1c4e9' },
  },
  {
    key: 'storage', label: '収納',        short: '収納',
    clean: { fill: '#f5f5f5', stroke: '#616161', text: '#212121' },
    bold:  { fill: '#9e9e9e', stroke: '#424242', text: '#ffffff' },
    dark:  { fill: 'rgba(189,189,189,0.18)', stroke: '#bdbdbd', text: '#eeeeee' },
  },
  {
    key: 'outdoor', label: '屋外・庭',    short: '庭',
    clean: { fill: '#e8f5e9', stroke: '#388e3c', text: '#1b5e20' },
    bold:  { fill: '#66bb6a', stroke: '#2e7d32', text: '#ffffff' },
    dark:  { fill: 'rgba(102,187,106,0.22)', stroke: '#81c784', text: '#c8e6c9' },
  },
  {
    key: 'other',   label: 'その他',      short: '他',
    clean: { fill: '#fafafa', stroke: '#9e9e9e', text: '#424242' },
    bold:  { fill: '#cfd8dc', stroke: '#90a4ae', text: '#263238' },
    dark:  { fill: 'rgba(176,190,197,0.18)', stroke: '#90a4ae', text: '#eceff1' },
  },
];

export function categoryDef(key: ZoneCategory): CategoryDef {
  return CATEGORY_DEFS.find(c => c.key === key) ?? CATEGORY_DEFS[CATEGORY_DEFS.length - 1];
}
