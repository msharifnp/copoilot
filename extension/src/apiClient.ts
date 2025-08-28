// import axios, { AxiosInstance, AxiosError } from "axios";
// import { config } from "./config";

// export type UploadFilePart = { 
//   name: string; 
//   type: string; 
//   data: Buffer; 
// };

// export interface ChatResponse { 
//   response: string; 
  
// }

// export interface CodeCompletionResponse { 
//   completion: string; 
// }

// class ApiClient {
//   private http: AxiosInstance = axios.create({
//     baseURL:config.endpoint,
//     timeout: config.timeout
//   });

//   constructor() {
//     this.http = axios.create({ 
//       timeout: config.timeout,
//       headers: {
//         'User-Agent': 'VSCode-RaaS-Extension/1.0.0'
//       }
//     });

//     // Add request interceptor for debugging
//     this.http.interceptors.request.use(
//       (config) => {
//         console.log(`[RaaS] Request: ${config.method?.toUpperCase()} ${config.url}`);
//         console.log(`[RaaS] Headers:`, config.headers);
//         if (config.data && !(config.data instanceof FormData)) {
//           console.log(`[RaaS] Data:`, config.data);
//         }
//         return config;
//       },
//       (error) => {
//         console.error('[RaaS] Request error:', error);
//         return Promise.reject(error);
//       }
//     );

//     // Add response interceptor for better error handling
//     this.http.interceptors.response.use(
//       (response) => {
//         console.log(`[RaaS] Response: ${response.status} ${response.statusText}`);
//         return response;
//       },
//       (error: AxiosError) => {
//         console.error('[RaaS] Response error:', error.response?.status, error.response?.statusText);
//         console.error('[RaaS] Error data:', error.response?.data);
        
//         if (error.code === 'ECONNREFUSED') {
//           throw new Error('Unable to connect to RaaS server. Please check if the server is running and the URL is correct.');
//         } else if (error.code === 'ETIMEDOUT') {
//           throw new Error('Request timed out. The server may be overloaded.');
//         } else if (error.response?.status === 404) {
//           throw new Error('API endpoint not found. Please check your configuration.');
//         } else if (error.response?.status === 422) {
//           const errorData = error.response.data as any;
//           if (errorData?.detail) {
//             // Handle FastAPI validation errors
//             if (Array.isArray(errorData.detail)) {
//               const validationErrors = errorData.detail.map((err: any) => 
//                 `${err.loc?.join('.') || 'field'}: ${err.msg}`
//               ).join(', ');
//               throw new Error(`Validation error: ${validationErrors}`);
//             } else {
//               throw new Error(`Validation error: ${errorData.detail}`);
//             }
//           } else {
//             throw new Error('Request validation failed. Please check the data format.');
//           }
//         } else if (error.response?.status === 500) {
//           throw new Error('Server error occurred. Please try again later.');
//         }
        
//         throw error;
//       }
//     );
//   }

//   async sendChatForm(text: string, files: UploadFilePart[] = []): Promise<ChatResponse> {
//     try {
//       const url = config.toUrl(config.chatPath);
//       console.log(`[RaaS] Sending chat request to: ${url}`);
      
//       // Try different approaches based on whether files are included
//       if (files.length === 0) {
//         // Try JSON first for text-only requests
//         try {
//           console.log('[RaaS] Sending as JSON (no files)');
//           const { data } = await this.http.post<ChatResponse>(url, 
//             { text: text, user_id: "sharif_102" },
//             {
//               headers: {
//                 'Content-Type': 'application/json',
//               }
//             }
//           );
//           return data;
//         } catch (jsonError: any) {
//           console.log('[RaaS] JSON failed, trying form data');
//           // Fallback to form data
//           const formData = new FormData();
//           formData.append("text", text || "");
//           formData.append("user_id", "sharif_102");
          
//           const { data } = await this.http.post<ChatResponse>(url, formData, {
//             headers: {
//               'Content-Type': 'multipart/form-data',
//             }
//           });
//           return data;
//         }
//       } else {
//         // Use form data for file uploads
//         console.log('[RaaS] Sending as multipart/form-data (with files)');
//         const formData = new FormData();
//         formData.append("text", text || "");
//         formData.append("user_id", "sharif_102");

//         // Add files to form data
//         for (const file of files) {
//           const blob = new Blob([file.data], { 
//             type: file.type || "application/octet-stream" 
//           });
//           formData.append("files", blob, file.name);
//         }

