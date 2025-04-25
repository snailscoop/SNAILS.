import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import './index.css'
import { NostrProvider } from './contexts/NostrContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <NostrProvider>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'rgba(10, 26, 51, 0.95)',
              color: '#fff',
              minWidth: '250px',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#4cd964',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#ff3b30',
                secondary: '#fff',
              },
            },
          }}
        />
      </NostrProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
