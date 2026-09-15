export const API_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  LOADED: 'loaded',
  FAILED: 'failed'
} as const;

export type APIStatus = typeof API_STATUS[keyof typeof API_STATUS];

export interface DataWithStatus<T> {
    data: T | null;
    status: APIStatus;
}