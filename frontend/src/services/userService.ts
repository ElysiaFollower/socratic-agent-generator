import axios from 'axios';
import authHeader from './authHeader';

const API_URL = '/api';

const getUsers = () => {
  return axios.get(`${API_URL}/users/`, { headers: authHeader() });
};

const userService = {
  getUsers,
};

export default userService;
