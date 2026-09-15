import ApiService from "./api.service";

export interface ExecutionJob {
  job_id: string;
  status: 'success' | 'failed' | 'pending' | string;
  progress: number;
  project_name: string;
  gitlab_repo: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  error_message: string | null;
  created_at: string;
}

export interface NewExecutionPayload {
  projectTitle: string;
  repoUrl: string;
  repoToken: string;
  projectName: string;
  requirementDocument: File | null;
  generationOptions: {
    wbs: boolean;
    designDoc: boolean;
    backendCode: boolean;
    frontendCode: boolean;
    database: boolean;
    testScripts: boolean;
  };
  techStack: {
    language: string;
    framework: string;
    uiTech: string;
    database: string;
    testScript: string;
  };
}

const JOB_URL = import.meta.env.VITE_JOB_BASE_URL as string || 'http://10.26.143.21:32192';
const TRANSACTION_URL = import.meta.env.VITE_TRANSACTION_BASE_URL as string;

const GET_JOBS_BY_USER = JOB_URL + '/jobs/by-user';
const GENERATE_REQUEST = TRANSACTION_URL + '/generateRequest'; 
// --- NEW ENDPOINT ADDED HERE ---
const VALIDATE_APP_NAME = TRANSACTION_URL + '/validateAppName'; 

export const TransactionService = {
  getJobsByUser: (username: string) => 
    ApiService.get<ExecutionJob[]>(`${GET_JOBS_BY_USER}/${username}`),
    
  generateRequest: (payload: NewExecutionPayload) => 
    ApiService.post<any>(GENERATE_REQUEST, payload),
    
  // --- NEW METHOD ADDED HERE ---
  validateAppName: (payload: any) => 
    ApiService.post<any>(VALIDATE_APP_NAME, payload)
};