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
