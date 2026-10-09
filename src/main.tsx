import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { DexieProgressStore } from './store/dexieStore.ts'
import { createAppStore } from './store/appStore.ts'

const store = createAppStore(new DexieProgressStore())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App store={store} />
    </HashRouter>
  </StrictMode>,
)
