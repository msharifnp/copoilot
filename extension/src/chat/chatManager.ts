import { apiClient, UploadFilePart } from "../apiClient";

class ChatManager {
  async send(text: string, files: UploadFilePart[] = []) {
    return apiClient.sendChatForm(text, files);
  }
}

export const chatManager = new ChatManager();
