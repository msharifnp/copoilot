import axios, { AxiosInstance, AxiosError } from "axios";
import { config } from "./config";

export type UploadFilePart = { 
  name: string; 
  type: string; 
  data: Buffer; 
};

export interface ChatResponse { 
  response: string; 
  session_id?: string;
  message_count?: number;
}

export interface CodeCompletionResponse { 
  completion: string; 
}

class ApiClient {
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: config.endpoint,
      timeout: config.timeout,
      headers: {
        'User-Agent': 'VSCode-RaaS-Extension/1.0.0'
      }
    });

    // Add request interceptor for debugging
    this.http.interceptors.request.use(
      (config) => {
        console.log(`[RaaS] Request: ${config.method?.toUpperCase()} ${config.url}`);
        console.log(`[RaaS] Headers:`, config.headers);
        if (config.data && !(config.data instanceof FormData)) {
          console.log(`[RaaS] Data:`, config.data);
        }
        return config;
      },
      (error) => {
        console.error('[RaaS] Request error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for better error handling
    this.http.interceptors.response.use(
      (response) => {
        console.log(`[RaaS] Response: ${response.status} ${response.statusText}`);
        return response;
      },
      (error: AxiosError) => {
        console.error('[RaaS] Response error:', error.response?.status, error.response?.statusText);
        console.error('[RaaS] Error data:', error.response?.data);
        
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Unable to connect to RaaS server. Please check if the server is running and the URL is correct.');
        } else if (error.code === 'ETIMEDOUT') {
          throw new Error('Request timed out. The server may be overloaded.');
        } else if (error.response?.status === 404) {
          throw new Error('API endpoint not found. Please check your configuration.');
        } else if (error.response?.status === 422) {
          const errorData = error.response.data as any;
          if (errorData?.detail) {
            // Handle FastAPI validation errors
            if (Array.isArray(errorData.detail)) {
              const validationErrors = errorData.detail.map((err: any) => 
                `${err.loc?.join('.') || 'field'}: ${err.msg}`
              ).join(', ');
              throw new Error(`Validation error: ${validationErrors}`);
            } else {
              throw new Error(`Validation error: ${errorData.detail}`);
            }
          } else {
            throw new Error('Request validation failed. Please check the data format.');
          }
        } else if (error.response?.status === 500) {
          throw new Error('Server error occurred. Please try again later.');
        }
        
        throw error;
      }
    );
  }

  async sendChatForm(text: string, files: UploadFilePart[] = [], sessionId?: string): Promise<ChatResponse> {
    try {
      const url = config.toUrl(config.chatPath);
      console.log(`[RaaS] Sending chat request to: ${url}`);
      console.log(`[RaaS] Session ID: ${sessionId}`);
      
      // Always use form data to handle session_id consistently
      const formData = new FormData();
      formData.append("text", text || "");
      formData.append("user_id", "sharif_200");
      
      // Add session_id if provided
      if (sessionId) {
        formData.append("session_id", sessionId);
      }

      // Add files to form data
      if (files && files.length > 0) {
        for (const file of files) {
          const blob = new Blob([file.data], { 
            type: file.type || "application/octet-stream" 
          });
          formData.append("files", blob, file.name);
        }
      }

      const { data } = await this.http.post<ChatResponse>(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });
      return data;
    } catch (error: any) {
      console.error('[RaaS] Chat request failed:', error);
      throw this.handleError(error);
    }
  }

  async completeCode(payload: {
    text: string;
    language?: string;
    context?: { 
      before?: string; 
      after?: string; 
      line?: number; 
      mode?: string; 
    };
    user_id?: string;
    file_path?: string;
  }): Promise<CodeCompletionResponse> {
    try {
      const url = config.toUrl(config.completionPath);
      console.log(`[RaaS] Sending completion request to: ${url}`);
      console.log(`[RaaS] Completion payload:`, {
        text_length: payload.text?.length || 0,
        language: payload.language,
        mode: payload.context?.mode,
        user_id: payload.user_id
      });
      
      // Build the request payload matching your backend schema
      const completionPayload = {
        text: payload.text || "",
        language: payload.language || "python",
        user_id: payload.user_id || "sharif_200",
        file_path: payload.file_path,
        context: payload.context || {}
      };
      
      const { data } = await this.http.post<CodeCompletionResponse>(url, completionPayload, {
        headers: {
          'Content-Type': 'application/json',
        }
      });

      console.log(`[RaaS] Completion response:`, {
        completion_length: data.completion?.length || 0,
        completion_preview: data.completion?.slice(0, 50) || "empty"
      });

      return data;
    } catch (error: any) {
      console.error('[RaaS] Completion request failed:', error);
      console.error('[RaaS] Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      throw this.handleError(error);
    }
  }

  private handleError(error: any): Error {
    if (error.response?.data?.message) {
      return new Error(error.response.data.message);
    } else if (error.message) {
      return new Error(error.message);
    } else {
      return new Error('An unknown error occurred');
    }
  }

  // Health check method
  async checkHealth(): Promise<boolean> {
    try {
      const baseUrl = config.endpoint;
      // Try common health check endpoints
      const healthEndpoints = ['/health', '/api/health', '/api/v1/health', '/'];
      
      for (const endpoint of healthEndpoints) {
        try {
          const url = `${baseUrl}${endpoint}`;
          console.log(`[RaaS] Checking health at: ${url}`);
          await this.http.get(url, { timeout: 5000 });
          console.log(`[RaaS] Health check successful at: ${url}`);
          return true;
        } catch (err) {
          console.log(`[RaaS] Health check failed at: ${baseUrl}${endpoint}`);
          continue;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  // Test the chat endpoint with minimal data
  async testChatEndpoint(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.sendChatForm("test");
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const apiClient = new ApiClient();