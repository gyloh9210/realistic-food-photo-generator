import { Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home.js'
import { RunPage } from './pages/RunPage.js'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/runs/:runId" element={<RunPage />} />
    </Routes>
  )
}
