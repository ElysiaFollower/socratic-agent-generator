import React, { createContext, useContext, useState, ReactNode } from 'react';
import authService from '../services/authService';

interface AuthContextType {
  user: any;
  login: (username, password) => Promise<any>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(authService.getCurrentUser());

  const login = async (username, password) => {
    const response = await authService.login(username, password);
    setUser(response);
    return response;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
