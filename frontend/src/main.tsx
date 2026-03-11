import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './store/auth'
import App from './App'
import './index.css'

function Index() {
  const { fetchUser } = useAuthStore();

  React.useEffect(() => {
    // 应用启动时检查用户认证状态
    fetchUser();
  }, [fetchUser]);

  return (
    <Toaster
      position="top-center"
      toastOptions={{
        duration: 3000,
        style: {
          background: '#1e293b',
          color: '#f1f5f9',
          border: '1px solid #334155',
        },
        success: {
          iconTheme: {
            primary: '#10b981',
            secondary: '#f1f5f9',
          },
        },
        error: {
          iconTheme: {
            primary: '#ef4444',
            secondary: '#f1f5f9',
          },
        },
      }}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Index />
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
