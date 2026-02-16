import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Ce fichier fait le lien entre le HTML et votre Application
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
