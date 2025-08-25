"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const undici_1 = require("undici");
const buffer_1 = require("buffer");
const config_1 = require("./config");
class ApiClient {
    constructor() {
        // Keep axios instance for timeouts/retries, but pass full URLs per call.
        this.http = axios_1.default.create({ timeout: config_1.config.timeout });
    }
    async sendChatForm(text, files) {
        const fd = new undici_1.FormData();
        fd.append("text", text);
        for (const f of files) {
            fd.append("files", new buffer_1.Blob([f.data], { type: f.type || "application/octet-stream" }), f.name);
        }
        const url = config_1.config.toUrl(config_1.config.chatPath);
        const { data } = await this.http.post(url, fd);
        return data;
    }
    async completeCode(payload) {
        const url = config_1.config.toUrl(config_1.config.completionPath);
        const { data } = await this.http.post(url, payload);
        return data;
    }
}
exports.apiClient = new ApiClient();
//# sourceMappingURL=apiClient.js.map