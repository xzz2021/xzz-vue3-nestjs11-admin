import type { AxiosError } from 'axios'
import { ElMessage } from 'element-plus'

type ErrorResponse = {
  message?: string | string[]
}

const isErrorResponse = (value: unknown): value is ErrorResponse => {
  return typeof value === 'object' && value !== null && 'message' in value
}

export const showAxiosError = (msg: string) => {
  ElMessage({
    message: msg.length > 150 ? msg.slice(0, 150) : msg,
    grouping: true,
    type: 'error',
  })
}

export const getAxiosErrorMessage = (error: AxiosError<unknown>): string => {
  const status = error.response?.status
  const responseData = error.response?.data
  const serverMessage = isErrorResponse(responseData) ? responseData.message : undefined

  if (typeof serverMessage === 'string' && serverMessage) {
    return serverMessage
  }

  if (Array.isArray(serverMessage) && serverMessage.length) {
    return serverMessage.join(', ')
  }

  if (error.code === 'ECONNABORTED') {
    return '请求超时，请检查后端服务是否正常运行'
  }

  if (error.code === 'ERR_NETWORK' || !error.response) {
    return '无法连接后端服务，请确认后端进程已启动且网络正常'
  }

  switch (status) {
    case 503:
      return '服务暂时不可用，请稍后重试'
    case 500:
      return '请检查网络或后端服务是否开启'
    case 404:
      return '接口不存在，请联系后端管理员'
    case 403:
      return '当前用户没有操作权限，请联系管理员'
    case 401:
      return '登录过期，鉴权失败，请重新登录'
    default:
      return error.message || '请检查网络或后端服务是否开启'
  }
}
