import { StrictMode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import App from '../../src/App.jsx'

export default function IngredientFlowApp() {
  return <StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>
}
