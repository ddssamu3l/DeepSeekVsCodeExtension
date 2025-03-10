"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Acquire VSCode API
const vscode = acquireVsCodeApi();
console.log('VSCode API acquired');
// Inject markdown string to HTML helper function
const markdownToHTML = $, { markdownToHTMLFunctionString };
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
    }
    catch (error) {
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
    }
    else {
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
    }
    else {
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
            if (msg.role !== "system") {
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
        if (!event || !event.target) {
            return;
        }
        const select = event.target;
        const modelName = select.value;
        const isInstalled = await modelInstalled(modelName);
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
        }
        else {
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
        }
        catch (err) {
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
        }
        catch (err) {
            document.getElementById("status").textContent = "Test failed: " + err.message;
        }
    });
    // Listen for messages from the extension
    window.addEventListener("message", event => {
        const { command, text, messages, isInstalled } = event.data;
        if (command === "chatResponse") {
            // Update the assistant's response as it's streaming in
            if (text) {
                updateCurrentStreamingMessage(text);
            }
            else {
                updateCurrentStreamingMessage("Processing your request with DeepSeek R1...");
            }
            const statusElem = document.getElementById("status");
            if (statusElem) {
                statusElem.textContent = "Receiving response...";
            }
        }
        else if (command === "chatCompletion") {
            const askButtonElem = document.getElementById("askButton");
            const statusElem = document.getElementById("status");
            const clearButtonElem = document.getElementById("clearButton");
            if (askButtonElem)
                askButtonElem.textContent = "Ask DeepSeek";
            if (statusElem)
                statusElem.textContent = "Response completed!";
            if (askButtonElem)
                askButtonElem.disabled = false;
            if (clearButtonElem)
                clearButtonElem.disabled = false;
            // If messages are provided, render them
            if (messages) {
                renderConversation(messages);
            }
            // Reset the status after 3 seconds
            setTimeout(() => {
                const statusElem = document.getElementById("status");
                if (statusElem)
                    statusElem.textContent = "Ready for prompting";
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
        else if (command === "modelInstalledResult") {
            // This is handled in the modelInstalled function's dedicated listener
        }
    });
    // Ready state
    const initialStatusElem = document.getElementById("status");
    if (initialStatusElem) {
        initialStatusElem.textContent = "Ready for prompting";
    }
    else {
        console.log("ERROR: status element not found during initial ready state!");
    }
    // Trigger model check on initial load
    const modelSelector = document.getElementById("model-selector");
    if (modelSelector) {
        const modelName = modelSelector.value;
        (async () => {
            try {
                const isInstalled = await modelInstalled(modelName);
                const statusElem = document.getElementById("status");
                const askButtonElem = document.getElementById("askButton");
                const testButtonElem = document.getElementById("testButton");
                const clearButtonElem = document.getElementById("clearButton");
                if (!isInstalled) {
                    if (statusElem) {
                        statusElem.textContent = "Error: selected model not installed. Please install the current model with Ollama or select a different model";
                        statusElem.style.color = "red";
                    }
                    if (askButtonElem)
                        askButtonElem.disabled = true;
                    if (testButtonElem)
                        testButtonElem.disabled = true;
                    if (clearButtonElem)
                        clearButtonElem.disabled = true;
                }
                else {
                    if (statusElem) {
                        statusElem.textContent = "Ready for prompting";
                        statusElem.style.color = "";
                    }
                    if (askButtonElem)
                        askButtonElem.disabled = false;
                    if (testButtonElem)
                        testButtonElem.disabled = false;
                    if (clearButtonElem)
                        clearButtonElem.disabled = false;
                    vscode.postMessage({ command: 'setModel', modelName: modelName });
                }
            }
            catch (error) {
                console.error('Error during initial model check:', error);
            }
        })();
    }
}
catch (err) {
    console.error('Fatal error:', err);
    document.body.innerHTML = ;
    `
            <div style="color:red;padding:20px;">
              <h3>Error Initializing DeepSeek Chat</h3>
              <p>\${err.message}</p>
              <pre>\${err.stack}</pre>
            </div>
          \`;
        };
}
//# sourceMappingURL=webviewLogic.js.map