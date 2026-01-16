import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './globals.css'
import { GoogleOAuthProvider } from '@react-oauth/google'

// Use the client ID from environment or fallback to the known working one
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "916021425519-3kfbkp16dpt63q8ngmbu0glerftrnif9.apps.googleusercontent.com"

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <App />
        </GoogleOAuthProvider>
    </React.StrictMode>,
)
