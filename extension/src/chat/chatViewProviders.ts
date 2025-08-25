import * as vscode from "vscode";
import * as path from "path";
import { apiClient, UploadFilePart } from "../apiClient";

export class RaasChatViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly extUri: vscode.Uri) {}

  resolveWebviewView(view: vscode.WebviewView) {
    const webview = view.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extUri, "media")]
    };
    webview.html = this.getHtml(webview);

    webview.onDidReceiveMessage(async (msg) => {
      if (msg?.type === "chat") {
        try {
          // Ask the user to pick files from the extension host (safer than webview file API)
          const files: UploadFilePart[] = [];
          if (msg.pickFile === true) {
            const picks = await vscode.window.showOpenDialog({ canSelectMany: true });
            if (picks && picks.length) {
              for (const uri of picks) {
                const data = await vscode.workspace.fs.readFile(uri);
                files.push({
                  name: path.basename(uri.fsPath),
                  type: "application/octet-stream",
                  data: Buffer.from(data)
                });
              }
            }
          }

          const res = await apiClient.sendChatForm(String(msg.text ?? ""), files);
          webview.postMessage({ type: "response", text: res.response, success: true });
        } catch (err: any) {
          webview.postMessage({ type: "response", text: `Error: ${err.message}`, success: false });
        }
      }
    });
  }

  private getHtml(webview: vscode.Webview) {
    const css = webview.asWebviewUri(vscode.Uri.joinPath(this.extUri, "media", "styles.css"));
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${css}">
  <style>
    body {
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      margin: 0;
      padding: 8px;
    }

    #chat {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid var(--vscode-widget-border);
      border-radius: 4px;
      padding: 8px;
      margin-bottom: 8px;
      background: var(--vscode-editor-background);
    }

    .msg {
      margin: 4px 0;
      padding: 6px 8px;
      border-radius: 4px;
      word-wrap: break-word;
      white-space: pre-wrap;
    }

    .msg.user {
      background: var(--vscode-inputValidation-infoBorder);
      text-align: right;
      margin-left: 20px;
    }

    .msg.bot {
      background: var(--vscode-badge-background);
      margin-right: 20px;
    }

    .msg.err {
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
    }

    .msg.load {
      font-style: italic;
      opacity: 0.7;
    }

    #inputRow {
      display: flex;
      gap: 4px;
      align-items: flex-end;
    }

    #input {
      flex: 1;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      padding: 6px 8px;
      font-family: inherit;
      font-size: 13px;
      resize: vertical;
      min-height: 20px;
      max-height: 120px;
    }

    #input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      padding: 6px 12px;
      cursor: pointer;
      white-space: nowrap;
      font-size: 13px;
    }

    button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    #clip {
      padding: 6px 8px;
    }

    .status {
      font-size: 11px;
      opacity: 0.7;
      text-align: center;
      padding: 4px;
    }
  </style>
</head>
<body>
  <div id="chat">
    <div class="msg bot">🚀 RaaS Chat ready! Ask me anything or upload files for analysis.</div>
  </div>
  <div id="inputRow">
    <textarea id="input" rows="2" placeholder="Type your message here..."></textarea>
    <button id="clip" title="Attach files">📎</button>
    <button id="send">Send</button>
  </div>
  <div id="status" class="status"></div>

  <script>
    console.log('RaaS Chat webview loaded');
    const vscode = acquireVsCodeApi();
    let pickFile = false;
    let isLoading = false;

    const chat = document.getElementById('chat');
    const input = document.getElementById('input');
    const send = document.getElementById('send');
    const clip = document.getElementById('clip');
    const status = document.getElementById('status');

    function updateStatus(text) {
      status.textContent = text;
      if (text) {
        setTimeout(() => { status.textContent = ''; }, 3000);
      }
    }

    function addMessage(text, className) {
      const div = document.createElement('div');
      div.className = 'msg ' + className;
      div.textContent = text;
      chat.appendChild(div);
      chat.scrollTop = chat.scrollHeight;
      return div;
    }

    function setLoading(loading) {
      isLoading = loading;
      send.disabled = loading;
      clip.disabled = loading;
      input.disabled = loading;
      
      if (loading) {
        send.textContent = '...';
      } else {
        send.textContent = 'Send';
      }
    }

    function sendMessage() {
      const text = input.value.trim();
      if (!text || isLoading) return;

      // Add user message
      addMessage(text, 'user');
      input.value = '';
      
      // Show loading state
      setLoading(true);
      const loadingMsg = addMessage('Thinking...', 'bot load');
      
      if (pickFile) {
        updateStatus('Selecting files...');
      }

      // Send to extension
      vscode.postMessage({ 
        type: 'chat', 
        text: text, 
        pickFile: pickFile 
      });
      
      pickFile = false;
    }

    function handleKeyDown(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    }

    // Event listeners
    send.addEventListener('click', sendMessage);
    input.addEventListener('keydown', handleKeyDown);
    
    clip.addEventListener('click', () => {
      pickFile = true;
      updateStatus('Will prompt for files when you send message');
      input.focus();
    });

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      console.log('Received message:', message);
      
      if (message.type === 'response') {
        setLoading(false);
        
        // Remove loading message
        const loadingMsgs = chat.querySelectorAll('.msg.load');
        loadingMsgs.forEach(msg => msg.remove());
        
        // Add response
        const className = message.success ? 'bot' : 'err';
        addMessage(message.text || 'No response received', className);
        
        if (!message.success) {
          updateStatus('Error occurred - check your RaaS server connection');
        }
        
        input.focus();
      }
    });

    // Focus input on load
    input.focus();
    
    // Auto-resize textarea
    input.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
  </script>
</body>
</html>`;
  }
}