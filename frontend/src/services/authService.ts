import axios from 'axios';

const API_URL = '/api';

const login = async (username, password) => {
  const response = await axios.post(`${API_URL}/token`, {
    username,
    password,
  }, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    transformRequest: (data) => {
      return new URLSearchParams(data).toString();
    }
  });
  if (response.data.access_token) {
    localStorage.setItem('user', JSON.stringify(response.data));
  }
  return response.data;
};

const logout = () => {
  localStorage.removeItem('user');
};

const getCurrentUser = () => {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    return JSON.parse(userStr);
  }
  return null;
};

const authService = {
  login,
  logout,
  getCurrentUser,
};

export default authService;
