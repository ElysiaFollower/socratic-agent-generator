import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import TeacherRoute from './components/TeacherRoute';
import StudentRoute from './components/StudentRoute';
import MainLayout from './layouts/MainLayout';
import { Toaster } from '@/components/ui/sonner';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<PrivateRoute><MainLayout><HomePage /></MainLayout></PrivateRoute>} />
          <Route path="/admin" element={<AdminRoute><MainLayout><AdminDashboard /></MainLayout></AdminRoute>} />
          <Route path="/teacher" element={<TeacherRoute><MainLayout><TeacherDashboard /></MainLayout></TeacherRoute>} />
          <Route path="/student" element={<StudentRoute><MainLayout><StudentDashboard /></MainLayout></StudentRoute>} />
        </Routes>
        <Toaster />
      </Router>
    </AuthProvider>
  );
};

export default App;
