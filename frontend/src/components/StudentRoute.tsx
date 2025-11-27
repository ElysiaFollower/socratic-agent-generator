import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { jwtDecode } from 'jwt-decode';

const StudentRoute = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" />;
  }

  const decoded = jwtDecode(user.access_token);
  if (decoded.role !== 'student' && decoded.role !== 'admin') {
    return <Navigate to="/" />;
  }

  return children;
};

export default StudentRoute;