//         const { data } = await this.http.post<ChatResponse>(url, formData, {
//           headers: {
//             'Content-Type': 'multipart/form-data',
//           }
//         });
//         return data;
//       }
//     } catch (error: any) {
//       console.error('[RaaS] Chat request failed:', error);
//       throw this.handleError(error);
//     }
//   }

//   async completeCode(payload: {
//     text: string;
//     language?: string;
//     context?: { 
//       before?: string; 
//       after?: string; 
//       line?: number; 
//       mode?: string; 
//     };
//   }): Promise<CodeCompletionResponse> {
//     try {
//       const url = config.toUrl(config.completionPath);
//       console.log(`[RaaS] Sending completion request to: ${url}`);
      
//       // Clean up the payload - remove undefined values
//       const cleanPayload = {
//         text: payload.text,
//         ...(payload.language && { language: payload.language }),
//         ...(payload.context && { context: payload.context })
//       };
      
//       const { data } = await this.http.post<CodeCompletionResponse>(url, cleanPayload, {
//         headers: {
//           'Content-Type': 'application/json',
//         }
//       });

//       return data;
//     } catch (error: any) {
//       console.error('[RaaS] Completion request failed:', error);
//       throw this.handleError(error);
//     }
//   }

//   private handleError(error: any): Error {
//     if (error.response?.data?.message) {
//       return new Error(error.response.data.message);
//     } else if (error.message) {
//       return new Error(error.message);
//     } else {
//       return new Error('An unknown error occurred');
//     }
//   }

//   // Health check method
//   async checkHealth(): Promise<boolean> {
//     try {
//       const baseUrl = config.endpoint;
//       // Try common health check endpoints
//       const healthEndpoints = ['/health', '/api/health', '/api/v1/health', '/'];
      
//       for (const endpoint of healthEndpoints) {
//         try {
//           const url = `${baseUrl}${endpoint}`;
//           console.log(`[RaaS] Checking health at: ${url}`);
//           await this.http.get(url, { timeout: 5000 });
//           console.log(`[RaaS] Health check successful at: ${url}`);
//           return true;
//         } catch (err) {
//           console.log(`[RaaS] Health check failed at: ${baseUrl}${endpoint}`);
//           continue;
//         }
//       }
//       return false;
//     } catch {
//       return false;
//     }
//   }

//   // Test the chat endpoint with minimal data
//   async testChatEndpoint(): Promise<{ success: boolean; error?: string }> {
//     try {
//       await this.sendChatForm("test");
//       return { success: true };
//     } catch (error: any) {
//       return { success: false, error: error.message };
//     }
//   }
// }

// export const apiClient = new ApiClient();


import axios, { AxiosInstance, AxiosError } from "axios";
import { Buffer } from "buffer";
import FormData from "form-data";
import { config } from "./config";

export type UploadFilePart = {
  name: string;
  type?: string;
  data: Buffer;
};

export interface ChatResponse {
  response: string;
}

export interface CodeCompletionResponse {
  completion: string;
}

export interface InlineFileItem {
  name: string;
  text: string;
}

function isNodeFormData(x: any): boolean {
  // `form-data` instances expose .getHeaders() and .getBoundary()
  return !!x && typeof x.getHeaders === "function";
}

