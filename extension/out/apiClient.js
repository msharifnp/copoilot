"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("./config");
class ApiClient {
    constructor() {
        this.http = axios_1.default.create({
            timeout: config_1.config.timeout,
            headers: {
                'User-Agent': 'VSCode-RaaS-Extension/1.0.0'
            }
        });
        // Add request interceptor for debugging
        this.http.interceptors.request.use((config) => {
            console.log(`[RaaS] Request: ${config.method?.toUpperCase()} ${config.url}`);
            console.log(`[RaaS] Headers:`, config.headers);
            if (config.data && !(config.data instanceof FormData)) {
                console.log(`[RaaS] Data:`, config.data);
            }
            return config;
        }, (error) => {
            console.error('[RaaS] Request error:', error);
            return Promise.reject(error);
        });
        // Add response interceptor for better error handling
        this.http.interceptors.response.use((response) => {
            console.log(`[RaaS] Response: ${response.status} ${response.statusText}`);
            return response;
        }, (error) => {
            console.error('[RaaS] Response error:', error.response?.status, error.response?.statusText);
            console.error('[RaaS] Error data:', error.response?.data);
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Unable to connect to RaaS server. Please check if the server is running and the URL is correct.');
            }
            else if (error.code === 'ETIMEDOUT') {
                throw new Error('Request timed out. The server may be overloaded.');
            }
            else if (error.response?.status === 404) {
                throw new Error('API endpoint not found. Please check your configuration.');
            }
            else if (error.response?.status === 422) {
                const errorData = error.response.data;
                if (errorData?.detail) {
                    // Handle FastAPI validation errors
                    if (Array.isArray(errorData.detail)) {
                        const validationErrors = errorData.detail.map((err) => `${err.loc?.join('.') || 'field'}: ${err.msg}`).join(', ');
                        throw new Error(`Validation error: ${validationErrors}`);
                    }
                    else {
                        throw new Error(`Validation error: ${errorData.detail}`);
                    }
                }
                else {
                    throw new Error('Request validation failed. Please check the data format.');
                }
            }
            else if (error.response?.status === 500) {
                throw new Error('Server error occurred. Please try again later.');
            }
            throw error;
        });
    }
    async sendChatForm(text, files = []) {
        try {
            const url = config_1.config.toUrl(config_1.config.chatPath);
            console.log(`[RaaS] Sending chat request to: ${url}`);
            // Try different approaches based on whether files are included
            if (files.length === 0) {
                // Try JSON first for text-only requests
                try {
                    console.log('[RaaS] Sending as JSON (no files)');
                    const { data } = await this.http.post(url, { text: text, user_id: "sharif_002" }, {
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    });
                    return data;
                }
                catch (jsonError) {
                    console.log('[RaaS] JSON failed, trying form data');
                    // Fallback to form data
                    const formData = new FormData();
                    formData.append("text", text);
                    formData.append("user_id", "sharif002");
                    const { data } = await this.http.post(url, formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                        }
                    });
                    return data;
                }
            }
            else {
                // Use form data for file uploads
                console.log('[RaaS] Sending as multipart/form-data (with files)');
                const formData = new FormData();
                formData.append("text", text);
                formData.append("user_id", "sharif002");
                // Add files to form data
                for (const file of files) {
                    const blob = new Blob([file.data], {
                        type: file.type || "application/octet-stream"
                    });
                    formData.append("files", blob, file.name);
                }
                const { data } = await this.http.post(url, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    }
                });
                return data;
            }
        }
        catch (error) {
            console.error('[RaaS] Chat request failed:', error);
            throw this.handleError(error);
        }
    }
    async completeCode(payload) {
        try {
            const url = config_1.config.toUrl(config_1.config.completionPath);
            console.log(`[RaaS] Sending completion request to: ${url}`);
            // Clean up the payload - remove undefined values
            const cleanPayload = {
                text: payload.text,
                ...(payload.language && { language: payload.language }),
                ...(payload.context && { context: payload.context })
            };
            const { data } = await this.http.post(url, cleanPayload, {
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            return data;
        }
        catch (error) {
            console.error('[RaaS] Completion request failed:', error);
            throw this.handleError(error);
        }
    }
    handleError(error) {
        if (error.response?.data?.message) {
            return new Error(error.response.data.message);
        }
        else if (error.message) {
            return new Error(error.message);
        }
        else {
            return new Error('An unknown error occurred');
        }
    }
    // Health check method
    async checkHealth() {
        try {
            const baseUrl = config_1.config.endpoint;
            // Try common health check endpoints
            const healthEndpoints = ['/health', '/api/health', '/api/v1/health', '/'];
            for (const endpoint of healthEndpoints) {
                try {
                    const url = `${baseUrl}${endpoint}`;
                    console.log(`[RaaS] Checking health at: ${url}`);
                    await this.http.get(url, { timeout: 5000 });
                    console.log(`[RaaS] Health check successful at: ${url}`);
                    return true;
                }
                catch (err) {
                    console.log(`[RaaS] Health check failed at: ${baseUrl}${endpoint}`);
                    continue;
                }
            }
            return false;
        }
        catch {
            return false;
        }
    }
    // Test the chat endpoint with minimal data
    async testChatEndpoint() {
        try {
            await this.sendChatForm("test");
            return { success: true };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
}
exports.apiClient = new ApiClient();
//# sourceMappingURL=apiClient.js.map