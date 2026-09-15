import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.scss'
import HeaderLayout from './shared/layout/header';
import NotFound from './pages/not_found';
import DashboardComponent from './pages/dashboard'; // Assuming this is the Knowledge Base app
import SqlQuery from './pages/sqlquery'; // Add your new SQL Query component import
import ModuleComponent from './pages/module';
import PlatformSpec from './components/platform-spec';
import ApiSpec from './components/api-spec';
import { ToasterProvider } from './contexts/ToasterContext';

const App: React.FC = () => {
  const basename = import.meta.env.VITE_BASE_URL || '/';

  return (
    <ToasterProvider>
      <Router basename={basename}>
        <HeaderLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            {/* Knowledge Base Route */}
            <Route path="/dashboard" element={<DashboardComponent />} />
            
            {/* NEW SQL Database Query Route */}
            <Route path="/sql-query" element={<SqlQuery />} />

            <Route path='/module/:id' element={<ModuleComponent />} >
              <Route path='platform/:componentId' element={<PlatformSpec />} />
              <Route path='api/:componentId' element={<ApiSpec />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </HeaderLayout>
      </Router>
    </ToasterProvider>
  )
}

export default App