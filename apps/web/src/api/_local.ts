/** 本地演示数据统一返回结构，不再请求 /mock 接口 */
export const ok = <T>(data: T, message = 'ok'): Promise<IResponse<T>> => {
  return Promise.resolve({ code: 200, data, message })
}
