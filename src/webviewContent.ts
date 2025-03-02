import { markdownToHTML } from "./helpers/markdownConverter";
import * as fs from 'fs';
import * as path from 'path';

export default function getWebviewContent(): string {
  
  // import the markdownToHTML helper and convert it into a string. We will inject it to a <script> tag later.
  const markdownToHTMLFunctionString = markdownToHTML.toString();
  
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
            <option value="deepseek-r1:8b" selected>DeepSeek R1 8b (4.9GB)</option>
            <option value="deepseek-r1:14b">DeepSeek R1 14b (9GB)</option>
            <option value="deepseek-r1:32b">DeepSeek R1 32b (20GB)</option>
            <option value="deepseek-r1:70b">DeepSeek R1 70b (43GB)</option>
            <option value="deepseek-r1:671b">DeepSeek R1 671b (404GB)</option>
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
            <button id="testButton">Test Connection</button>
          </div>
        </div>
      </div>

      <script>
        // Acquire VSCode API
        const vscode =  acquireVsCodeApi();
        console.log('VSCode API acquired');

        // Inject markdown string to HTML helper function
        const markdownToHTML = ${markdownToHTMLFunctionString};

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
                  console.log("Got modelInstalledResult");
                  window.removeEventListener('message', messageHandler);
                  resolve(isInstalled);
                }
              };
              
              window.addEventListener('message', messageHandler);
              console.log('Added message event listener');
              
              // Set a timeout in case we don't get a response
              console.log('Setting timeout for model check');
              setTimeout(() => {
                console.log('Timeout reached for model check, resolving as false');
                window.removeEventListener('message', messageHandler);
                resolve(false);
              }, 5000);
            });
          } catch (error) {
            console.error('Error checking if model is installed:', error);
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

          // Handle model-selector. Check whether the selected DeepSeek model is installed. If not, give a warning.
          document.getElementById("model-selector").addEventListener("change", async (event) => {
            console.log('Model selector change event triggered');
            if(!event || !event.target) {
              console.log('Event or target is null, returning');
              return;
            }
            
            const select = event.target;
            const modelName = select.value;
            console.log("Selected model");
            
            const isInstalled = await modelInstalled(modelName);
            console.log("Model installed check result");
            const statusElem = document.getElementById("status");
            const askButtonElem = document.getElementById("askButton");
            const testButtonElem = document.getElementById("testButton");
            const clearButtonElem = document.getElementById("clearButton");

            if (!isInstalled) {
              statusElem.textContent = 'Error: selected model is not installed on your machine. Please install the current model with Ollama by running: "ollama pull ' + modelName + '" or select a different model';
              statusElem.style.color = "red";
              askButtonElem.disabled = true;
              testButtonElem.disabled = true;
              clearButtonElem.disabled = true;
            } else {
              statusElem.textContent = "Ready for prompting";
              statusElem.style.color = "";
              askButtonElem.disabled = false;
              testButtonElem.disabled = false;
              clearButtonElem.disabled = false;
              vscode.postMessage({ command: 'setModel', modelName: modelName });
            }
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
          console.log("Setting up main message event listener");
          window.addEventListener("message", event => {
            // console.log main message event received
            const { command, text, messages, isInstalled } = event.data;
            
            if (command === "chatResponse") {
              console.log('Received chatResponse command');
              // Update the assistant's response as it's streaming in
              if(text){
                updateCurrentStreamingMessage(text);
              }else{
                updateCurrentStreamingMessage("Processing your request with DeepSeek R1...");
              }
              const statusElem = document.getElementById("status");
              if (statusElem) {
                statusElem.textContent = "Receiving response...";
              } else {
                console.log('ERROR: status element not found when updating for chatResponse!');
              }
            }
            else if (command === "chatCompletion") {
              console.log('Received chatCompletion command');
              const askButtonElem = document.getElementById("askButton");
              const statusElem = document.getElementById("status");
              const clearButtonElem = document.getElementById("clearButton");
              
              if (askButtonElem) askButtonElem.textContent = "Ask DeepSeek";
              if (statusElem) statusElem.textContent = "Response completed!";
              if (askButtonElem) askButtonElem.disabled = false;
              if (clearButtonElem) clearButtonElem.disabled = false;

              // If messages are provided, render them
              if (messages) {
                renderConversation(messages);
              }

              // Reset the status after 3 seconds
              setTimeout(() => {
                const statusElem = document.getElementById("status");
                if (statusElem) statusElem.textContent = "Ready for prompting";
              }, 3000);
            }
            else if (command === "loadConversation") {
              console.log('Received loadConversation command');
              // Load an existing conversation
              if (messages && messages.length > 0) {
                renderConversation(messages);
              }
            }
            else if (command === "clearConversation") {
              console.log('Received clearConversation command');
              clearChat();
            }
            else if (command === "modelInstalledResult") {
              console.log("Received modelInstalledResult in main listener");
              // This is handled in the modelInstalled function's dedicated listener
            }
            else {
              console.log("Received unknown command");
            }
          });

          // Ready state
          const initialStatusElem = document.getElementById("status");
          if (initialStatusElem) {
            initialStatusElem.textContent = "Ready for prompting";
          } else {
            console.log("ERROR: status element not found during initial ready state!");
          }
          
          // Trigger model check on initial load
          console.log('Starting initial model check');
          const modelSelector = document.getElementById("model-selector");
          if (modelSelector) {
            console.log('Model selector found');
            const modelName = modelSelector.value;
            console.log("Initial selected model: " + modelName);
            
            (async () => {
              console.log('Starting async initial model check');
              try {
                console.log('Calling modelInstalled on page load');
                const isInstalled = await modelInstalled(modelName);
                console.log("Initial model check result: " + isInstalled);
                
                const statusElem = document.getElementById("status");
                const askButtonElem = document.getElementById("askButton");
                const testButtonElem = document.getElementById("testButton");
                const clearButtonElem = document.getElementById("clearButton");
                
                if (!isInstalled) {
                  console.log('Initial model not installed, updating UI');
                  if (statusElem) {
                    statusElem.textContent = "Error: selected model not installed. Please install the current model with Ollama or select a different model";
                    statusElem.style.color = "red";
                  }
                  if (askButtonElem) askButtonElem.disabled = true;
                  if (testButtonElem) testButtonElem.disabled = true;
                  if (clearButtonElem) clearButtonElem.disabled = true;
                } else {
                  console.log('Initial model is installed, updating UI');
                  if (statusElem) {
                    statusElem.textContent = "Ready for prompting";
                    statusElem.style.color = "";
                  }
                  if (askButtonElem) askButtonElem.disabled = false;
                  if (testButtonElem) testButtonElem.disabled = false;
                  if (clearButtonElem) clearButtonElem.disabled = false;
                  vscode.postMessage({ command: 'setModel', modelName: modelName });
                }
              } catch (error) {
                console.error('Error during initial model check:', error);
              }
            })();
          }
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