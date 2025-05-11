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
        /* Context Meter Styles */
        .status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 5px;
        }
        
        .context-meter-container {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        
        .context-meter {
          width: 100px;
          height: 8px;
          background-color: #eee;
          border-radius: 2px;
          overflow: hidden;
          position: relative;
        }
        
        .context-meter-fill {
          height: 100%;
          width: 0%;
          background-color: #5c87d6;
          border-radius: 2px;
          transition: width 0.3s ease;
          position: absolute;
          right: 0; /* Align to right instead of left */
        }
        
        .context-usage {
          font-size: 10px;
          color: #666;
          margin-top: 2px;
        }
        
        /* When approaching context limit */
        .context-meter-fill.warning {
          background-color: #e69b00;
        }
        
        /* When at or over context limit */
        .context-meter-fill.danger {
          background-color: #d64040;
        }
        
        /* Install prompts */
        .install-prompt {
          text-align: center;
          background-color: var(--vscode-notifications-background);
          border: 1px solid var(--vscode-notifications-border);
          padding: 20px;
          margin: 0 0 20px 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
          animation: fadeIn 0.3s ease-in-out;
          position: relative;
          z-index: 10;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .install-prompt h3 {
          margin-top: 0;
          margin-bottom: 12px;
          color: var(--vscode-editor-foreground);
          font-size: 16px;
          font-weight: 600;
        }
        
        .install-prompt p {
          margin-bottom: 16px;
          color: var(--vscode-descriptionForeground);
          max-width: 450px;
          line-height: 1.4;
        }
        
        .install-button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 8px 16px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
          min-width: 120px;
        }
        
        .install-button:hover {
          background-color: var(--vscode-button-hoverBackground);
          transform: translateY(-1px);
        }
        
        .install-button:active {
          transform: translateY(1px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <select class="model-selector" name="model-selector" id="model-selector">
            <option value="deepseek-r1:1.5b">DeepSeek R1 1.5b (1.5GB)</option>
              <option value="deepseek-r1:8b">DeepSeek R1 8b (4.9GB) ⭐</option>
              <option value="deepseek-r1:14b">DeepSeek R1 14b (9GB)</option>
              <option value="deepseek-r1:32b">DeepSeek R1 32b (20GB)</option>
              <option value="deepseek-r1:70b">DeepSeek R1 70b (43GB)</option>
            <option value="gemma3:1b">Gemma 3 1b (815MB)</option>
              <option value="gemma3:4b" selected>Gemma 3 4b (3.3GB) ⭐</option>
              <option value="gemma3:12b">Gemma 3 12b (8.1GB)</option>
              <option value="gemma3:27b">Gemma 3 27b (17GB)</option>
            <option value="codellama:instruct">CodeLlama instruct (3.8GB) ⭐</option>
              <option value="codellama:13b">CodeLlama 13b (8.2GB)</option>
              <option value="codellama:34b">CodeLlama 34b (21GB)</option>
              <option value="codellama:70b">CodeLlama 70b (42GB)</option>
            <option value="phi4:14b">Phi-4 14b (9.1GB)</option>
            <option value="qwen3:0.6b">Qwen3 0.6b (523MB)</option>
              <option value="qwen3:1.7b">Qwen3 1.7b (1.4GB)</option>
              <option value="qwen3:4b">Qwen3 4b (2.6GB)</option>
              <option value="qwen3:8b">Qwen3 8b (5.2GB)</option>
              <option value="qwen3:14b">Qwen3 14b (9.3GB)</option>
              <option value="qwen3:30b-a3b">Qwen3 30b-a3b (19GB)</option>
              <option value="qwen3:32b">Qwen3 32b (20GB)</option>
              <option value="qwen3:235b-a22b">Qwen3 235b-a22b (142GB)</option>
            <option value="qwq">QwQ (20GB)</option>
          </select>
          
        </div>
        
        <div class="chat-container" id="chatContainer">
          <div class="welcome-message">
            <h2>Welcome to LoCopilot!</h2>
            <p>Your local AI coding assistant powered by Ollama.</p>
            <h3>💡 Tips for Best Results:</h3>
            <ul>
              <li>Always specify file paths when asking about code (e.g., "In src/app.js, why is...")</li>
              <li>Use mouse selection for specific code snippets you want help with</li>
              <li>Click "Crawl Codebase" before asking complex questions about your project structure</li>
              <li>Be specific in your questions for more accurate answers</li>
            </ul>
            
            <p>Contact rainsongsoftware@gmail.com for support ❤️</p>
          </div>
          <div id="loading"><div class="spinner"></div></div>
        </div>
        
        <div class="input-area">
          <div class="status-bar">
            <div class="status" id="status"></div>
            <div class="context-meter-container">
              <div id="contextMeter" class="context-meter">
                <div id="contextMeterFill" class="context-meter-fill"></div>
              </div>
              <div id="contextUsage" class="context-usage">0 / 0 tokens</div>
            </div>
          </div>
          <textarea id="userPrompt" placeholder="Ask LoCopilot anything..."></textarea>
          <div class="button-row">
            <button id="askButton">Send Prompt</button>
            <button id="clearButton">Clear Chat</button>
            <button id="crawlButton"><span id="crawlSpinner" class="button-spinner" style="display:none;"></span> Crawl Codebase</button>
          </div>
        </div>
      </div>

      <script>
        /**************************** INITIAL SETUP AND CHECKS *************************************/
        const welcomeMessage = 
          '<h2>Welcome to LoCopilot!</h2>' +
          '<p>Your local AI coding assistant powered by Ollama.</p>' +
          '<h3>💡 Tips for Best Results:</h3>' +
          '<ul>' +
            '<li>Always specify file paths when asking about code (e.g., "In src/app.js, why is...")</li>' +
            '<li>Use mouse selection for specific code snippets you want help with</li>' +
            '<li>Click "Crawl Codebase" before asking complex questions about your project structure</li>' +
            '<li>Be specific in your questions for more accurate answers</li>' +
          '</ul>' +
          
          '<p>Contact rainsongsoftware@gmail.com for support ❤️</p>';

        // Acquire VSCode API
        const vscode =  acquireVsCodeApi();
        console.log('VSCode API acquired');

        // Inject markdown string to HTML helper function
        const markdownToHTML = ${markdownToHTMLFunctionString};

        // Ready state
        const modelSelector = document.getElementById("model-selector");
        const userPrompt = document.getElementById("userPrompt");
        let selectedModelName = modelSelector.value;
        let ollamaIsInstalled = false; // Track whether Ollama is installed
        let modelIsInstalled = false; // Track whether the current model is installed
        let isStreamingResponse = false; // tracks whether the extension is currently streaming a response from ollama
        let isCrawlingCodebase = false; // tracks whether a codebase crawl is in progress
        const askButtonElem = document.getElementById("askButton");
        const clearButtonElem = document.getElementById("clearButton");
        const crawlButtonElem = document.getElementById("crawlButton");
        const crawlSpinnerElem = document.getElementById("crawlSpinner");
        const statusElem = document.getElementById("status");
        const contextMeterFill = document.getElementById("contextMeterFill");
        const contextUsage = document.getElementById("contextUsage");
        
        // Context tracking variables
        let currentContextUsage = 0;
        let maxContextSize = 8192; // Default value
        
        // Model-specific context window sizes
        const modelContextSizes = {
          // DeepSeek-R1 distilled models (all have 131072-token context):contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}:contentReference[oaicite:2]{index=2}:contentReference[oaicite:3]{index=3}:contentReference[oaicite:4]{index=4}
          "deepseek-r1:1.5b": 131072,  // 131072 (128K) tokens:contentReference[oaicite:5]{index=5}
          "deepseek-r1:8b":   131072,  // 131072 (128K) tokens:contentReference[oaicite:6]{index=6}
          "deepseek-r1:14b":  131072,  // 131072 (128K) tokens:contentReference[oaicite:7]{index=7}
          "deepseek-r1:32b":  131072,  // 131072 (128K) tokens:contentReference[oaicite:8]{index=8}
          "deepseek-r1:70b":  131072,  // 131072 (128K) tokens:contentReference[oaicite:9]{index=9}

          // Google Gemma 3 models
          "gemma3:1b":       32768,   // 32768 (32K) tokens
          "gemma3:4b":      131072,   // 131072 (128K) tokens
          "gemma3:12b":     131072,   // 131072 (128K) tokens
          "gemma3:27b":     131072,   // 131072 (128K) tokens

          // Meta CodeLlama models
          "codellama:instruct":    16384,   // 16384 (16K) tokens
          "codellama:13b":   16384,   // 16384 (16K) tokens
          "codellama:34b":   16384,   // 16384 (16K) tokens
          "codellama:70b":   16384,   // 16384 (16K) tokens

          // Microsoft Phi-4 (14B) model
          "phi4:14b":        16384,   // 16384 (16K) tokens:contentReference[oaicite:14]{index=14}

          // Qwen 3 dense and MoE models (all have 40960-token context):contentReference[oaicite:15]{index=15}:contentReference[oaicite:16]{index=16}:contentReference[oaicite:17]{index=17}:contentReference[oaicite:18]{index=18}:contentReference[oaicite:19]{index=19}:contentReference[oaicite:20]{index=20}:contentReference[oaicite:21]{index=21}:contentReference[oaicite:22]{index=22}
          "qwen3:0.6b":       40960,  // 40960 tokens:contentReference[oaicite:23]{index=23}
          "qwen3:1.7b":       40960,  // 40960 tokens:contentReference[oaicite:24]{index=24}
          "qwen3:4b":         40960,  // 40960 tokens:contentReference[oaicite:25]{index=25}
          "qwen3:8b":         40960,  // 40960 tokens:contentReference[oaicite:26]{index=26}
          "qwen3:14b":        40960,  // 40960 tokens:contentReference[oaicite:27]{index=27}
          "qwen3:30b-a3b":    40960,  // 40960 tokens:contentReference[oaicite:28]{index=28}
          "qwen3:32b":        40960,  // 40960 tokens:contentReference[oaicite:29]{index=29}
          "qwen3:235b-a22b":  40960,  // 40960 tokens:contentReference[oaicite:30]{index=30}

          // Alibaba QwQ-32B reasoning model (32B Qwen2-based)
          "qwq":             40960   // 40960 tokens:contentReference[oaicite:31]{index=31}
        };

        
        // Initialize context meter display
        updateContextMeter(0, getContextSizeForModel("deepseek-r1:8b"));
        
        // Get context size for the specified model
        function getContextSizeForModel(modelName) {
          return modelContextSizes[modelName] || 8192; // Default to 8192 if model not found
        }

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
        
        // Initialize the extension by checking Ollama first, then model
        async function initializeExtension() {
          console.log("Initializing LoCopilot extension...");
          
          // First check if Ollama is installed
          ollamaIsInstalled = await checkOllamaInstalled();
          console.log("Ollama installed:", ollamaIsInstalled);
          
          // Clear any existing prompts to prevent duplicates
          const existingOllamaPrompt = document.getElementById("ollamaInstallPrompt");
          const existingModelPrompt = document.getElementById("modelInstallPrompt");
          if (existingOllamaPrompt) existingOllamaPrompt.remove();
          if (existingModelPrompt) existingModelPrompt.remove();
          
          // Only check model if Ollama is installed
          if (ollamaIsInstalled) {
            // Default to Gemma 3 4b model
            modelIsInstalled = await checkSelectedModel("gemma3:4b");
          }
          
          // Update UI based on checks
          updateUI();
          
          // Ensure the installation prompts are properly positioned at startup
          const chatContainer = document.getElementById('chatContainer');
          const welcomeMessage = document.querySelector('.welcome-message');
          const ollamaPrompt = document.getElementById("ollamaInstallPrompt");
          const modelPrompt = document.getElementById("modelInstallPrompt");
          
          // Reposition the prompts above welcome message if needed
          if (welcomeMessage && ollamaPrompt && welcomeMessage.compareDocumentPosition(ollamaPrompt) & Node.DOCUMENT_POSITION_FOLLOWING) {
            // Ollama prompt is after welcome message, move it before
            chatContainer.insertBefore(ollamaPrompt, welcomeMessage);
            
            // If model prompt exists, position it properly too
            if (modelPrompt) {
              ollamaPrompt.after(modelPrompt);
            }
          } else if (welcomeMessage && modelPrompt && !ollamaPrompt && 
                    welcomeMessage.compareDocumentPosition(modelPrompt) & Node.DOCUMENT_POSITION_FOLLOWING) {
            // Model prompt is after welcome message but no Ollama prompt
            chatContainer.insertBefore(modelPrompt, welcomeMessage);
          }
        }
        
        // Start initialization
        initializeExtension();
        /**************************** END OF INITIAL SETUP AND CHECKS *******************************/

        /**************************** JS FUNCTIONS *************************************/
        function updateUI(){
          // First check if Ollama is installed
          if (!ollamaIsInstalled) {
            // Disable all buttons if Ollama isn't installed
            askButtonElem.disabled = true;
            clearButtonElem.disabled = true;
            crawlButtonElem.disabled = true;
            
            if (document.getElementById("ollamaInstallPrompt") === null) {
              displayOllamaInstallPrompt();
            }
            
            statusElem.textContent = "Ollama is not installed";
            statusElem.style.color = "var(--vscode-errorForeground)";
            return;
          }
          
          // Then check if the model is installed
          if (!modelIsInstalled) {
            askButtonElem.disabled = true;
            statusElem.textContent =
              'Error: selected model is not installed on your machine.';
            statusElem.style.color = "var(--vscode-errorForeground)";
            clearButtonElem.disabled = isStreamingResponse;
            crawlButtonElem.disabled = true;
            
            // Show model installation prompt if not already displayed
            if (document.getElementById("modelInstallPrompt") === null) {
              displayModelInstallPrompt(selectedModelName);
            }
            
            return;
          } else {
            // If model is installed, remove any model install prompt
            const modelPrompt = document.getElementById("modelInstallPrompt");
            if (modelPrompt) {
              modelPrompt.remove();
            }
          }

          // Model is installed
          statusElem.style.color = "var(--vscode-foreground)";

          if (isStreamingResponse) {
            statusElem.textContent = "Streaming response...";
            askButtonElem.textContent = "Generating...";
            askButtonElem.disabled = true;
            clearButtonElem.disabled = true;
            crawlButtonElem.disabled = true;
          } else if (isCrawlingCodebase) {
            statusElem.textContent = "Scanning codebase...";
            crawlButtonElem.disabled = true;
            crawlButtonElem.classList.add('crawling');
            crawlSpinnerElem.style.display = 'inline-block';
          } else {
            statusElem.textContent = "Ready for prompting";
            askButtonElem.textContent = "Send Prompt";
            askButtonElem.disabled = false;
            clearButtonElem.disabled = false;
            crawlButtonElem.disabled = false;
            crawlButtonElem.classList.remove('crawling');
            crawlSpinnerElem.style.display = 'none';
          }
        }
        
        // Function to display Ollama installation prompt
        function displayOllamaInstallPrompt() {
          // Remove any existing prompts
          const existingPrompt = document.getElementById("ollamaInstallPrompt");
          if (existingPrompt) {
            existingPrompt.remove();
          }
          
          const chatContainer = document.getElementById('chatContainer');
          
          // Create prompt element
          const promptDiv = document.createElement('div');
          promptDiv.className = 'install-prompt';
          promptDiv.id = 'ollamaInstallPrompt';
          
          // Create HTML structure manually to avoid template string issues
          const heading = document.createElement('h3');
          heading.textContent = 'Ollama Not Installed';
          
          const paragraph = document.createElement('p');
          paragraph.textContent = 'LoCopilot requires Ollama to run local AI models. Please install Ollama to continue.';
          
          const button = document.createElement('button');
          button.id = 'installOllamaButton';
          button.className = 'install-button';
          button.textContent = 'Install Ollama';
          
          // Append elements to prompt div
          promptDiv.appendChild(heading);
          promptDiv.appendChild(paragraph);
          promptDiv.appendChild(button);
          
          // Always insert at the beginning of the container, before any other content
          const welcomeMessage = document.querySelector('.welcome-message');
          if (welcomeMessage) {
            // Insert before welcome message
            chatContainer.insertBefore(promptDiv, welcomeMessage);
          } else if (chatContainer.firstChild) {
            // Insert before first child of any type
            chatContainer.insertBefore(promptDiv, chatContainer.firstChild);
          } else {
            // Container is empty
            chatContainer.appendChild(promptDiv);
          }
          
          // Add click handler for install button
          document.getElementById("installOllamaButton").addEventListener("click", () => {
            vscode.postMessage({ command: 'installOllama' });
          });
        }
        
        // Function to display model installation prompt
        function displayModelInstallPrompt(modelName) {
          // Remove any existing model prompt
          const existingPrompt = document.getElementById("modelInstallPrompt");
          if (existingPrompt) {
            existingPrompt.remove();
          }
          
          const chatContainer = document.getElementById('chatContainer');
          
          // Create prompt element
          const promptDiv = document.createElement('div');
          promptDiv.className = 'install-prompt';
          promptDiv.id = 'modelInstallPrompt';
          
          // Create HTML structure manually to avoid template string issues
          const heading = document.createElement('h3');
          heading.textContent = 'Model Not Installed';
          
          const paragraph = document.createElement('p');
          paragraph.textContent = 'The selected model "' + modelName + '" is not installed. Please install it to continue.';
          
          const button = document.createElement('button');
          button.id = 'installModelButton';
          button.className = 'install-button';
          button.textContent = 'Install ' + modelName;
          
          // Append elements to prompt div
          promptDiv.appendChild(heading);
          promptDiv.appendChild(paragraph);
          promptDiv.appendChild(button);
          
          // Insert after Ollama prompt if it exists, otherwise at the beginning
          const ollamaPrompt = document.getElementById("ollamaInstallPrompt");
          const welcomeMessage = document.querySelector('.welcome-message');
          
          if (ollamaPrompt) {
            // Place after the Ollama prompt
            ollamaPrompt.after(promptDiv);
          } else if (welcomeMessage) {
            // Place before the welcome message
            chatContainer.insertBefore(promptDiv, welcomeMessage);
          } else if (chatContainer.firstChild) {
            // Place at the beginning
            chatContainer.insertBefore(promptDiv, chatContainer.firstChild);
          } else {
            // Container is empty
            chatContainer.appendChild(promptDiv);
          }
          
          // Add click handler for install button
          document.getElementById("installModelButton").addEventListener("click", () => {
            vscode.postMessage({ command: 'installModel', modelName: modelName });
          });
        }

        // Check if Ollama is installed
        async function checkOllamaInstalled() {          
          try {
            // Send message to extension host to check if Ollama is installed
            vscode.postMessage({ 
              command: 'checkOllamaInstalled'
            });
            
            // Get the result from the extension
            return new Promise((resolve) => {
              const messageHandler = (event) => {
                const { command, isInstalled } = event.data;
                if (command === 'ollamaInstalledResult') {
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
            console.error('Error checking if Ollama is installed:', error);
            return false;
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
            // First check if Ollama is installed
            if (!ollamaIsInstalled) {
              const isOllamaInstalled = await checkOllamaInstalled();
              ollamaIsInstalled = isOllamaInstalled;
              
              if (!ollamaIsInstalled) {
                updateUI();
                return false;
              }
            }
            
            // Then check if the model is installed
            modelIsInstalled = await modelInstalled(modelName);
            
            // Only set the model if it's installed
            if (modelIsInstalled) {
              // Update the extension with the selected model
              vscode.postMessage({ command: 'setModel', modelName: modelName });
              
              // Also request initial context info update
              vscode.postMessage({ command: 'requestContextInfo' });
            }
  
            updateUI();
            return modelIsInstalled;
          } catch (error) {
            console.error('Error during model check:', error);
            return false;
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
          
          // Save any installation prompts
          const ollamaPrompt = document.getElementById('ollamaInstallPrompt');
          const modelPrompt = document.getElementById('modelInstallPrompt');
          
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
            messageDiv.id = "assistant-message";
            messageDiv.innerHTML = markdownToHTML(content);
          }else{
            messageDiv.textContent = content;
            messageDiv.id = "user-message-" + Date.now();
          }

          // Restore installation prompts at the beginning of the container if they existed
          if (ollamaPrompt) {
            chatContainer.appendChild(ollamaPrompt);
          }
          
          if (modelPrompt) {
            if (ollamaPrompt) {
              ollamaPrompt.after(modelPrompt);
            } else {
              chatContainer.appendChild(modelPrompt);
            }
          }
          
          // Add the message after the prompts
          chatContainer.appendChild(messageDiv);

          // Scroll to bottom
          chatContainer.scrollTop = chatContainer.scrollHeight;
          
          return messageDiv;
        }
        
        // Clear all messages from the chat
        function clearChat() {
          const chatContainer = document.getElementById('chatContainer');
          
          // Save installation prompts if they exist
          const ollamaPrompt = document.getElementById('ollamaInstallPrompt');
          const modelPrompt = document.getElementById('modelInstallPrompt');
          
          // Clear the chat container
          chatContainer.innerHTML = '<div class="welcome-message">' + welcomeMessage + '</div>';
          
          // Restore installation prompts if they existed
          if (ollamaPrompt) {
            const welcomeMessage = document.querySelector('.welcome-message');
            if (welcomeMessage) {
              welcomeMessage.after(ollamaPrompt);
            } else {
              chatContainer.prepend(ollamaPrompt);
            }
          }
          
          if (modelPrompt && !ollamaPrompt) {
            const welcomeMessage = document.querySelector('.welcome-message');
            if (welcomeMessage) {
              welcomeMessage.after(modelPrompt);
            } else {
              chatContainer.prepend(modelPrompt); 
            }
          } else if (modelPrompt && ollamaPrompt) {
            ollamaPrompt.after(modelPrompt);
          }
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
          // Clear the chat first
          clearChat();
          
          // Then render messages
          if (messages && messages.length > 0) {
            messages.forEach(msg => {
              if(msg.role !== "system"){
                addMessage(msg.role, msg.content);
              }
            });
          }
          
          // Re-check if prompts should be shown
          updateUI();
        }

        // Update context meter UI
        function updateContextMeter(used, total) {
          if (!contextMeterFill || !contextUsage) {
            console.error("Context meter elements not found");
            return;
          }
          
          // Ensure values are numbers and valid
          used = parseInt(used) || 0;
          total = parseInt(total) || 8192;
          
          console.log('Updating context meter:', used, 'of', total, 'tokens');
          
          // Update values
          currentContextUsage = used;
          maxContextSize = total;
          
          // Calculate percentage
          const percentage = Math.min(100, (used / total) * 100);
          
          // Update fill width - now filling from right to left
          contextMeterFill.style.width = percentage + '%';
          
          // Update text
          contextUsage.textContent = used + ' / ' + total + ' tokens';
          
          // Update color based on usage
          contextMeterFill.classList.remove('warning', 'danger');
          if (percentage > 90) {
            contextMeterFill.classList.add('danger');
          } else if (percentage > 75) {
            contextMeterFill.classList.add('warning');
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
            
            // Update the context window size based on the selected model
            maxContextSize = getContextSizeForModel(selectedModelName);
            updateContextMeter(currentContextUsage, maxContextSize);
            
            // Check if the selected model is installed
            await checkSelectedModel(selectedModelName);
          });

          // Set default model to CodeLlama instruct
          const modelSelect = document.getElementById("model-selector");
          if (modelSelect) {
            // Find CodeLlama instruct option and select it
            for (let i = 0; i < modelSelect.options.length; i++) {
              if (modelSelect.options[i].value === "gemma3:4b") {
                modelSelect.selectedIndex = i;
                selectedModelName = "gemma3:4b";
                break;
              }
            }
          }

          // Handle Ask button click
          document.getElementById("askButton").addEventListener("click", () => {
            // Don't allow sending prompts if we're already streaming or crawling
            if (isStreamingResponse || isCrawlingCodebase) return;

            const userTextPrompt = userPrompt.value.trim();
            if (!userPrompt.value.trim()) {
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
            // Don't allow clearing if we're streaming or crawling
            if (isStreamingResponse || isCrawlingCodebase) return;
            
            clearChat();
            vscode.postMessage({ command: 'clearConversation' });
            
            // Reset context usage counter when clearing conversation
            currentContextUsage = 0;
            updateContextMeter(currentContextUsage, maxContextSize);
            
            updateUI();
          });
          
          // Also handle Enter key to submit (Shift+Enter for new line)
          document.getElementById("userPrompt").addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              document.getElementById("askButton").click();
            }
          });

          // Handle the crawl button click
          document.getElementById("crawlButton").addEventListener("click", () => {
            if (isCrawlingCodebase) return;
            
            isCrawlingCodebase = true;
            updateUI();
            
            // Send message to extension to start codebase crawl
            vscode.postMessage({ command: 'crawlCodebase' });
          });

          // Listen for messages from the extension
          window.addEventListener("message", event => {
            const { command, text, messages, isInstalled, contextInfo } = event.data;
            
            if (command === "chatResponse") {
              // Update the assistant's response as it's streaming in
              if(text){
                // Make sure isStreamingResponse is set to true while streaming
                isStreamingResponse = true;
                updateUI();
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

              // Calculate approximate token usage based on message length
              // This is a rough estimation - Ollama's actual count would be more accurate
              // but we'll use this as a fallback if contextInfo isn't provided
              if (contextInfo && typeof contextInfo.used === 'number') {
                // Use the token count provided by the backend if available
                currentContextUsage = contextInfo.used;
              } else {
                // Fallback to rough estimation based on message content
                const allMessages = messages.map(msg => msg.content).join(' ');
                // Rough estimation: ~4 characters per token on average
                currentContextUsage = Math.ceil(allMessages.length / 4);
              }
              
              // Update context meter with current usage and model's context size
              updateContextMeter(currentContextUsage, maxContextSize);
              
              isStreamingResponse = false;
              updateUI();
            }
            else if (command === "loadConversation") {
              // Load an existing conversation
              if (messages && messages.length > 0) {
                // Save current installation states
                const wasOllamaInstalled = ollamaIsInstalled;
                const wasModelInstalled = modelIsInstalled;
                
                // Render the conversation
                renderConversation(messages);
                
                // Restore installation status
                ollamaIsInstalled = wasOllamaInstalled;
                modelIsInstalled = wasModelInstalled;
                
                // Reset context usage counter when loading a conversation
                currentContextUsage = 0;
                updateContextMeter(currentContextUsage, maxContextSize);
                
                // Make sure UI reflects the correct installation state
                updateUI();
                
                // Fix prompt positioning - force installation prompts to be above everything else
                const chatContainer = document.getElementById('chatContainer');
                const ollamaPrompt = document.getElementById("ollamaInstallPrompt");
                const modelPrompt = document.getElementById("modelInstallPrompt");
                
                if (ollamaPrompt && chatContainer.firstChild !== ollamaPrompt) {
                  chatContainer.insertBefore(ollamaPrompt, chatContainer.firstChild);
                }
                
                if (modelPrompt) {
                  if (ollamaPrompt) {
                    ollamaPrompt.after(modelPrompt);
                  } else if (chatContainer.firstChild !== modelPrompt) {
                    chatContainer.insertBefore(modelPrompt, chatContainer.firstChild);
                  }
                }
              }
            }
            else if (command === "contextUpdate") {
              // Only use backend context info for the "used" value
              if (contextInfo && typeof contextInfo.used === 'number') {
                currentContextUsage = contextInfo.used;
                updateContextMeter(currentContextUsage, maxContextSize);
                console.log('Context update received, using token count:', currentContextUsage);
              }
            }
            else if (command === "ollamaInstalledResult") {
              console.log("Ollama installation check result:", isInstalled);
              ollamaIsInstalled = isInstalled;
              
              // If Ollama was just installed, check the model
              if (ollamaIsInstalled && !modelIsInstalled) {
                checkSelectedModel(selectedModelName);
              } else {
                updateUI();
              }
            }
            else if (command === "modelInstalledResult") {
              console.log("Model installation check result:", isInstalled);
              modelIsInstalled = isInstalled;
              
              if (modelIsInstalled) {
                // Only if the model is installed, update the model on the extension side
                // This will also get the context window size from the actual model
                vscode.postMessage({ command: 'setModel', modelName: selectedModelName });
                
                // Update context window size based on our local mapping
                maxContextSize = getContextSizeForModel(selectedModelName);
                updateContextMeter(currentContextUsage, maxContextSize);
              }
              
              updateUI();
            }
            else if (command === "crawlStatus") {
              const { status, tokenCount, error } = event.data;
              
              if (status === 'started') {
                isCrawlingCodebase = true;
                statusElem.textContent = "Scanning codebase...";
              }
              else if (status === 'completed') {
                isCrawlingCodebase = false;
                statusElem.textContent = "Codebase scan complete!";
                
                // Update token count if provided
                if (typeof tokenCount === 'number') {
                  currentContextUsage = tokenCount;
                  updateContextMeter(currentContextUsage, maxContextSize);
                }
                
                setTimeout(() => {
                  if (statusElem.textContent === "Codebase scan complete!") {
                    statusElem.textContent = "Ready for prompting";
                  }
                }, 3000);
              }
              else if (status === 'error') {
                isCrawlingCodebase = false;
                statusElem.textContent = "Error scanning codebase: " + (error || "Unknown error");
                statusElem.style.color = "var(--vscode-errorForeground)";
              }
              
              updateUI();
            }
          });
          /**************************** END OF EVENT LISTENERS *************************************/
        } catch (err) {
          console.error('Fatal error:', err);
          document.body.innerHTML = 
            '<div style="color:red;padding:20px;">' +
              '<h3>Error Initializing LoCopilot Chat</h3>' +
              '<p>' + err.message + '</p>' +
              '<pre>' + err.stack + '</pre>' +
            '</div>';
        }
      </script>
    </body>
    </html>
  `;
}
//# sourceMappingURL=webviewContent.js.map