import { Route, Routes } from 'react-router-dom'
import { Dashboard } from './pages/Dashboard.js'
import { JobDetail } from './pages/JobDetail.js'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/jobs/:id" element={<JobDetail />} />
    </Routes>
  )
}
