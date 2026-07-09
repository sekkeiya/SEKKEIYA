import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Initialize the global panel singleton with our Firestore instance
import { db } from "@presents/lib/firebase";
import { setGlobalDb } from "@sekkeiya/global-panel";
setGlobalDb(db);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
