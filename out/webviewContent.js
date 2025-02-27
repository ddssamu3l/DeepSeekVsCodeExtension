"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = getWebviewContent;
function getWebviewContent() {
    return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
      <title>DeepSeek Chat</title>
      <style>
        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
        body {
          font-family: var(--vscode-font-family, sans-serif);
          color: var(--vscode-foreground, #333);
          background-color: var(--vscode-editor-background, #fff);
          font-size: var(--vscode-font-size, 13px);
          display: flex;
          flex-direction: column;
        }
        .container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100%;
          box-sizing: border-box;
          padding: 16px;
        }
        .header {
          flex: 0 0 auto;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--vscode-panel-border, #ccc);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        h2 {
          margin: 0 0 8px 0;
          color: var(--vscode-foreground, #333);
          font-weight: 500;
          font-size: 18px;
        }
        .chat-container {
          flex: 1 1 auto;
          overflow-y: auto;
          border: 1px solid var(--vscode-panel-border, #ccc);
          background-color: var(--vscode-editor-background, #fff);
          position: relative;
          margin: 16px 0;
          display: flex;
          flex-direction: column;
        }
        .chat-message {
          padding: 10px;
          margin-bottom: 8px;
          border-radius: 6px;
          max-width: 85%;
          white-space: pre-wrap;
          overflow-wrap: break-word;
          font-family: var(--vscode-editor-font-family, monospace);
          font-size: var(--vscode-editor-font-size, 14px);
          line-height: 1.5;
        }
        .user-message {
          align-self: flex-end;
          background-color: var(--vscode-button-background, #0e639c);
          color: white;
          margin-right: 10px;
          margin-top: 10px;
        }
        .assistant-message {
          align-self: flex-start;
          color: var(--vscode-foreground, #333);
          margin-left: 5px;
          margin-top: 10px;
        }
        .welcome-message {
          text-align: center;
          padding: 20px;
          color: var(--vscode-descriptionForeground, #888);
          font-style: italic;
        }
        .thinking {
          align-self: flex-start;
          color: var(--vscode-descriptionForeground, #888);
          font-style: italic;
          padding: 10px;
          display: flex;
          align-items: center;
        }
        .thinking-dots {
          display: inline-block;
          width: 50px;
        }
        .input-area {
          flex: 0 0 auto;
          margin-top: auto;
          border-top: 1px solid var(--vscode-panel-border, #ccc);
          padding-top: 16px;
        }
        #userPrompt {
          width: 100%;
          box-sizing: border-box;
          background-color: var(--vscode-input-background, #fff);
          color: var(--vscode-input-foreground, #333);
          border: 1px solid var(--vscode-input-border, #ccc);
          padding: 8px;
          font-family: var(--vscode-font-family, sans-serif);
          font-size: var(--vscode-font-size, 13px);
          resize: none;
          height: 60px;
          min-height: 60px;
        }
        .button-row {
          display: flex;
          margin: 8px 0;
        }
        button {
          background-color: var(--vscode-button-background, #0e639c);
          color: var(--vscode-button-foreground, #fff);
          padding: 6px 12px;
          border: none;
          cursor: pointer;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground, #1177bb);
        }
        #testButton {
          margin-left: 8px;
          background-color: var(--vscode-button-secondaryBackground, #5a5a5a);
        }
        #clearButton {
          margin-left: auto;
          background-color: var(--vscode-button-secondaryBackground, #5a5a5a);
        }
        .status {
          font-style: italic;
          margin: 5px 0;
          color: var(--vscode-descriptionForeground, #888);
          min-height: 20px;
        }
        #loading {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0,0,0,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          display: none;
        }
        .spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          border-radius: 50%;
          border-top: 4px solid var(--vscode-button-background, #0e639c);
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
        }
        .dot {
          display: inline-block;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          margin-right: 3px;
          background: var(--vscode-descriptionForeground, #888);
          animation: dot-flashing 1s infinite linear alternate;
        }
        .dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        .dot:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes dot-flashing {
          0% { opacity: 0.2; }
          100% { opacity: 1; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>DeepSeek R1 Chat</h2>
          <button id="clearButton">Clear Chat</button>
        </div>
        
        <div class="chat-container" id="chatContainer">
          <div class="welcome-message">Welcome to DeepSeek R1! Enter a prompt to start chatting.</div>
          <div id="loading"><div class="spinner"></div></div>
        </div>
        
        <div class="input-area">
          <div class="status" id="status"></div>
          <textarea id="userPrompt" placeholder="Ask DeepSeek anything..."></textarea>
          <div class="button-row">
            <button id="askButton">Ask DeepSeek</button>
            <button id="testButton">Test Connection</button>
          </div>
        </div>
      </div>

      <script>
        // Show loading indicator
        function showLoading(show) {
          document.getElementById('loading').style.display = show ? 'flex' : 'none';
        }
        
        // Make the container take the full height of its parent
        function adjustHeight() {
          // Get viewport height
          const vh = window.innerHeight;
          document.querySelector('.container').style.height = vh + 'px';
        }
        
        // Add a new message to the chat container
        function addMessage(role, content, isThinking = false) {
          const chatContainer = document.getElementById('chatContainer');
          
          // Clear welcome message if it exists
          const welcomeMessage = document.querySelector('.welcome-message');
          if (welcomeMessage) {
            welcomeMessage.remove();
          }
          
          // Create message element
          const messageDiv = document.createElement('div');
          
          if (isThinking) {
            messageDiv.className = 'thinking';
            messageDiv.innerHTML = \`Thinking<span class="thinking-dots">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </span>\`;
            messageDiv.id = 'thinking-indicator';
          } else {
            messageDiv.className = role === 'user' ? 'chat-message user-message' : 'chat-message assistant-message';
            
            // For assistant messages, add an ID so we can find it later for updates
            if (role === 'assistant') {
              messageDiv.id = 'assistant-msg-' + Date.now();
            }
            
            messageDiv.textContent = content;
            
            // Remove thinking indicator if it exists
            const thinkingIndicator = document.getElementById('thinking-indicator');
            if (thinkingIndicator) {
              thinkingIndicator.remove();
            }
          }
          
          chatContainer.appendChild(messageDiv);
          
          // Scroll to bottom
          chatContainer.scrollTop = chatContainer.scrollHeight;
          
          return messageDiv;
        }
        
        // Clear all messages from the chat
        function clearChat() {
          const chatContainer = document.getElementById('chatContainer');
          chatContainer.innerHTML = '<div class="welcome-message">Welcome to DeepSeek R1! Enter a prompt to start chatting.</div>';
        }
        
        // Update the current streaming assistant message (identified by thinking indicator)
        function updateCurrentStreamingMessage(content) {
          // First, look for a thinking indicator
          const thinkingIndicator = document.getElementById('thinking-indicator');
          
          if (thinkingIndicator) {
            // Create a new assistant message to replace the thinking indicator
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message assistant-message';
            messageDiv.id = 'current-streaming-msg';
            messageDiv.textContent = content;
            
            // Replace the thinking indicator with the message
            const chatContainer = document.getElementById('chatContainer');
            chatContainer.replaceChild(messageDiv, thinkingIndicator);
          } else {
            // Look for the current streaming message
            const streamingMsg = document.getElementById('current-streaming-msg');
            if (streamingMsg) {
              streamingMsg.textContent = content;
            } else {
              // If somehow neither exists, just add a new message
              const messageDiv = addMessage('assistant', content);
              messageDiv.id = 'current-streaming-msg';
            }
          }
          
          // Scroll to bottom
          const chatContainer = document.getElementById('chatContainer');
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
        
        // Render a full conversation from history
        function renderConversation(messages) {
          clearChat();
          if (messages && messages.length > 0) {
            messages.forEach(msg => {
              addMessage(msg.role, msg.content);
            });
          }
        }
        
        // Call once on load and whenever window resizes
        window.addEventListener('resize', adjustHeight);
        
        try {
          // Set initial heights
          adjustHeight();
          
          // Acquire VSCode API
          const vscode = acquireVsCodeApi();
          
          // Handle Ask button click
          document.getElementById("askButton").addEventListener("click", () => {
            const userPrompt = document.getElementById("userPrompt").value.trim();
            if (!userPrompt) {
              document.getElementById("status").textContent = "Please enter a prompt first";
              return;
            }
            
            // Add user message to the chat
            addMessage('user', userPrompt);
            
            // Add thinking indicator
            addMessage('assistant', '', true);
            
            document.getElementById("status").textContent = "Sending request to DeepSeek...";
            document.getElementById("askButton").textContent = "Generating...";
            document.getElementById("userPrompt").value = "";
            
            try {
              vscode.postMessage({ command: 'userPrompt', text: userPrompt });
            } catch (err) {
              document.getElementById("status").textContent = "Error sending request: " + err.message;
            }
          });
          
          // Handle Clear button click
          document.getElementById("clearButton").addEventListener("click", () => {
            clearChat();
            vscode.postMessage({ command: 'clearConversation' });
            document.getElementById("status").textContent = "Conversation cleared";
            setTimeout(() => {
              document.getElementById("status").textContent = "Ready for prompting";
            }, 2000);
          });
          
          // Also handle Enter key to submit (Shift+Enter for new line)
          document.getElementById("userPrompt").addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              document.getElementById("askButton").click();
            }
          });

          // Handle Test button click
          document.getElementById("testButton").addEventListener("click", () => {
            document.getElementById("status").textContent = "Testing connection...";
            addMessage('user', 'Test message: Hello from the webview!');
            addMessage('assistant', '', true);
            
            try {
              vscode.postMessage({ 
                command: 'userPrompt', 
                text: 'Test message: Hello from the webview!'
              });
            } catch (err) {
              document.getElementById("status").textContent = "Test failed: " + err.message;
            }
          });

          // Listen for messages from the extension
          window.addEventListener("message", event => {
            const { command, text, messages } = event.data;
            
            if (command === "chatResponse") {
              // Update the assistant's response as it's streaming in
              updateCurrentStreamingMessage(text);
            }
            else if (command === "chatCompletion") {
              document.getElementById("askButton").textContent = "Ask DeepSeek";
              document.getElementById("status").textContent = "Response completed!";

              // If messages are provided, render them
              if (messages) {
                renderConversation(messages);
              }

              // Reset the status after 3 seconds
              setTimeout(() => {
                document.getElementById("status").textContent = "Ready for prompting";
              }, 3000);
            }
            else if (command === "loadConversation") {
              // Load an existing conversation
              if (messages && messages.length > 0) {
                renderConversation(messages);
              }
            }
            else if (command === "clearConversation") {
              clearChat();
            }
          });

          // Ready state
          document.getElementById("status").textContent = "Ready for prompting";
          
        } catch (err) {
          console.error('Fatal error:', err);
          document.body.innerHTML = \`
            <div style="color:red;padding:20px;">
              <h3>Error Initializing DeepSeek Chat</h3>
              <p>\${err.message}</p>
              <pre>\${err.stack}</pre>
            </div>
          \`;
        }
      </script>
    </body>
    </html>
  `;
}
//# sourceMappingURL=webviewContent.js.map