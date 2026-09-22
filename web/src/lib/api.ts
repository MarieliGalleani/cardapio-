// Cliente HTTP do painel. Guarda o token de login no navegador.
const TOKEN_KEY = 'cardapio.token'

export const auth = {
  get token() {
    return localStorage.getItem(TOKEN_KEY)
  },
  set token(value: string | null) {
    if (value) localStorage.setItem(TOKEN_KEY, value)
    else localStorage.removeItem(TOKEN_KEY)
  },
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (auth.token) headers.authorization = `Bearer ${auth.token}`
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['content-type'] = 'application/json'

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })

  if (res.status === 401 && path.startsWith('/admin')) {
    auth.token = null
    window.location.href = '/admin/login'
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const issue = data.issues?.[0]?.message
    throw new ApiError(res.status, issue ?? data.error ?? 'Algo deu errado')
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  del: (path: string) => request<void>('DELETE', path),
}
