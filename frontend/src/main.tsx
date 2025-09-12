import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render( // 把下面内容渲染到root元素中
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
