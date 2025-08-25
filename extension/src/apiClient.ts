import axios, { AxiosInstance } from "axios";
import { FormData } from "undici";
import { Blob } from "buffer";
import { config } from "./config";

export type UploadFilePart = { name: string; type?: string; data: Buffer };

export interface ChatResponse { response: string; }
export interface CodeCompletionResponse { completion: string; }

class ApiClient {
  private http: AxiosInstance;

  constructor() {
    // Keep axios instance for timeouts/retries, but pass full URLs per call.
    this.http = axios.create({ timeout: config.timeout });
  }

  async sendChatForm(text: string, files: UploadFilePart[]): Promise<ChatResponse> {
    const fd = new FormData();
    fd.append("text", text);
    for (const f of files) {
      fd.append("files", new Blob([f.data], { type: f.type || "application/octet-stream" }), f.name);
    }
    const url = config.toUrl(config.chatPath);
    const { data } = await this.http.post<ChatResponse>(url, fd);
    return data;
  }

  async completeCode(payload: {
    text: string;
    language?: string;
    context?: { before?: string; after?: string; line?: number; mode?: string };
  }): Promise<CodeCompletionResponse> {
    const url = config.toUrl(config.completionPath);
    const { data } = await this.http.post<CodeCompletionResponse>(url, payload);
    return data;
  }
}

export const apiClient = new ApiClient();
