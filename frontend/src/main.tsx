// Note: StrictMode causes double-mount and double-effect execution in dev
// which breaks some DOM-manipulating libs (e.g., masonry) with removeChild errors.
// Disable in development for stability; keep it enabled in production builds if desired.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const isDev = import.meta.env.DEV;

createRoot(document.getElementById('root')!).render(
  isDev ? <App /> : (
    <StrictMode>
      <App />
    </StrictMode>
  )
)
