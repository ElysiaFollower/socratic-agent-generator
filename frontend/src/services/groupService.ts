import axios from 'axios';
import authHeader from './authHeader';

const API_URL = '/api';

const joinGroup = (inviteCode: string) => {
  return axios.post(`${API_URL}/groups/join`, { invite_code: inviteCode }, { headers: authHeader() });
};

const getGroupTutors = (groupId: number) => {
  return axios.get(`${API_URL}/groups/${groupId}/tutors`, { headers: authHeader() });
};

const getUserGroup = () => {
  return axios.get(`${API_URL}/users/me/group`, { headers: authHeader() });
}

const groupService = {
  joinGroup,
  getGroupTutors,
  getUserGroup,
};

export default groupService;
