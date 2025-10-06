import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css' // Tailwind/全域樣式（沒有也可先保留）

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
