import axios from 'axios'

export interface Session {
  session_id: string
  session_name: string
  profile: string
  topic_name: string
  created_at: string
}

export async function listProfiles(): Promise<string[]> {
  const res = await axios.get('/api/profiles')
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

export async function sendMessage(sessionId: string, message: string): Promise<{reply: string}> {
  const res = await axios.post(`/api/tutor/${sessionId}/message`, { message })
  return res.data
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
  const res = await axios.get('/api/sessions')
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
