// import { getAuthToken } from '../utils/auth';

import { getEnvCode, getXUser, getXuserType } from "../shared/utils";


const buildHeaders = (customHeaders: HeadersInit = {}): HeadersInit => {
  //   const token = getAuthToken();
  const token = null

  return {
    'Content-Type': 'application/json',
    'X-Env-Code' :  getEnvCode()?.envId, //'REL-V2023.01'
    'X-User-Type': getXuserType(), //'superAdmin',
    'User':  getXUser(),
    ...customHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    if (response.status === 401) {
      const currentDomain = window.location.origin;
      const currentUrl = window.location.href;
      console.log(
        "Redirecting to login page:",
        `${currentDomain}/nnp-login/continue=${currentUrl}`
      );
      window.location.href = `${currentDomain}/nnp-login/continue=${currentUrl}`;
    }
    const error = new Error(response.statusText);
    throw error;
  }
  
  // Check if response has content to parse
  const contentType = response.headers.get('content-type');
  const hasJsonContent = contentType && contentType.includes('json');
  
  // For responses without content (like 204 No Content or empty responses)
  if (response.status === 204 || !hasJsonContent) {
    return null;
  }
  
  // Try to parse JSON content
  try {
    const data = await response.json();
    return data;
  } catch {
    console.error('Failed to parse response as JSON');
    throw new Error('Invalid JSON response');
  }
};

const ApiService = {
  get: async <T = any>(url: string, headers?: HeadersInit): Promise<T> => {
    const response = await fetch(`${url}`, {
      method: 'GET',
      headers: buildHeaders(headers),
    });
    return handleResponse(response);
  },

  post: async <T = any>(url: string, body: any, headers?: HeadersInit): Promise<T> => {
    const response = await fetch(`${url}`, {
      method: 'POST',
      headers: buildHeaders(headers),
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  put: async <T = any>(url: string, body: any, headers?: HeadersInit): Promise<T> => {
    const response = await fetch(`${url}`, {
      method: 'PUT',
      headers: buildHeaders(headers),
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },

  delete: async <T = any>(url: string, body?: any, headers?: HeadersInit): Promise<T> => {
    const response = await fetch(`${url}`, {
      method: 'DELETE',
      headers: buildHeaders(headers),
      body: JSON.stringify(body),
    });
    return handleResponse(response);
  },
};

export default ApiService;
