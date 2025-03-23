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
          <select class="model-selector" name="model-selector" id="model-selector">
            <option value="deepseek-r1:1.5b">DeepSeek R1 1.5b (1.5GB)</option>
            <option value="deepseek-r1:7b">DeepSeek R1 7b (4.7GB)</option>
            <option value="deepseek-r1:8b">DeepSeek R1 8b (4.9GB)</option>
            <option value="deepseek-r1:14b">DeepSeek R1 14b (9GB)</option>
            <option value="deepseek-r1:32b">DeepSeek R1 32b (20GB)</option>
            <option value="deepseek-r1:70b">DeepSeek R1 70b (43GB)</option>
            <option value="deepseek-r1:671b">DeepSeek R1 671b (404GB)</option>
            <option value="qwq" selected>QwQ (20GB)</option>
          </select>
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
          </div>
        </div>
      </div>

      <script>
        /**************************** INITIAL SETUP AND CHECKS *************************************/
        const welcomeMessage = "Welcome to DeepSeek R1! Enter a prompt to start chatting.";

        // Acquire VSCode API
        const vscode =  acquireVsCodeApi();
        console.log('VSCode API acquired');

        // Inject markdown string to HTML helper function
        const markdownToHTML = ${markdownToHTMLFunctionString};

        // Ready state
        const initialStatusElem = document.getElementById("status");
        if (initialStatusElem) {
          initialStatusElem.textContent = "Ready for prompting";
        } else {
          console.log("ERROR: status element not found during initial ready state!");
        }
        
        // Trigger model check on initial load
        const modelSelector = document.getElementById("model-selector");
        if (modelSelector) {
          const modelName = modelSelector.value;
          checkSelectedModel(modelName);
        }
        /**************************** END OF INITIAL SETUP AND CHECKS *******************************/

        /**************************** JS FUNCTIONS *************************************/
        // Check if a DeepSeek model is installed in Ollama
        async function modelInstalled(modelName) {          
          try {
            // Send message to extension host to check if model is installed
            vscode.postMessage({ 
              command: 'checkModelInstalled', 
              modelName: modelName 
            });
            
            // Get the result from checking whether a model is installed. The result is returned via another command called "modelInstalledResult". modelInstalledResult can return true or false
            return new Promise((resolve) => {
              const messageHandler = (event) => {
                const { command, isInstalled } = event.data;
                if (command === 'modelInstalledResult') {
                  window.removeEventListener('message', messageHandler);
                  resolve(isInstalled);
                }
              };
              
              window.addEventListener('message', messageHandler);
              
              // Set a timeout in case we don't get a response
              setTimeout(() => {
                window.removeEventListener('message', messageHandler);
                resolve(false);
              }, 5000);
            });
          } catch (error) {
            console.error('Error checking if model is installed:', error);
            return false;
          }
        }

        async function checkSelectedModel(modelName){
          try {
            const isInstalled = await modelInstalled(modelName);
            
            const statusElem = document.getElementById("status");
            const askButtonElem = document.getElementById("askButton");
            const clearButtonElem = document.getElementById("clearButton");
            
            if (!isInstalled) {
              if (statusElem) {
                statusElem.textContent = 'Error: selected model is not installed on your machine. Please install the current model with Ollama by running: "ollama pull ' + modelName + '" or select a different model';
                statusElem.style.color = "red";
              }
              if (askButtonElem) askButtonElem.disabled = true;
              if (clearButtonElem) clearButtonElem.disabled = true;
            } else {
              if (statusElem) {
                statusElem.textContent = "Ready for prompting";
                statusElem.style.color = "";
              }
              if (askButtonElem) askButtonElem.disabled = false;
              if (clearButtonElem) clearButtonElem.disabled = false;
              vscode.postMessage({ command: 'setModel', modelName: modelName });
            }
          } catch (error) {
            console.error('Error during initial model check:', error);
          }
        }

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
          const welcomeMessageDiv = document.querySelector('.welcome-message');
          if (welcomeMessageDiv) {
            welcomeMessageDiv.remove();
          }
          
          // Create message element
          const messageDiv = document.createElement('div');
          messageDiv.className = role === 'user' ? 'chat-message user-message' : 'chat-message assistant-message';
          
          // User message can have a date id assigned immediately since they will only be added once
          // Assistant messages are constantly streamed so they will get an id when the "chatCompletion" command is activated
          if (role === 'assistant') {
            messageDiv.id = 'current-streaming-message';
            messageDiv.innerHTML = markdownToHTML(content);
          }else{
            messageDiv.textContent = content;
            messageDiv.id = "user-message-" + Date.now();
          }

          chatContainer.appendChild(messageDiv);

          // Scroll to bottom
          chatContainer.scrollTop = chatContainer.scrollHeight;
          
          return messageDiv;
        }
        
        // Clear all messages from the chat
        function clearChat() {
          const chatContainer = document.getElementById('chatContainer');
          chatContainer.innerHTML = '<div class="welcome-message">' + welcomeMessage + '</div>';
        }
        
        // Update the current streaming assistant message (identified by thinking indicator)
        // 'content' is the markdown text returned by the AI. We will convert it to HTML text and render it as HTML
        function updateCurrentStreamingMessage(content) {
          // Look for the current streaming message
          const streamingMsg = document.getElementById('current-streaming-message');
          if (streamingMsg) {
            streamingMsg.innerHTML = markdownToHTML(content);
          } else {
            // If somehow it doesn't exist, just add a new message
            console.log("updateCurrentStreamingMessage() could not find current-streaming-message div. Creating a new current-streaming-message div");
            var messageDiv = addMessage('assistant', content);
            messageDiv.id = 'current-streaming-message';
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
              if(msg.role !== "system" && msg.role !== "tool_call_request" && msg.role !== "tool_call_response"){
                addMessage(msg.role, msg.content);
              }
            });
          }
        }
        /**************************** END OF JS FUNCTIONS *************************************/
        
        /**************************** EVENT LISTENERS *************************************/
        // Call once on load and whenever window resizes
        window.addEventListener('resize', adjustHeight);
        
        try {
          // Set initial heights
          adjustHeight();

          // Handle model-selector. Check whether the selected DeepSeek model is installed. If not, give a warning.
          document.getElementById("model-selector").addEventListener("change", async (event) => {
            if(!event || !event.target) {
              return;
            }
            
            const select = event.target;
            if(!select) return;
            const modelName = select.value;
            if(!modelName) return;
            
            checkSelectedModel(modelName);
          });

          // Handle Ask button click
          document.getElementById("askButton").addEventListener("click", () => {
            const userPrompt = document.getElementById("userPrompt").value.trim();
            if (!userPrompt) {
              document.getElementById("status").textContent = "Please enter a prompt first";
              return;
            }
            
            // Add user message to the chat
            addMessage('user', userPrompt);
            // Add a new streaming div for the ai to stream its response in
            addMessage('assistant', 'Processing your request with DeepSeek R1...');
            
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
            document.getElementById("askButton").textContent = "Ask DeepSeek";
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

          // Listen for messages from the extension
          window.addEventListener("message", event => {
            const { command, text, messages, isInstalled } = event.data;
            
            if (command === "chatResponse") {
              // Update the assistant's response as it's streaming in
              if(text){
                updateCurrentStreamingMessage(text);
              }else{
                updateCurrentStreamingMessage("Processing your request with DeepSeek R1...");
              }
              const statusElem = document.getElementById("status");
              if (statusElem) {
                statusElem.textContent = "Receiving response...";
              }
            }
            else if (command === "chatCompletion") {
              // set the current streaming div as a regular completed message div
              var currentStreamingMessage = document.getElementById("current-streaming-message");
              if(currentStreamingMessage) currentStreamingMessage.id = 'assistant-message-' + Date.now();
              else console.error("Failed to find current streaming div");

              const askButtonElem = document.getElementById("askButton");
              const statusElem = document.getElementById("status");
              const clearButtonElem = document.getElementById("clearButton");
              
              if (askButtonElem) askButtonElem.textContent = "Ask DeepSeek";
              if (statusElem) statusElem.textContent = "Response completed!";
              if (askButtonElem) askButtonElem.disabled = false;
              if (clearButtonElem) clearButtonElem.disabled = false;             

              // Reset the status after 3 seconds
              setTimeout(() => {
                const statusElem = document.getElementById("status");
                if (statusElem) statusElem.textContent = "Ready for prompting";
              }, 3000);
            }
            else if (command === "loadConversation") {
              // Load an existing conversation
              if (messages && messages.length > 0) {
                renderConversation(messages);
              }
            }
          });
          /**************************** END OF EVENT LISTENERS *************************************/
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