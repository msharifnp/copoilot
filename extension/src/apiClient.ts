// src/apiClient.ts
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
    this.http = axios.create({ baseURL: config.endpoint, timeout: config.timeout });
  }

  // 👇 add the explicit return type
  async sendChatForm(text: string, files: UploadFilePart[]): Promise<ChatResponse> {
    const fd = new FormData();
    fd.append("text", text);
    for (const f of files) {
      fd.append("files", new Blob([f.data], { type: f.type || "application/octet-stream" }), f.name);
    }
    const { data } = await this.http.post<ChatResponse>("/chat/form", fd);
    return data; // 👈 return the data
  }

  async completeCode(payload: {
    text: string;
    language?: string;
    context?: { before?: string; after?: string; line?: number; mode?: string };
  }): Promise<CodeCompletionResponse> {
    const { data } = await this.http.post<CodeCompletionResponse>("/code-completion", payload);
    return data;
  }
}

export const apiClient = new ApiClient();
