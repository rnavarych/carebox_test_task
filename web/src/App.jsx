import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TaskDescription from './pages/TaskDescription'
import EmailTemplates from './pages/EmailTemplates'
import Pipeline from './pages/Pipeline'
import TestPlans from './pages/TestPlans'
import Logs from './pages/Logs'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import ApiNotification from './components/ApiNotification'
import PipelineProgress from './components/PipelineProgress'

function App() {
  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <PipelineProgress />
      <ApiNotification />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/test-task" replace />} />
          <Route path="/test-task" element={<TaskDescription />} />
          <Route path="/source" element={<EmailTemplates />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/test-plans" element={<TestPlans />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
