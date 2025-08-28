// import { apiClient, UploadFilePart } from "../apiClient";

// class ChatManager {
//   async send(text: string, files: UploadFilePart[] = []) {
//     return apiClient.sendChatForm(text, files);
//   }
// }

// export const chatManager = new ChatManager();


// src/chat/chatManager.ts
import {apiClient} from '../apiClient';

type WebviewFile = {
  filename: string;
  mimeType: string;
  size: number;
  contentBase64: string;
};

export async function sendChat(
  text: string,
  files: WebviewFile[] = [],
  sessionId: string            // <-- add this param
) {
  // Convert webview payload to UploadFilePart[]
  const parts = (files || []).map(f => ({
    name: f.filename,
    type: f.mimeType || 'application/octet-stream',
    data: Buffer.from(f.contentBase64, 'base64'),
  }));

  return apiClient.sendChatForm(text, parts, sessionId); // <-- pass it
}
