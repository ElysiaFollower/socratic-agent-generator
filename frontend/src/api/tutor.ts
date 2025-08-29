import axios from 'axios'

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
