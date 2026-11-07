import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`
  void navigator.serviceWorker.register(serviceWorkerUrl, { scope: import.meta.env.BASE_URL })
    .catch((error: unknown) => console.error('Não foi possível habilitar o uso offline do GranaZen.', error))
}
