import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CaptureOverlay } from './components/Capture/CaptureOverlay.tsx'

const isCapture = new URLSearchParams(window.location.search).get('capture') === 'true';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isCapture ? <CaptureOverlay /> : <App />}
  </StrictMode>,
)
