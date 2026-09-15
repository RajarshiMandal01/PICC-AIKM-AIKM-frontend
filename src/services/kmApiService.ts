import { getEnvCode, getXUser, getXuserType } from '../shared/utils';

const BASE_URL = import.meta.env.VITE_KM_SERVICE_URL ?? 'http://localhost:8000';

export class KmApiError extends Error {
  readonly detail: string;
  readonly requestId: string | null;
  readonly status: number;

  constructor(detail: string, requestId: string | null, status: number) {
    super(detail);
    this.name = 'KmApiError';
    this.detail = detail;
    this.requestId = requestId;
    this.status = status;
  }
}

const buildHeaders = (): HeadersInit => ({
  'Content-Type': 'application/json',
  'User': getXUser(),
  'X-Env-Code': getEnvCode()?.envCode ?? '',
  'X-User-Type': getXuserType(),
});

const handleResponse = async (response: Response): Promise<any> => {
  const requestId = response.headers.get('X-Request-ID');
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      if (body.detail) detail = body.detail;
    } catch {
      // fall back to statusText
    }
    throw new KmApiError(detail, requestId, response.status);
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('json')) return null;
  return response.json();
};

const kmApi = {
  get: <T = any>(path: string): Promise<T> =>
    fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse),

  post: <T = any>(path: string, body: unknown): Promise<T> =>
    fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  put: <T = any>(path: string, body: unknown): Promise<T> =>
    fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),

  delete: <T = any>(path: string): Promise<T> =>
    fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      headers: buildHeaders(),
    }).then(handleResponse),

  postForm: <T = any>(path: string, formData: FormData): Promise<T> =>
    fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      // No Content-Type header — browser sets it with the multipart boundary automatically
      headers: {
        'User': getXUser(),
        'X-Env-Code': getEnvCode()?.envCode ?? '',
        'X-User-Type': getXuserType(),
      },
      body: formData,
    }).then(handleResponse),
};

export { kmApi };
export default kmApi;
