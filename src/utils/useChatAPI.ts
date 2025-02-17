import { fetchApi } from '.'
import { chatyDebug } from '../main/prepare/debug'
const chatGPTUrl = 'https://api.openai.com/v1/chat/completions'

const chatWithGPT = async (messages: any[], context: string) => {
  const headers: Record<string, any> = {
    Authorization: `Bearer ${process.env.OPEN_AI_KEY!}`
  }
  let apiUrl = chatGPTUrl
  let { CHATY_PROXY } = process.env
  if (CHATY_PROXY) {
    if (CHATY_PROXY[CHATY_PROXY.length - 1] !== '/') {
      CHATY_PROXY += '/'
    }
    headers.origin = 'https://app.uniswap.org'
    apiUrl = CHATY_PROXY + chatGPTUrl
  }
  const answer = await fetchApi(
    apiUrl,
    'POST',
    { headers },
    {
      model: 'gpt-3.5-turbo',
      messages,
      context // 添加 context 参数到请求体中
    }
  )
  return answer
}

export const messageManager = (() => {
  const messageMap = new Map<any, any[]>()
  const usageList: Record<string, any[]> = {};
  return {
    addUsage: (usage: any, user: string) =>{
      if (!usageList[user]) {
        usageList[user] = []
      }
      usageList[user].push(usage)
    },
    getUsage: (user: string) => {
      if (usageList[user]) {
        return usageList[user]
      }
    },
    sendMessage: (content: string, user: string) => {
      if (!messageMap.get(user)) {
        messageMap.set(user, [])
      }
      const data = messageMap.get(user)
      data?.push({ role: 'user', content })
    },
    concatAnswer: (content: string, user: string) => {
      if (!messageMap.get(user)) {
        messageMap.set(user, [])
      }
      const data = messageMap.get(user)
      data?.push({ role: 'assistant', content })
    },
    getMessages: (user: string) => messageMap.get(user),
    shiftMessage: (user: string) => {
      const data = messageMap.get(user)
      data?.shift()
    },
    popMessage: (user: string) => {
      const data = messageMap.get(user)
      data?.pop()
    },
    clearMessage: (user: string) => {
      messageMap.delete(user)
    }
  }
})()

export async function resetMessage (user: string) {
  messageManager.clearMessage(user)
}
export async function sendMessage (message: string, user: string) {
  try {
    messageManager.sendMessage(message, user)
    const messages = messageManager.getMessages(user)
    const context = JSON.stringify(messages) // 将聊天历史记录序列化为上下文信息
    const completion = await chatWithGPT(messages!, context) // 传递上下文信息到 chatWithGPT 函数中
    const answer = completion.choices[0].message.content
    messageManager.concatAnswer(answer, user)
    messageManager.addUsage(completion.usage, user)
    return answer
  } catch (err) {
    messageManager.popMessage(user)
    chatyDebug((err as Error).message)
    let errorBody = (err as Error & { response: any })?.response?.data
    chatyDebug(errorBody)
    try {
      errorBody = JSON.stringify(errorBody)
    } catch (_) {}
    return `${(err as Error).message}` || `${errorBody as string}`
  }
}
