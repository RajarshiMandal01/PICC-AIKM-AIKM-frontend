import { getEnvCode, getXUser, getXuserType } from '../shared/utils';
import { KmApiError } from './kmApiService';

export { KmApiError } from './kmApiService';

const SQL_BASE_URL = import.meta.env.VITE_SQL_SERVICE_URL ?? 'http://localhost:8001';

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

const sqlApi = {
  get: <T = any>(path: string): Promise<T> =>
    fetch(`${SQL_BASE_URL}${path}`, {
      method: 'GET',
      headers: buildHeaders(),
    }).then(handleResponse),

  post: <T = any>(path: string, body: unknown): Promise<T> =>
    fetch(`${SQL_BASE_URL}${path}`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(body),
    }).then(handleResponse),
};

export default sqlApi;
