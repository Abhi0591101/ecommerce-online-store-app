import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { CartProvider } from './context/CartContext.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { PlatformProvider } from './context/PlatformContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <PlatformProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </PlatformProvider>
      </AuthProvider>
    </LanguageProvider>
  </StrictMode>,
)
