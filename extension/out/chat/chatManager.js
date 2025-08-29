"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendChat = sendChat;
const apiClient_1 = require("../apiClient");
async function sendChat(text, files = [], sessionId // <-- add this param
) {
    // Convert webview payload to UploadFilePart[]
    const parts = (files || []).map(f => ({
        name: f.filename,
        type: f.mimeType || 'application/octet-stream',
        data: Buffer.from(f.contentBase64, 'base64'),
    }));
    return apiClient_1.apiClient.sendChatForm(text, parts, sessionId); // <-- pass it
}
//# sourceMappingURL=chatManager.js.map