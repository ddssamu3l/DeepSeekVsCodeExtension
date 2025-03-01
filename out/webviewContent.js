"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = getWebviewContent;
const markdownConverter_1 = require("./helpers/markdownConverter");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function getWebviewContent() {
    // import the markdownToHTML helper and convert it into a string. We will inject it to a <script> tag later.
    const markdownToHTMLFunctionString = markdownConverter_1.markdownToHTML.toString();
    // Read the CSS file
    const cssPath = path.join(__dirname, '..', 'src', 'styles', 'chatStyles.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
      <title>DeepSeek Chat</title>
      <style>
        ${cssContent}
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
        // Inject markdown string to HTML helper function
        const markdownToHTML = ${markdownToHTMLFunctionString};

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
        function addMessage(role, content) {
          const chatContainer = document.getElementById('chatContainer');
          
          // Clear welcome message if it exists
          const welcomeMessage = document.querySelector('.welcome-message');
          if (welcomeMessage) {
            welcomeMessage.remove();
          }
          
          // Create message element
          const messageDiv = document.createElement('div');
          messageDiv.className = role === 'user' ? 'chat-message user-message' : 'chat-message assistant-message';
          
          // For assistant messages, add an ID so we can find it later for updates
          if (role === 'assistant') {
            messageDiv.id = 'assistant-msg-' + Date.now();
            messageDiv.innerHTML = markdownToHTML(content);
          }else{
            messageDiv.textContent = content;
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
          // Look for the current streaming message
          const streamingMsg = document.getElementById('current-streaming-msg');
          if (streamingMsg) {
            streamingMsg.innerHTML = markdownToHTML(content);
          } else {
            // If somehow neither exists, just add a new message
            const messageDiv = addMessage('assistant', content);
            messageDiv.id = 'current-streaming-msg';
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
              if(msg.role !== "system"){
                addMessage(msg.role, msg.content);
              }
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
            addMessage('assistant', '');
            
            document.getElementById("status").textContent = "Sending request to DeepSeek...";
            document.getElementById("askButton").textContent = "Generating...";
            document.getElementById("askButton").disabled = true;
            document.getElementById("clearButton").disabled = true;
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
            }, 3000);
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
            addMessage('assistant', '');
            
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
              if(text){
                updateCurrentStreamingMessage(text);
              }else{
                updateCurrentStreamingMessage("Processing your request with DeepSeek R1...");
              }
              document.getElementById("status").textContent = "Receiving response...";
            }
            else if (command === "chatCompletion") {
              document.getElementById("askButton").textContent = "Ask DeepSeek";
              document.getElementById("status").textContent = "Response completed!";
              document.getElementById("askButton").disabled = false;
              document.getElementById("clearButton").disabled = false;

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