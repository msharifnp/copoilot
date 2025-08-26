import * as vscode from "vscode";
import * as path from "path";
import { UploadFilePart, apiClient } from "../apiClient";

export class RaasChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(private readonly extUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extUri, "media"),
        vscode.Uri.joinPath(this.extUri, "out")
      ]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'chat':
          await this.handleChatMessage(data);
          break;
        case 'test':
          await this.handleTestConnection();
          break;
        case 'ready':
          console.log('[RaaS] Chat webview ready');
          // Send current configuration to webview
          this.sendConfigToWebview();
          break;
      }
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && this._view) {
        console.log('[RaaS] Chat view became visible');
      }
    });
  }

  private async sendConfigToWebview() {
    if (!this._view) return;
    
    const config = vscode.workspace.getConfiguration("raas");
    this._view.webview.postMessage({
      type: 'config',
      serverUrl: config.get<string>("serverUrl", "http://localhost:8000"),
      chatPath: config.get<string>("chatPath", "/api/v1/chat/form"),
      timeout: config.get<number>("timeout", 100000)
    });
  }

  private async handleTestConnection() {
    if (!this._view) return;

    this._view.webview.postMessage({
      type: 'status',
      text: '🔍 Testing connection to RaaS server...'
    });

    try {
      const healthCheck = await apiClient.checkHealth();
      if (healthCheck) {
        this._view.webview.postMessage({
          type: 'status',
          text: '✅ Server is reachable, testing chat endpoint...'
        });

        const chatTest = await apiClient.testChatEndpoint();
        if (chatTest.success) {
          this._view.webview.postMessage({
            type: 'status',
            text: '✅ Connection test successful! RaaS server is working properly.'
          });
        } else {
          this._view.webview.postMessage({
            type: 'status',
            text: `❌ Chat endpoint test failed: ${chatTest.error}`
          });
        }
      } else {
        this._view.webview.postMessage({
          type: 'status',
          text: '❌ Cannot reach RaaS server. Please check your configuration.'
        });
      }
    } catch (error: any) {
      this._view.webview.postMessage({
        type: 'status',
        text: `❌ Connection test failed: ${error.message}`
      });
    }
  }

  private async handleChatMessage(data: any) {
    if (!this._view) return;

    try {
      const files: UploadFilePart[] = [];
      
      // Handle file selection if requested
      if (data.pickFile) {
        const picks = await vscode.window.showOpenDialog({ 
          canSelectMany: true,
          title: "Select files to upload to RaaS Chat",
          filters: {
            'All Files': ['*'],
            'Code Files': ['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'css', 'html', 'json'],
            'Text Files': ['txt', 'md', 'log']
          }
        });
        
        if (picks && picks.length > 0) {
          for (const uri of picks) {
            try {
              const fileData = await vscode.workspace.fs.readFile(uri);
              const fileName = path.basename(uri.fsPath);
              
              // Check file size (limit to 10MB)
              if (fileData.length > 10 * 1024 * 1024) {
                this._view.webview.postMessage({
                  type: 'status',
                  text: `⚠️ File ${fileName} is too large (max 10MB). Skipping.`
                });
                continue;
              }
              
              files.push({
                name: fileName,
                type: this.getMimeType(uri.fsPath),
                data: Buffer.from(fileData)
              });
              
              this._view.webview.postMessage({
                type: 'status',
                text: `📎 Added file: ${fileName} (${this.formatFileSize(fileData.length)})`
              });
            } catch (error) {
              console.error(`[RaaS] Failed to read file ${uri.fsPath}:`, error);
              this._view.webview.postMessage({
                type: 'status',
                text: `❌ Failed to read file: ${path.basename(uri.fsPath)}`
              });
            }
          }
        }
      }

      // Validate input
      const messageText = String(data.text || "").trim();
      if (!messageText && files.length === 0) {
        this._view.webview.postMessage({
          type: 'status',
          text: '⚠️ Please enter a message or select files to upload.'
        });
        return;
      }

      // Send to API with better error context
      console.log(`[RaaS] Sending message: "${messageText}" with ${files.length} files`);
      
      const response = await apiClient.sendChatForm(messageText, files);
      
      // Send response back to webview
      this._view.webview.postMessage({ 
        type: "response", 
        text: response.response, 
        success: true 
      });

    } catch (error: any) {
      console.error('[RaaS] Chat error:', error);
      
      let errorMessage = error.message || 'Unknown error occurred';
      
      // Add helpful suggestions based on error type
      if (error.message.includes('422') || error.message.includes('Validation error')) {
        errorMessage += '\n\n💡 This usually means the server expects different data format. Check your RaaS server documentation.';
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage += '\n\n💡 Make sure your RaaS server is running and accessible.';
      } else if (error.message.includes('404')) {
        errorMessage += '\n\n💡 Check your chat endpoint URL in VS Code settings.';
      }
      
      // Send error back to webview
      this._view.webview.postMessage({ 
        type: "response", 
        text: `❌ ${errorMessage}`, 
        success: false 
      });
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.txt': 'text/plain',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.json': 'application/json',
      '.py': 'text/x-python',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.css': 'text/css',
      '.xml': 'application/xml',
      '.csv': 'text/csv',
      '.java': 'text/x-java-source',
      '.cpp': 'text/x-c++src',
      '.c': 'text/x-csrc',
      '.h': 'text/x-chdr'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RaaS Chat</title>
    <style>
        ${this.getCss()}
    </style>
</head>
<body>
    <div id="app">
        <div id="header">
            <div class="header-title">🚀 RaaS Chat</div>
            <div class="header-buttons">
                <button id="testBtn" title="Test connection">🔧</button>
                <button id="configBtn" title="Show configuration">⚙️</button>
            </div>
        </div>
        <div id="chat">
            <div class="msg bot">
                <div class="msg-content">
                    Welcome to RaaS Chat! Ask me anything about your code or upload files for analysis.
                </div>
            </div>
        </div>
        <div id="status"></div>
        <div id="inputRow">
            <textarea id="input" rows="2" placeholder="Type your question here..." aria-label="Chat input"></textarea>
            <div id="buttons">
                <button id="clip" title="Attach files" aria-label="Attach files">📎</button>
                <button id="send" title="Send message" aria-label="Send message">Send</button>
            </div>
        </div>
    </div>

    <script>
        ${this.getJavaScript()}
    </script>
</body>
</html>`;
  }

  private getCss(): string {
    return `
        * {
            box-sizing: border-box;
        }
        
        body {
            margin: 0;
            padding: 0;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            height: 100vh;
            overflow: hidden;
        }
        
        #app {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        
        #header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: var(--vscode-titleBar-activeBackground);
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 12px;
            font-weight: bold;
        }
        
        .header-buttons {
            display: flex;
            gap: 4px;
        }
        
        .header-buttons button {
            padding: 4px 6px;
            font-size: 10px;
            background: var(--vscode-button-secondaryBackground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            color: var(--vscode-button-secondaryForeground);
        }
        
        .header-buttons button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
        
        #chat {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            scroll-behavior: smooth;
        }
        
        #status {
            padding: 4px 12px;
            font-size: 11px;
            background: var(--vscode-statusBar-background);
            color: var(--vscode-statusBar-foreground);
            border-top: 1px solid var(--vscode-panel-border);
            min-height: 20px;
        }
        
        #inputRow {
            display: flex;
            gap: 8px;
            padding: 8px;
            border-top: 1px solid var(--vscode-panel-border);
            background: var(--vscode-panel-background);
        }
        
        #input {
            flex: 1;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            padding: 8px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            resize: vertical;
            min-height: 50px;
            max-height: 120px;
        }
        
        #input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        #buttons {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
        }
        
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        button:active {
            background: var(--vscode-button-activeBackground);
        }
        
        #send {
            background: var(--vscode-button-background);
            padding: 8px 16px;
        }
        
        #clip {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            padding: 8px;
        }
        
        #clip.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .msg {
            margin: 12px 0;
            padding: 10px 12px;
            border-radius: 8px;
            background: var(--vscode-panel-background);
            border-left: 3px solid transparent;
            animation: fadeIn 0.3s ease-in;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .msg.user {
            border-left-color: var(--vscode-button-background);
            background: var(--vscode-input-background);
        }
        
        .msg.bot {
            border-left-color: var(--vscode-button-secondaryBackground);
        }
        
        .msg.err {
            border-left-color: var(--vscode-errorForeground);
            background: var(--vscode-inputValidation-errorBackground);
            color: var(--vscode-errorForeground);
        }
        
        .msg.loading {
            opacity: 0.7;
            font-style: italic;
        }
        
        .msg.loading::after {
            content: '';
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid var(--vscode-button-background);
            border-top: 2px solid transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-left: 8px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .msg-content {
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        #chat::-webkit-scrollbar {
            width: 8px;
        }
        
        #chat::-webkit-scrollbar-track {
            background: var(--vscode-scrollbar-shadow);
        }
        
        #chat::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 4px;
        }
        
        #chat::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground);
        }
    `;
  }

  private getJavaScript(): string {
    return `
        (function() {
            const vscode = acquireVsCodeApi();
            let pickFile = false;
            let config = null;
            
            const chat = document.getElementById('chat');
            const input = document.getElementById('input');
            const sendButton = document.getElementById('send');
            const clipButton = document.getElementById('clip');
            const testButton = document.getElementById('testBtn');
            const configButton = document.getElementById('configBtn');
            const status = document.getElementById('status');
            
            function addMessage(text, className) {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'msg ' + className;
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'msg-content';
                contentDiv.textContent = text;
                
                msgDiv.appendChild(contentDiv);
                chat.appendChild(msgDiv);
                chat.scrollTop = chat.scrollHeight;
                
                return msgDiv;
            }
            
            function updateStatus(text) {
                status.textContent = text;
                setTimeout(() => {
                    if (status.textContent === text) {
                        status.textContent = '';
                    }
                }, 5000);
            }
            
            function sendMessage() {
                const text = input.value.trim();
                if (!text && !pickFile) return;
                
                if (text) {
                    addMessage(text, 'user');
                }
                
                if (pickFile && !text) {
                    addMessage('📎 Uploading files...', 'user');
                }
                
                input.value = '';
                const loadingMsg = addMessage('Generating response...', 'bot loading');
                
                vscode.postMessage({
                    type: 'chat',
                    text: text,
                    pickFile: pickFile
                });
                
                pickFile = false;
                updateButtons();
            }
            
            function updateButtons() {
                clipButton.className = pickFile ? 'active' : '';
                clipButton.textContent = pickFile ? '📎✓' : '📎';
            }
            
            sendButton.addEventListener('click', sendMessage);
            
            clipButton.addEventListener('click', () => {
                pickFile = !pickFile;
                updateButtons();
                if (pickFile) {
                    input.placeholder = 'Optional: Type a message to go with your files...';
                } else {
                    input.placeholder = 'Type your question here...';
                }
            });
            
            testButton.addEventListener('click', () => {
                vscode.postMessage({ type: 'test' });
            });
            
            configButton.addEventListener('click', () => {
                if (config) {
                    const configText = 'Current Configuration:\\n' +
                        'Server URL: ' + config.serverUrl + '\\n' +
                        'Chat Path: ' + config.chatPath + '\\n' +
                        'Timeout: ' + config.timeout + 'ms';
                    addMessage(configText, 'bot');
                } else {
                    addMessage('Configuration not loaded yet.', 'bot');
                }
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                } else if (e.key === 'Escape') {
                    pickFile = false;
                    updateButtons();
                    input.placeholder = 'Type your question here...';
                }
            });
            
            input.addEventListener('input', () => {
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 120) + 'px';
            });
            
            window.addEventListener('message', event => {
                const message = event.data;
                
                if (message.type === 'response') {
                    const loadingMsg = chat.querySelector('.loading');
                    if (loadingMsg) {
                        loadingMsg.remove();
                    }
                    
                    addMessage(
                        message.text, 
                        message.success ? 'bot' : 'err'
                    );
                } else if (message.type === 'status') {
                    updateStatus(message.text);
                    addMessage(message.text, 'bot');
                } else if (message.type === 'config') {
                    config = message;
                }
            });
            
            updateButtons();
            vscode.postMessage({ type: 'ready' });
            setTimeout(() => input.focus(), 100);
        })();
    `;
  }
}