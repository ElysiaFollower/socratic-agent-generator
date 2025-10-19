import axios from 'axios'

export interface SocraticStep {
  step_title: string
  guiding_question: string
  success_criteria: string
  learning_objective: string
}

export interface SocraticCurriculum {
  root: SocraticStep[]
}

// 兼容性：curriculum可能是直接的数组或包含root字段的对象
export type CurriculumData = SocraticStep[] | SocraticCurriculum

// 辅助函数：安全地提取curriculum数组
export function extractCurriculumSteps(curriculum: CurriculumData): SocraticStep[] {
  if (Array.isArray(curriculum)) {
    return curriculum
  } else if (curriculum && typeof curriculum === 'object' && 'root' in curriculum) {
    return curriculum.root
  }
  return []
}

export interface Profile {
  profile_id: string
  profile_name: string
  topic_name: string
  persona_hints: string[]
  target_audience: string
  curriculum: CurriculumData
  prompt_template: string
  create_at: string
}

export interface Session {
  session_id: string
  session_name: string
  profile: Profile
  state: {
    stepIndex: number
  }
  create_at: string
  update_at: string
  output_language: string
  history: Array<{
    type: string
    content: string
    timestamp?: string
  }>
}

export interface SessionSummary {
  session_id: string
  session_name: string
  profile_id: string
  profile_name: string
  topic_name: string
  create_at: string
  update_at: string
}

export interface CreateSessionRequest {
  profile_id: string
  session_name: string
  output_language: string
}

export interface MessageRequest {
  message: string
}

export interface RenameSessionRequest {
  session_name: string
}

export interface SendMessageResponse {
  reply: string;
  state: {
    stepIndex: number;
  };
  is_finished: boolean;
}

export interface SessionState {
  stepIndex: number
  totalSteps: number
  isFinished: boolean
}

export async function listProfiles(): Promise<Profile[]> {
  const res = await axios.get('/api/profiles') //获取所有可用的配置文件
  return res.data
}

export async function createSession(request: CreateSessionRequest): Promise<{session_id: string}> {
  const res = await axios.post('/api/sessions/create', request)
  return res.data
}

export async function getWelcomeMessage(sessionId: string): Promise<{welcome: string}> {
  const res = await axios.get(`/api/tutor/${sessionId}/welcome`)
  return res.data
}

// 流式发送消息接口
export async function sendMessageStream(
  sessionId: string, 
  message: string,
  onToken: (token: string) => void,
  onComplete: (response: SendMessageResponse) => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    const response = await fetch(`/api/sessions/${sessionId}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body reader available');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'token') {
              onToken(parsed.data);
            } else if (parsed.type === 'END') {
              onComplete(parsed.data);
            } else if (parsed.type === 'error') {
              onError(parsed.data);
            }
          } catch (e) {
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    }
  } catch (error) {
    onError(error instanceof Error ? error.message : 'Unknown error');
  }
}

// 注意：后端已改为流式接口，此同步接口可能不工作
// 建议使用 sendMessageStream 替代
export async function sendMessage(sessionId: string, message: string): Promise<SendMessageResponse> {
  const res = await axios.post(`/api/sessions/${sessionId}/messages/stream`, { message });
  return res.data;
}

export async function getState(sessionId: string): Promise<SessionState> {
  const res = await axios.get(`/api/tutor/${sessionId}/state`)
  return res.data
}

// 获取会话详情
export async function getSession(sessionId: string): Promise<Session> {
  const res = await axios.get(`/api/sessions/${sessionId}`)
  return res.data
}

export async function listSessions(): Promise<SessionSummary[]> {
  const res = await axios.get('/api/sessions') //获取所有会话
  return res.data
}

export async function renameSession(sessionId: string, request: RenameSessionRequest): Promise<{success: boolean, message: string}> {
  const res = await axios.put(`/api/sessions/${sessionId}/rename`, request)
  return res.data
}

export async function deleteSession(sessionId: string): Promise<{success: boolean, message: string}> {
  const res = await axios.delete(`/api/sessions/${sessionId}`)
  return res.data
}

// 健康检查接口
export async function healthCheck(): Promise<{status: string}> {
  const res = await axios.get('/api/health')
  return res.data
}
