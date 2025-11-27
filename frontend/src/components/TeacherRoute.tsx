import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { jwtDecode } from 'jwt-decode';

const TeacherRoute = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" />;
  }

  const decoded = jwtDecode(user.access_token);
  if (decoded.role !== 'teacher' && decoded.role !== 'admin') {
    return <Navigate to="/" />;
  }

  return children;
};

export default TeacherRoute;
