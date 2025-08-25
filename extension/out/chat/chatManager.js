"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatManager = void 0;
const apiClient_1 = require("../apiClient");
class ChatManager {
    async send(text, files = []) {
        return apiClient_1.apiClient.sendChatForm(text, files);
    }
}
exports.chatManager = new ChatManager();
//# sourceMappingURL=chatManager.js.map