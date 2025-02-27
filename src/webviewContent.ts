export default function getWebviewContent(): string {
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
        }
        h2 {
          margin: 0 0 8px 0;
          color: var(--vscode-foreground, #333);
          font-weight: 500;
          font-size: 18px;
        }
        .response-container {
          flex: 1 1 auto;
          overflow-y: auto;
          border: 1px solid var(--vscode-panel-border, #ccc);
          padding: 10px;
          background-color: var(--vscode-editor-background, #fff);
          position: relative;
          margin: 16px 0;
        }
        #response {
          white-space: pre-wrap;
          overflow-wrap: break-word;
          font-family: var(--vscode-editor-font-family, monospace);
          font-size: var(--vscode-editor-font-size, 14px);
          line-height: 1.5;
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
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>DeepSeek R1 Chat</h2>
        </div>
        
        <div class="response-container">
          <div id="response">Welcome to DeepSeek R1! Enter a prompt and click 'Ask DeepSeek' to start chatting.</div>
          <div id="loading"><div class="spinner"></div></div>
        </div>
        
        <div class="input-area">
          <textarea id="userPrompt" placeholder="Ask DeepSeek anything..."></textarea>
          <div class="button-row">
            <button id="askButton">Ask DeepSeek</button>
            <button id="testButton">Test Connection</button>
          </div>
          <div class="status" id="status"></div>
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
        
        // Call once on load and whenever window resizes
        window.addEventListener('resize', adjustHeight);
        
        try {
          // Set initial heights
          adjustHeight();
          
          // Acquire VSCode API
          let vscode = acquireVsCodeApi();
          
          // Handle Ask button click
          document.getElementById("askButton").addEventListener("click", () => {
            const userPrompt = document.getElementById("userPrompt").value.trim();
            if (!userPrompt) {
              document.getElementById("status").textContent = "Please enter a prompt first";
              return;
            }
            
            document.getElementById("status").textContent = "Sending request to DeepSeek...";
            showLoading(true);
            
            try {
              vscode.postMessage({ command: 'userPrompt', text: userPrompt });
            } catch (err) {
              document.getElementById("status").textContent = "Error sending request: " + err.message;
              showLoading(false);
            }
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
            document.getElementById("response").textContent = "Testing webview to extension communication...";
            
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
            const { command, text } = event.data;
            if (command === "chatResponse") {
              document.getElementById("status").textContent = "Received response";
              document.getElementById("response").textContent = text;
              showLoading(false);
              
              // Clear the input after successful response
              document.getElementById("userPrompt").value = "";
            }
          });

          // Ready state
          document.getElementById("status").textContent = "Ready";
          
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
