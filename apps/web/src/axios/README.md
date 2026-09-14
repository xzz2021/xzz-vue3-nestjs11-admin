# Axios 封装说明

Admin 业务请求统一通过 `@/axios` 发起。当前封装提供鉴权、Token 静默刷新、业务响应校验、请求取消、错误提示、参数序列化及上传/下载支持。

## 目录结构

```text
axios/
├── index.ts    # 对外 HTTP 门面与请求取消绑定
├── client.ts   # Axios 实例、请求/响应拦截器、Body 转换
├── auth.ts     # Token 注入、并发刷新和重试
├── pending.ts  # AbortController 注册、取消与清理
├── error.ts    # HTTP 错误文案和 Toast
└── types.ts    # 可取消 Promise 与 Axios 类型增强
```

实例创建和拦截器注册集中在 `client.ts`。模块热更新时会整体替换实例，不会在保留的实例上重复安装拦截器。

## 基本使用

```ts
import request from '@/axios'

const response = await request.get<UserItem[]>({
  url: 'user/list',
  params: { page: 1 }
})

// response: IResponse<UserItem[]>
console.log(response.data)
```

门面提供：

- `get`
- `post`
- `put`
- `delete`
- `download`
- `cancelRequest`
- `cancelAllRequest`

另具名导出 `PATH_URL`，供确有需要的基础设施代码使用。

## 响应约定

普通接口必须返回：

```ts
interface IResponse<T> {
  code: number
  data: T
  message: string
}
```

处理规则：

1. `code === SUCCESS_CODE` 时返回完整 `IResponse<T>`。
2. 业务码失败时显示后端 `message` 并拒绝请求。
3. HTTP 失败时统一映射错误文案并保留 `AxiosError`。
4. 取消请求只拒绝，不显示错误 Toast。
5. 文件下载必须使用 `request.download()`，不要给 `get/post` 传 `responseType: 'blob'`。

## 鉴权与刷新

请求拦截器从用户 Store 获取 Token，并按可配置的 Token key 写入：

```text
Authorization: Bearer <token>
```

收到 HTTP `401` 或 `406` 时：

1. 仅对携带现有 Token 且尚未重试的请求处理。
2. 并发失败请求共享同一个 Refresh Promise。
3. 如果其他请求已经刷新成功，直接使用 Store 中的最新 Token 重试。
4. 原请求通过 `_retry` 保证最多重试一次。
5. Refresh 请求使用独立 Axios 客户端及 `withCredentials: true`。
6. Refresh 返回 401 时清理登录态。

## 上传与 Body 转换

请求显式设置以下 Content-Type 时会自动转换：

- `application/x-www-form-urlencoded`：通过 `qs.stringify` 序列化。
- `multipart/form-data`：普通对象转换为 `FormData`；已有 `FormData` 保持不变。

```ts
const data = new FormData()
data.append('file', file)

await request.post({
  url: 'staticfile/upload',
  data,
  headers: { 'Content-Type': 'multipart/form-data' }
})
```

普通对象请求由 Axios 按 JSON 处理，无需业务代码重复设置 Content-Type。

## 文件下载

```ts
import request from '@/axios'

const file = await request.download({
  url: 'minio/download',
  params: { objectName }
})

const blob = file.data
const disposition = file.headers['content-disposition']
```

`download` 固定 `responseType: 'blob'`，跳过业务码校验，返回 `{ data: Blob, headers }`。JSON 接口继续用 `get/post/put/delete`，始终得到 `IResponse<T>`。

## 请求取消

每次门面请求都会创建独立 `AbortController`。成功、失败或取消后会清理 pending 记录。

取消指定 URL：

```ts
request.cancelRequest('user/list')
```

取消全部请求：

```ts
request.cancelAllRequest()
```

单个返回 Promise 也支持取消：

```ts
const pending = request.get({ url: 'user/list' })
pending.cancel()
```

Token 刷新重试沿用同一 signal，因此刷新等待期间执行取消仍然有效。

## 参数序列化

查询参数统一通过 `qs` 序列化：

- 数组使用 repeat 格式。
- `null` 和 `undefined` 不写入 URL。

示例：

```ts
{
  roleIds: [1, 2]
}
// roleIds=1&roleIds=2
```

## 重复请求策略

HTTP 层不再全局节流，也不会因为一秒内请求指纹相同而主动拒绝请求。

防重复提交应根据业务场景处理，例如：

- 提交按钮 loading/disabled。
- 搜索输入防抖。
- 特定接口使用幂等键。
- 服务端执行幂等与限流。

## 维护约定

1. 业务接口只通过 `@/axios` 调用，不直接使用全局 Axios。
2. 不在页面重复实现 Token 刷新或 HTTP 错误 Toast。
3. 修改响应处理时必须同时验证普通业务响应和 Blob 响应。
4. 修改刷新策略时必须验证并发 401、刷新失败和取消请求。
5. 对外门面及 `PATH_URL` 保持向后兼容。

## 验证命令

```bash
pnpm --filter admin typecheck
pnpm --filter admin exec eslint "src/axios/**/*.ts"
pnpm --filter admin build:pro
```