class ApiClient {
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      timeout: config.timeout,
      headers: {
        "User-Agent": "VSCode-RaaS-Extension/1.0.0",
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    // Request interceptor (debug)
    this.http.interceptors.request.use(
      (configReq) => {
        try {
          const method = (configReq.method || "GET").toUpperCase();
          const url = configReq.url || "";
          console.log(`[RaaS] Request: ${method} ${url}`);
          // Show lightweight header info; avoid printing large bodies
          const headers = { ...(configReq.headers || {}) };
          console.log("[RaaS] Headers:", headers);
          if (configReq.data && !isNodeFormData(configReq.data)) {
            console.log("[RaaS] JSON Data:", configReq.data);
          } else if (isNodeFormData(configReq.data)) {
            console.log("[RaaS] FormData payload (binary skipped)");
          }
        } catch {
          /* ignore logging errors */
        }
        return configReq;
      },
      (error) => {
        console.error("[RaaS] Request error:", error);
        return Promise.reject(error);
      }
    );

    // Response interceptor (errors)
    this.http.interceptors.response.use(
      (response) => {
        console.log(`[RaaS] Response: ${response.status} ${response.statusText}`);
        return response;
      },
      (error: AxiosError) => {
        console.error(
          "[RaaS] Response error:",
          error.response?.status,
          error.response?.statusText
        );
        console.error("[RaaS] Error data:", error.response?.data);

        if (error.code === "ECONNREFUSED") {
          throw new Error(
            "Unable to connect to RaaS server. Please check if the server is running and the URL is correct."
          );
        } else if (error.code === "ETIMEDOUT") {
          throw new Error("Request timed out. The server may be overloaded.");
        } else if (error.response?.status === 404) {
          throw new Error("API endpoint not found. Please check your configuration.");
        } else if (error.response?.status === 422) {
          const errorData = error.response.data as any;
          if (errorData?.detail) {
            if (Array.isArray(errorData.detail)) {
              const validationErrors = errorData.detail
                .map((err: any) => `${err.loc?.join(".") || "field"}: ${err.msg}`)
                .join(", ");
              throw new Error(`Validation error: ${validationErrors}`);
            } else {
              throw new Error(`Validation error: ${errorData.detail}`);
            }
          } else {
            throw new Error("Request validation failed. Please check the data format.");
          }
        } else if (error.response?.status === 500) {
          throw new Error("Server error occurred. Please try again later.");
        }

        throw error;
      }
    );
  }

  /**
   * Send chat (text + optional files) with a stable sessionId.
   * - Always include session_id (JSON and multipart).
   * - Optionally include inlineFiles as JSON string (inline_files).
   */
  async sendChatForm(
    text: string,
    files: UploadFilePart[] = [],
    sessionId: string,
    inlineFiles?: InlineFileItem[]
  ): Promise<ChatResponse> {
    const url = config.toUrl(config.chatPath);
    console.log(`[RaaS] Sending chat request to: ${url}`);

    // TEXT-ONLY: try JSON first for small/light requests
    if (files.length === 0) {
      try {
        console.log("[RaaS] Sending as JSON (no files)");
        const { data } = await this.http.post<ChatResponse>(
          url,
          { text, user_id: "sharif_110", session_id: sessionId },
          { headers: { "Content-Type": "application/json" } }
        );
        return data;
      } catch (jsonError) {
        console.log("[RaaS] JSON failed, retrying as multipart/form-data");
        // fall through to multipart fallback
      }
    }

    // MULTIPART (files present or JSON fallback failed)
    const form = new FormData();
    form.append("text", text || "");
    form.append("user_id", "sharif_110");
    form.append("session_id", sessionId);

    if (inlineFiles?.length) {
      form.append("inline_files", JSON.stringify(inlineFiles));
    }

    for (const f of files) {
      // Use Buffer directly; do NOT construct Blob in Node.
      form.append("files", f.data, {
        filename: f.name,
        contentType: f.type || "application/octet-stream",
        knownLength: f.data.length,
      });
    }

    const headers = form.getHeaders();
    const { data } = await this.http.post<ChatResponse>(url, form, {
      headers,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    return data;
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
  }): Promise<CodeCompletionResponse> {
    try {
      const url = config.toUrl(config.completionPath);
      console.log(`[RaaS] Sending completion request to: ${url}`);

      const cleanPayload = {
        text: payload.text,
        ...(payload.language && { language: payload.language }),
        ...(payload.context && { context: payload.context }),
      };

      const { data } = await this.http.post<CodeCompletionResponse>(url, cleanPayload, {
        headers: { "Content-Type": "application/json" },
      });

      return data;
    } catch (error: any) {
      console.error("[RaaS] Completion request failed:", error);
      throw this.handleError(error);
    }
  }

  private handleError(error: any): Error {
    if (error?.response?.data?.message) {
      return new Error(error.response.data.message);
    } else if (error?.message) {
      return new Error(error.message);
    } else {
      return new Error("An unknown error occurred");
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const baseUrl = config.endpoint;
      const healthEndpoints = ["/health", "/api/health", "/api/v1/health", "/"];
      for (const endpoint of healthEndpoints) {
        try {
          const url = `${baseUrl}${endpoint}`;
          console.log(`[RaaS] Checking health at: ${url}`);
          await this.http.get(url, { timeout: 5000 });
          console.log(`[RaaS] Health check successful at: ${url}`);
          return true;
        } catch {
          console.log(`[RaaS] Health check failed at: ${baseUrl}${endpoint}`);
          continue;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  async testChatEndpoint(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.sendChatForm("test", [], "test-session");
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const apiClient = new ApiClient();
