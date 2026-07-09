import { createRoot } from 'react-dom/client'
// エディトリアル(誌面)テーマ用の Web フォント（オフライン同梱）
import '@fontsource/shippori-mincho/400.css'
import '@fontsource/shippori-mincho/600.css'
import '@fontsource/shippori-mincho/700.css'
import '@fontsource/shippori-mincho/800.css'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
// a+u 的な Didone 見出し（Journal 人格）
import '@fontsource/bodoni-moda/400.css'
import '@fontsource/bodoni-moda/600.css'
import '@fontsource/bodoni-moda/700.css'
import './index.css'
import App from './App.tsx'
import { CaptureOverlay } from './components/Capture/CaptureOverlay.tsx'
import { SearchWindow } from './features/search/SearchWindow.tsx'
import { ReaderWindow } from './features/dsb/ReaderWindow.tsx'

const params = new URLSearchParams(window.location.search);
const isCapture = params.get('capture') === 'true';
const isSearchWindow = params.get('searchWindow') === 'true';
const isReaderWindow = params.get('readerWindow') === 'true';

// ★ StrictMode は意図的に外している。StrictMode は dev で全 effect を二重実行するため、
// アプリ全体で 100 本超の Firestore onSnapshot が subscribe→unsubscribe→subscribe と
// ミリ秒単位で張り替わり、firebase-js-sdk の既知バグ（WatchChangeAggregator の
// INTERNAL ASSERTION FAILED ca9/b815, firebase-js-sdk#9267・未修正）を高確率で誘発する。
// 一度発生すると Firestore クライアントが汚染され、以降の全読み書きが失敗する。
createRoot(document.getElementById('root')!).render(
  isCapture ? <CaptureOverlay />
    : isSearchWindow ? <SearchWindow />
    : isReaderWindow ? <ReaderWindow />
    : <App />,
)
