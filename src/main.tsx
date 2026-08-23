import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { AppProvider } from './store/app'
import { UiProvider } from './store/ui'
import { SessionProvider } from './store/session'
import { BASE } from './api/client'

import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/layout.css'
import './styles/screens.css'
import './styles/app.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Обновления приходят по SSE, поэтому периодический опрос не нужен.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
})

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

createRoot(root).render(
  <StrictMode>
    <BrowserRouter basename={BASE || undefined}>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <SessionProvider>
            <UiProvider>
              <App />
            </UiProvider>
          </SessionProvider>
        </AppProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
