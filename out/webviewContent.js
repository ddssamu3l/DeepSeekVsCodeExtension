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
const markdownConverter_1 = require("./utils/markdownConverter");
const fs = __importStar(require("fs"));
/**
 * Generates the HTML content for the LoCopilot extension webview.
 * This includes the HTML structure, CSS styles, and JavaScript code for the chat interface.
 * @function getWebviewContent
 * @returns {string} HTML content for the webview
 */
function getWebviewContent() {
    // import the markdownToHTML helper and convert it into a string. We will inject it to a <script> tag later.
    const markdownToHTMLFunctionString = markdownConverter_1.markdownToHTML.toString();
    // Read the CSS file
    const cssContent = fs.readFileSync(`${__dirname}/styles/chatStyles.css`, 'utf8');
    return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
      <title>LoCopilot Chat</title>
      <style>
        ${cssContent}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <select class="model-selector" name="model-selector" id="model-selector">
            <option value="deepseek-r1:1.5b">DeepSeek R1 1.5b (1.5GB)</option>
              <option value="deepseek-r1:8b">DeepSeek R1 8b (4.9GB)</option>
              <option value="deepseek-r1:14b">DeepSeek R1 14b (9GB)</option>
              <option value="deepseek-r1:32b">DeepSeek R1 32b (20GB)</option>
              <option value="deepseek-r1:70b">DeepSeek R1 70b (43GB)</option>
            <option value="gemma3:1b">Gemma 3 1b (815MB)</option>
              <option value="gemma3:4b">Gemma 3 4b (3.3GB)</option>
              <option value="gemma3:12b">Gemma 3 12b (8.1GB)</option>
              <option value="gemma3:27b">Gemma 3 27b (17GB)</option>
            <option value="phi4:14b">Phi-4 14b (9.1GB)</option>
            <option value="qwen3:0.6b">Qwen3 0.6b (523MB)</option>
              <option value="qwen3:1.7b">Qwen3 1.7b (1.4GB)</option>
              <option value="qwen3:4b">Qwen3 4b (2.6GB)</option>
              <option value="qwen3:8b" selected>Qwen3 8b (5.2GB)</option>
              <option value="qwen3:14b">Qwen3 14b (9.3GB)</option>
              <option value="qwen3:30b-a3b">Qwen3 30b-a3b (19GB)</option>
              <option value="qwen3:32b">Qwen3 32b (20GB)</option>
              <option value="qwen3:235b-a22b">Qwen3 235b-a22b (142GB)</option>
            <option value="qwq">QwQ (20GB)</option>
          </select>
          <button id="clearButton">Clear Chat</button>
        </div>
        
        <div class="chat-container" id="chatContainer">
          <div class="welcome-message">Welcome to LoCopilot! Enter a prompt to start chatting.</div>
          <div id="loading"><div class="spinner"></div></div>
        </div>
        
        <div class="input-area">
          <div class="status" id="status"></div>
          <textarea id="userPrompt" placeholder="Ask LoCopilot anything..."></textarea>
          <div class="button-row">
            <button id="askButton">Send Prompt</button>
          </div>
        </div>
      </div>

      <script>
        /**************************** INITIAL SETUP AND CHECKS *************************************/
        const welcomeMessage = "Welcome to LoCopilot! Enter a prompt to start chatting.";

        // Acquire VSCode API
        const vscode =  acquireVsCodeApi();
        console.log('VSCode API acquired');

        // Inject markdown string to HTML helper function
        const markdownToHTML = ${markdownToHTMLFunctionString};

        // Ready state
        const modelSelector = document.getElementById("model-selector");
        const userPrompt = document.getElementById("userPrompt");
        let selectedModelName = modelSelector.value;
        let modelIsInstalled = checkSelectedModel("qwen3:8b"); // tracks whether the user's machine has installed the current selected model
        let isStreamingResponse = false; // tracks whether the extension is currently streaming a response from ollama
        const askButtonElem = document.getElementById("askButton");
        const clearButtonElem = document.getElementById("clearButton");
        const statusElem = document.getElementById("status");

        if(askButtonElem){
          askButtonElem.textContent = "Send Prompt"
        }else{
          console.error("ERROR: ask button not found during initial ready state");
        }
        if(clearButtonElem){
          clearButtonElem.textContent = "Clear Chat"
        }else{
          console.error("ERROR: clear button not found during initial ready state");
        }
        if (statusElem) {
          statusElem.textContent = "Ready for prompting";
        } else {
          console.error("ERROR: status element not found during initial ready state!");
        }
        /**************************** END OF INITIAL SETUP AND CHECKS *******************************/

        /**************************** JS FUNCTIONS *************************************/
        function updateUI(){
          if (!modelIsInstalled) {
            askButtonElem.disabled = true;
            statusElem.textContent =
              'Error: selected model is not installed on your machine. ' +
              'Please install the current model with Ollama by running: "ollama pull ' + selectedModelName + '" or select a different model';
            statusElem.style.color = "red";
            clearButtonElem.disabled = isStreamingResponse;
            return;
          }

          // Model is installed
          statusElem.style.color = "";

          if (isStreamingResponse) {
            statusElem.textContent = "Streaming response...";
            askButtonElem.textContent = "Generating...";
            askButtonElem.disabled = true;
            clearButtonElem.disabled = true;
          } else {
            statusElem.textContent = "Ready for prompting";
            askButtonElem.textContent = "Send Prompt";
            askButtonElem.disabled = false;
            clearButtonElem.disabled = false;
          }
        }
        // Check if a model is installed in Ollama
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
            modelIsInstalled = await modelInstalled(modelName);

            updateUI();
            if(modelIsInstalled){
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
          if(role === 'tool'){
            messageDiv.className = 'chat-message tool-message';
          }else if (role === 'user'){
            messageDiv.className = 'chat-message user-message';
          }else if (role === 'assistant'){
            messageDiv.className = 'chat-message assistant-message';
          }
          
          // User message can have a date id assigned immediately since they will only be added once
          // Assistant messages are constantly streamed so they will get an id when the "chatCompletion" command is activated
          if (role === 'assistant') {
            messageDiv.id = "assistant-message";
            messageDiv.innerHTML = markdownToHTML(content);
          }else if (role === 'tool') {
            messageDiv.id = "tool-message-" + Date.now();
            messageDiv.textContent = "Called tool: " + content;
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
          // Select the chat container
          const container = document.getElementById('chatContainer');
          
          // select the last message in the chat container (which should be an assistant messaage), and stream in the new content
          if (container && container.lastElementChild) {
            const streamingMsg = container.lastElementChild;

            if (streamingMsg) {
            streamingMsg.innerHTML = markdownToHTML(content);
            }
          } else {
            // If somehow it doesn't exist, just add a new message
            console.log("updateCurrentStreamingMessage() could not find current-streaming-message div. Creating a new current-streaming-message div");
            var messageDiv = addMessage('assistant', content);
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
              if(msg.role === "tool"){
                addMessage(msg.role, msg.name);
              }else if(msg.role !== "system"){
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

          // Handle model-selector. Check whether the selected model is installed. If not, give a warning.
          document.getElementById("model-selector").addEventListener("change", async (event) => {
            if(!event || !event.target) {
              return;
            }
            
            const select = event.target;
            if(!select) return;
            selectedModelName = select.value;
            if(!selectedModelName) return;
            
            checkSelectedModel(selectedModelName);
          });

          // Handle Ask button click
          document.getElementById("askButton").addEventListener("click", () => {

            const userTextPrompt = userPrompt.value.trim();
            if (!userPrompt) {
              document.getElementById("status").textContent = "Please enter a prompt first";
              return;
            }
            userPrompt.value = "";
            
            // Add user message to the chat
            addMessage('user', userTextPrompt);
            // Add a new streaming div for the ai to stream its response in
            addMessage('assistant', 'Processing your request...');

            isStreamingResponse = true;

            updateUI();
            vscode.postMessage({ command: 'userPrompt', text: userTextPrompt });
          });
          
          // Handle Clear button click
          document.getElementById("clearButton").addEventListener("click", () => {
            clearChat();
            vscode.postMessage({ command: 'clearConversation' });
            updateUI();
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
                console.error("Error: No text provided in chatResponse command");
              }
            }
            else if (command === "chatCompletion") {
              const container = document.getElementById('chatContainer');

              if(container && container.lastElementChild){
                const lastAssistantMessage = container.lastElementChild;
                lastAssistantMessage.innerHTML = markdownToHTML(text);
                lastAssistantMessage.id = "assistant-message-" + Date.now();
              }

              isStreamingResponse = false;
              updateUI();
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
              <h3>Error Initializing LoCopilot Chat</h3>
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