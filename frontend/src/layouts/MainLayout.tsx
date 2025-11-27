import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { jwtDecode } from 'jwt-decode';

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const decoded = user ? jwtDecode(user.access_token) : null;

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-white shadow-md">
        <div className="p-4 text-2xl font-bold">Socratic Tutor</div>
        <nav className="mt-8">
          <NavLink to="/" className="block px-4 py-2 text-gray-600 hover:bg-gray-200">Home</NavLink>
          {decoded?.role === 'admin' && <NavLink to="/admin" className="block px-4 py-2 text-gray-600 hover:bg-gray-200">Admin</NavLink>}
          {decoded?.role === 'teacher' && <NavLink to="/teacher" className="block px-4 py-2 text-gray-600 hover:bg-gray-200">Teacher</NavLink>}
          {decoded?.role === 'student' && <NavLink to="/student" className="block px-4 py-2 text-gray-600 hover:bg-gray-200">Student</NavLink>}
        </nav>
        <div className="absolute bottom-0 w-64 p-4">
          <button onClick={logout} className="w-full px-4 py-2 text-white bg-red-500 rounded hover:bg-red-600">Logout</button>
        </div>
      </div>
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
