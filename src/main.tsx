import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { bundledSource } from './content/source.ts'
import { DexieProgressStore } from './store/dexieStore.ts'
import { createAppStore } from './store/appStore.ts'

const store = createAppStore(new DexieProgressStore())
const content = bundledSource()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App store={store} content={content} />
    </HashRouter>
  </StrictMode>,
)
