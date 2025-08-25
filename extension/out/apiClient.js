"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiClient = void 0;
// src/apiClient.ts
const axios_1 = __importDefault(require("axios"));
const undici_1 = require("undici");
const buffer_1 = require("buffer");
const config_1 = require("./config");
class ApiClient {
    constructor() {
        this.http = axios_1.default.create({ baseURL: config_1.config.endpoint, timeout: config_1.config.timeout });
    }
    // 👇 add the explicit return type
    async sendChatForm(text, files) {
        const fd = new undici_1.FormData();
        fd.append("text", text);
        for (const f of files) {
            fd.append("files", new buffer_1.Blob([f.data], { type: f.type || "application/octet-stream" }), f.name);
        }
        const { data } = await this.http.post("/chat/form", fd);
        return data; // 👈 return the data
    }
    async completeCode(payload) {
        const { data } = await this.http.post("/code-completion", payload);
        return data;
    }
}
exports.apiClient = new ApiClient();
//# sourceMappingURL=apiClient.js.map