import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { App } from './App'
import { AppProvider } from './store/app'
import { UiProvider } from './store/ui'

import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/layout.css'
import './styles/screens.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <AppProvider>
        <UiProvider>
          <App />
        </UiProvider>
      </AppProvider>
    </HashRouter>
  </StrictMode>,
)
