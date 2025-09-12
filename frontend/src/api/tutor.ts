import axios from 'axios'

export interface Session {
  session_id: string
  session_name: string
  profile: string
  topic_name: string
  created_at: string
}

export interface SendMessageResponse {
  reply: string;
  state: {
    step: number;
  };
  is_finished: boolean;
}

export async function listProfiles(): Promise<string[]> {
  const res = await axios.get('/api/profiles') //获取所有可用的配置文件
  return res.data
}

export async function createSession(profile: string): Promise<{session_id: string}> {
  const res = await axios.post('/api/tutor/session', { profile })
  return res.data
}

export async function getWelcomeMessage(sessionId: string): Promise<{welcome: string}> {
  const res = await axios.get(`/api/tutor/${sessionId}/welcome`)
  return res.data
}

export async function sendMessage(sessionId: string, message: string): Promise<SendMessageResponse> {
  const res = await axios.post(`/api/tutor/${sessionId}/message`, { message });
  // 后端返回的数据结构现在是 { reply: "...", state: { step: X }, is_finished: false }
  return res.data;
}

export async function getState(sessionId: string) {
  const res = await axios.get(`/api/tutor/${sessionId}/state`)
  return res.data
}

export async function getChatHistory(sessionId: string): Promise<{messages: {role: string, content: string}[]}> {
  const res = await axios.get(`/api/tutor/${sessionId}/history`)
  return res.data
}

export async function listSessions(): Promise<Session[]> {
  const res = await axios.get('/api/sessions') //获取所有会话
  return res.data
}

export async function renameSession(sessionId: string, name: string): Promise<{success: boolean, message: string}> {
  const res = await axios.put(`/api/sessions/${sessionId}/rename`, { name })
  return res.data
}

export async function deleteSession(sessionId: string): Promise<{success: boolean, message: string}> {
  const res = await axios.delete(`/api/sessions/${sessionId}`)
  return res.data
}
