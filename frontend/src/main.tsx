/**
 * SPA entry. React escapes text in JSX, mitigating XSS when showing API strings;
 * never inject raw HTML from the API without a vetted sanitizer.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
