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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = __importStar(require("vscode"));
const ollama_1 = __importDefault(require("ollama"));
const editorUtils_1 = __importDefault(require("../utils/editorUtils"));
const removeThink_1 = __importDefault(require("../utils/removeThink"));
const webviewContent_1 = __importDefault(require("../webviewContent"));
const tools_1 = require("../utils/tools");
/**
 * Provider class for the LoCopilot VS Code extension.
 * Handles the webview, conversation history, and communication with Ollama.
 * @implements {vscode.WebviewViewProvider}
 */
class LoCopilotViewProvider {
    _extensionUri;
    /** The current webview instance */
    _view;
    /** History of messages in the current conversation */
    _conversationHistory;
    /** The current Ollama model being used */
    _currentModel;
    /** Reference to the active text editor */
    _editor;
    /**
     * Creates a new instance of LoCopilotViewProvider.
     * @param {vscode.Uri} _extensionUri - The URI of the extension directory
     */
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
        const toolDescriptionsForSystemPrompt = tools_1.availableTools.map(t => ({
            type: t.type,
            function: {
                name: t.function.name,
                description: t.function.description,
                parameters: t.function.parameters
            }
        }));
        // Construct the system prompt piece by piece
        let systemPrompt = `You are an AI Coding agent. CRITICAL: Assume every question the user asks is related to the current codebase that the user is looking at.\n\nYou will help your user with code related tasks.\nThe user's prompts may include selected text or current file content for context. Use this information if relevant.\nYou have access to a set of tools to gather information about the user's codebase or perform actions. You have the ability to call multiple tools sequentially, or multiple tools at once if needed.\nWhen you decide to use a tool, your response MUST be a JSON object containing a \"tool_calls\" array.\nEach object in the \"tool_calls\" array must have a \"type\" field set to \"function\", and a \"function\" field.\nThe \"function\" field must be an object with a \"name\" (the tool's name) and \"arguments\" (an object of parameters).\nYou MUST also provide a unique \"id\" for each tool call (e.g., \"call_123\", \"call_abc\", etc.). This ID will be used to match the tool's output back to your request.\n\nExample of a tool call response:\n\`\`\`json\n{\n  \"role\": \"assistant\",\n  \"content\": \"Okay, I need to find some files first.\",\n  \"tool_calls\": [\n    {\n      \"id\": \"call_xyz_1\",\n      \"type\": \"function\",\n      \"function\": {\n        \"name\": \"glob\",\n        \"arguments\": {\"pattern\": \"*.ts\"}\n      }\n    }\n  ]\n}\n\`\`\`\n\nAfter you provide tool calls, I will execute them and return the results in \"tool\" role messages, each with a \"tool_call_id\" matching your request and \"content\" holding the tool's output (as a JSON string). These tool result messages are for your internal use only and will NOT be shown to the user.\nYou can then use these results to make further decisions, call more tools, or generate your final answer to the user.\nIf you need to call multiple tools sequentially (e.g., find files, then read one), make one set of tool calls, wait for the results, then make the next set of tool calls.\nWhen you have all the information you need and are ready to provide the final answer to the user, respond with your answer in the \"content\" field and DO NOT include a \"tool_calls\" field.\n\n**Tool Usage Strategy Hints:**\n*   If the user asks about a specific file (e.g., \"middleware.ts\"), try using \`glob\` first with a pattern like \`**/*middleware.ts\`. \n*   If \`glob\` doesn't find the exact file, or if the user asks about code *within* files (e.g., \"find the saveInterviewFeedback function\"), use \`grep\`. \n*   For \`grep\`, use the \`pattern\` argument for the specific code/text to find, and optionally use \`filePattern\` (e.g., \`**/*.ts\`) to limit the search to certain file types. \`filePattern\` uses glob syntax relative to the workspace root.\n*   If a tool returns an empty result (e.g., \`{\"files\":[]}\` or \`{\"matches\":[]}\`), consider broadening your search pattern or trying a different tool if appropriate.\n*   Once you have identified the correct file path(s) from \`glob\` or \`grep\`, use the \`read\` tool with the \`filePath\` argument (which should be an absolute path provided by glob/grep or relative to the workspace) to get the file content.\n\nIMPORTANT: If you are unable to gather the information needed to answer the user's question after using the available tools, respond with a message telling the user that you are unable to answer their question, asking them to specify which files contain the information you need in order to answer their question.\n\nAvailable tools:\n`;
        systemPrompt += JSON.stringify(toolDescriptionsForSystemPrompt, null, 2);
        this._conversationHistory = [
            {
                role: "system",
                content: systemPrompt,
            },
        ];
        this._currentModel = "qwen3:8b"; // Default model
        this._editor = vscode.window.activeTextEditor;
        vscode.window.onDidChangeActiveTextEditor(editor => {
            this._editor = editor;
        });
    }
    /**
     * Required method to implement the WebviewViewProvider interface.
     * Initializes the webview when it becomes visible in VS Code.
     * @param {vscode.WebviewView} webviewView - The webview view to configure
     * @param {vscode.WebviewViewResolveContext} _context - The context in which the view is being resolved
     * @param {vscode.CancellationToken} _token - A cancellation token
     */
    resolveWebviewView(webviewView, _context, _token) {
        try {
            // Store the webview instance
            this._view = webviewView;
            // Configure webview settings
            this._view.webview.options = {
                enableScripts: true,
                localResourceRoots: [this._extensionUri],
            };
            // Set the webview content
            this._updateWebview();
            // Handle messages from the webview
            this._view.webview.onDidReceiveMessage(async (message) => {
                if (message.command === "userPrompt") {
                    await this._handleUserPrompt(message.text);
                }
                else if (message.command === "clearConversation") {
                    this._clearConversation();
                }
                else if (message.command === "debug") {
                    // Allow webview to send debug messages
                    console.log("DEBUG from webview:", message.text);
                }
                else if (message.command === "checkModelInstalled") {
                    await this._checkModelInstalled(message.modelName);
                }
                else if (message.command === "setModel") {
                    console.log("LoCopilot model set to: " + message.modelName);
                    this._currentModel = message.modelName;
                }
            });
        }
        catch (error) {
            console.error("Error initializing webview:", error);
            vscode.window.showErrorMessage(`LoCopilot webview initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Updates the HTML content of the webview and initializes it with the conversation history.
     * @private
     */
    _updateWebview() {
        if (!this._view) {
            console.error("Cannot update webview - view is undefined");
            return;
        }
        try {
            const htmlContent = (0, webviewContent_1.default)();
            this._view.webview.html = htmlContent;
            // After a short delay, send conversation history if available
            setTimeout(() => {
                if (this._view && this._conversationHistory.length > 0) {
                    this._view.webview.postMessage({
                        command: "loadConversation",
                        messages: this._conversationHistory // Send filtered history
                    });
                }
            }, 300);
        }
        catch (error) {
            console.error("Error setting webview HTML:", error);
            vscode.window.showErrorMessage(`LoCopilot failed to render content: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Clears the conversation history, keeping only the system prompt.
     * @private
     */
    _clearConversation() {
        this._conversationHistory.length = 1;
        console.log("Chat history cleared");
        if (this._view) {
            this._view.webview.postMessage({
                command: "loadConversation",
                messages: this._conversationHistory // Send filtered history
            });
        }
    }
    /**
     * Checks if a specific Ollama model is installed.
     * @private
     * @param {string} modelName - The name of the model to check
     * @returns {Promise<boolean>} True if the model is installed, false otherwise
     */
    async _checkModelInstalled(modelName) {
        if (!this._view) {
            console.error("Cannot check model - view is undefined");
            return false;
        }
        try {
            await ollama_1.default.show({ model: modelName });
            this._view.webview.postMessage({
                command: "modelInstalledResult",
                isInstalled: true,
                modelName: modelName // Include modelName for clarity in handler
            });
            return true;
        }
        catch (error) { // Catches error if model doesn't exist
            console.log(`Model ${modelName} is not installed or Ollama is not running.`);
            // Check if it's a connection error vs. model not found
            let isInstalled = false;
            let postMessage = true;
            if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
                console.error("Ollama connection refused. Is Ollama running?");
                // Optionally suppress the webview message if Ollama isn't running, 
                // or show a specific status in the webview.
                // For now, we still tell the webview it's not installed.
            }
            else {
                // Assume model not found
                console.log(`Model ${modelName} is not installed.`);
            }
            if (this._view && postMessage) {
                this._view.webview.postMessage({
                    command: "modelInstalledResult",
                    isInstalled: false,
                    modelName: modelName // Include modelName for clarity in handler
                });
            }
            return isInstalled;
        }
    }
    /**
     * Adds a new user message and a placeholder assistant message to the conversation history.
     * @private
     * @param {string} fullPrompt - The complete user prompt including any context
     */
    _buildNewChatResponse(fullPrompt) {
        this._conversationHistory.push({ role: "user", content: fullPrompt });
    }
    /**
     * Builds the complete prompt that will be sent to Ollama with all relevant context.
     * @private
     * @param {string} userPrompt - The text prompt that the user entered
     * @returns {string} The complete prompt with user input, selected text, and file content
     */
    _buildFullPrompt(userPrompt) {
        const { fileContent, selectedText } = (0, editorUtils_1.default)();
        const activeEditor = vscode.window.activeTextEditor;
        const fileName = activeEditor ? activeEditor.document.fileName.split('/').pop() : 'unknown file';
        let fullPrompt = `User prompt: ${userPrompt}`;
        if (selectedText.trim()) {
            fullPrompt += `\n\nUser selected text (from ${fileName}):\n\`\`\`\n${selectedText}\n\`\`\`\n`;
        }
        // if (fileContent.trim()) {
        //    fullPrompt += `\n\nText content of current file (${fileName}):\n\`\`\`\n${fileContent}\n\`\`\`\n`;
        // }
        return fullPrompt;
    }
    /**
     * Handles user prompts sent from the webview, processes them, and sends them to Ollama.
     * @private
     * @param {string} userPrompt - The text prompt submitted by the user
     */
    async _handleUserPrompt(userPrompt) {
        if (!this._view) {
            console.error("Cannot handle prompt - view is undefined");
            return;
        }
        console.log("Received user prompt: " + userPrompt);
        const fullPrompt = this._buildFullPrompt(userPrompt);
        // Add user message to internal history
        this._conversationHistory.push({ role: "user", content: fullPrompt });
        // Update webview immediately with the user message (filtered history)
        this._view.webview.postMessage({ command: "loadConversation", messages: this._conversationHistory });
        let currentMessages = JSON.parse(JSON.stringify(this._conversationHistory));
        const maxToolRounds = 5;
        let finalAssistantMessageContent = "";
        let finalAssistantMessageProcessed = false;
        try {
            for (let round = 0; round < maxToolRounds; round++) {
                // Prepare messages for Ollama
                const messagesForOllama = currentMessages.map(msg => {
                    // Clean up message object for Ollama API compliance
                    const cleanMsg = { role: msg.role, content: msg.content || "" };
                    if (msg.role === 'assistant' && msg.tool_calls) {
                        cleanMsg.tool_calls = msg.tool_calls;
                    }
                    if (msg.role === 'tool' && msg.tool_call_id) {
                        // According to Ollama docs, tool results use 'role': 'tool' and 'content'.
                        // The `tool_call_id` is implicitly associated by order or context in some models,
                        // but explicitly adding it might be needed for others or future versions.
                        // Let's include it if present, but be aware it might not be standard yet.
                        cleanMsg.tool_call_id = msg.tool_call_id;
                    }
                    // Remove our internal 'name' field before sending
                    if ('name' in cleanMsg)
                        delete cleanMsg.name;
                    return cleanMsg;
                });
                console.log(`Round ${round + 1}: Sending ${messagesForOllama.length} messages to Ollama`);
                const ollamaResponse = await ollama_1.default.chat({
                    model: this._currentModel,
                    messages: messagesForOllama,
                    tools: tools_1.availableTools,
                    stream: false,
                });
                // Handle potential non-message response (e.g., error structure)
                if (!ollamaResponse || !ollamaResponse.message) {
                    throw new Error("Received invalid response structure from Ollama");
                }
                const assistantMessageFromOllama = ollamaResponse.message;
                assistantMessageFromOllama.content = assistantMessageFromOllama.content || ""; // Ensure content is string
                // Add assistant's response (text and/or tool_calls) to the internal history
                this._conversationHistory.push(assistantMessageFromOllama);
                currentMessages = JSON.parse(JSON.stringify(this._conversationHistory)); // Update internal messages state
                // Update webview ONLY with displayable messages (user/assistant)
                this._view.webview.postMessage({ command: "loadConversation", messages: this._conversationHistory });
                // Check if the message contains tool calls
                const toolCalls = assistantMessageFromOllama.tool_calls;
                if (toolCalls && toolCalls.length > 0) {
                    console.log("Tool calls requested:", JSON.stringify(toolCalls, null, 2));
                    const toolResultMessages = [];
                    // Use for...of with index to generate fallback IDs if needed
                    for (let i = 0; i < toolCalls.length; i++) {
                        const toolCall = toolCalls[i];
                        const toolName = toolCall.function.name;
                        let toolArgs = toolCall.function.arguments;
                        let toolCallId = toolCall.id;
                        if (!toolCallId) {
                            toolCallId = `${toolName}_${i}_${Date.now()}`; // Generate a unique ID
                            console.warn(`Tool call for '${toolName}' was missing an ID. Generated ID: ${toolCallId}`);
                            // Optionally, inform the model it didn't provide an ID? For now, just proceed.
                            // We need to add the generated ID back to the assistant message in history 
                            // so the model sees it in the next round if it looks back.
                            if (assistantMessageFromOllama.tool_calls) {
                                assistantMessageFromOllama.tool_calls[i].id = toolCallId;
                                // Also update the main history object directly
                                const histMsg = this._conversationHistory[this._conversationHistory.length - 1];
                                if (histMsg.role === 'assistant' && histMsg.tool_calls) {
                                    histMsg.tool_calls[i].id = toolCallId;
                                }
                            }
                        }
                        // Ensure arguments are parsed
                        if (typeof toolArgs === 'string') {
                            try {
                                toolArgs = JSON.parse(toolArgs);
                            }
                            catch (e) {
                                console.error(`Error parsing arguments for tool ${toolName} (ID: ${toolCallId}): ${toolArgs}`, e);
                                toolResultMessages.push({
                                    role: "tool",
                                    tool_call_id: toolCallId,
                                    name: toolName, // Keep name for internal use/logging
                                    content: `Error: Could not parse arguments for tool ${toolName}. Arguments received: ${toolArgs}`,
                                });
                                continue;
                            }
                        }
                        else if (typeof toolArgs !== 'object' || toolArgs === null) {
                            // Handle cases where arguments are not an object or stringified object
                            console.error(`Invalid arguments type for tool ${toolName} (ID: ${toolCallId}): ${typeof toolArgs}`);
                            toolResultMessages.push({
                                role: "tool",
                                tool_call_id: toolCallId,
                                name: toolName,
                                content: `Error: Invalid arguments format received for tool ${toolName}. Expected object or JSON string.`,
                            });
                            continue;
                        }
                        const toolFunction = tools_1.functionsMap[toolName];
                        if (toolFunction) {
                            try {
                                const result = await toolFunction(toolArgs); // Execute the actual tool function
                                console.log(`Tool "${toolName}" (ID: ${toolCallId}) result obtained.`); // Don't log potentially large result
                                toolResultMessages.push({
                                    role: "tool",
                                    tool_call_id: toolCallId,
                                    name: toolName, // Keep name for internal use/logging
                                    content: typeof result === 'string' ? result : JSON.stringify(result), // Result content for LLM
                                });
                            }
                            catch (error) {
                                console.error(`Error executing tool ${toolName} (ID: ${toolCallId}):`, error);
                                toolResultMessages.push({
                                    role: "tool",
                                    tool_call_id: toolCallId,
                                    name: toolName, // Keep name for internal use/logging
                                    content: `Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
                                });
                            }
                        }
                        else {
                            console.warn(`Tool ${toolName} (ID: ${toolCallId}) not found`);
                            toolResultMessages.push({
                                role: "tool",
                                tool_call_id: toolCallId,
                                name: toolName, // Keep name for internal use/logging
                                content: `Error: Tool "${toolName}" not found.`,
                            });
                        }
                    }
                    // Add tool results to internal history ONLY
                    this._conversationHistory.push(...toolResultMessages);
                    currentMessages = JSON.parse(JSON.stringify(this._conversationHistory));
                    // No webview update here - tool results are hidden, loop continues
                }
                else {
                    // No tool calls in this response, this is the final answer.
                    finalAssistantMessageContent = (0, removeThink_1.default)(assistantMessageFromOllama.content);
                    // Make sure the final message in history has the cleaned content
                    const lastAssistantMsg = this._conversationHistory[this._conversationHistory.length - 1];
                    if (lastAssistantMsg.role === 'assistant') {
                        lastAssistantMsg.content = finalAssistantMessageContent;
                    }
                    finalAssistantMessageProcessed = true;
                    console.log("Finished processing prompt (final response from non-streaming call) from: " + this._currentModel);
                    break; // Exit the tool call loop
                }
            }
            // If loop finished without a definitive final answer (e.g., max rounds reached)
            if (!finalAssistantMessageProcessed) {
                console.warn("Max tool rounds reached or loop exited unexpectedly. Attempting final streaming call.");
                // Add a placeholder for the final streamed response to internal history
                this._conversationHistory.push({ role: "assistant", content: "" });
                const finalAssistantMessageIdx = this._conversationHistory.length - 1;
                // Update webview to show the new (empty) assistant message placeholder
                this._view.webview.postMessage({ command: "loadConversation", messages: this._conversationHistory });
                // Prepare messages for the final streaming call (without tools capability)
                const messagesForStreaming = currentMessages.map(msg => {
                    const cleanMsg = { role: msg.role, content: msg.content || "" };
                    // Include tool_calls for the *last* assistant message *that requested tools* if relevant for context
                    // It's usually better to let the model infer from the tool results, but let's find the last actual request.
                    let lastToolRequestingMsg;
                    for (let i = currentMessages.length - 1; i >= 0; i--) {
                        if (currentMessages[i].role === 'assistant' && currentMessages[i].tool_calls) {
                            lastToolRequestingMsg = currentMessages[i];
                            break;
                        }
                    }
                    if (msg === lastToolRequestingMsg) {
                        cleanMsg.tool_calls = msg.tool_calls;
                    }
                    if (msg.role === 'tool' && msg.tool_call_id) {
                        cleanMsg.tool_call_id = msg.tool_call_id;
                    }
                    if ('name' in cleanMsg)
                        delete cleanMsg.name;
                    return cleanMsg;
                });
                console.log(`Final Streaming Call: Sending ${messagesForStreaming.length} messages to Ollama`);
                const finalStream = await ollama_1.default.chat({
                    model: this._currentModel,
                    messages: messagesForStreaming,
                    stream: true,
                    // NO 'tools' parameter here
                });
                let streamedText = "";
                for await (const part of finalStream) {
                    if (part.message.content) {
                        streamedText += part.message.content;
                        // Update the content of the placeholder message in the internal history
                        this._conversationHistory[finalAssistantMessageIdx].content = (0, removeThink_1.default)(streamedText);
                        // Send only the updated text to the webview for the last message
                        this._view?.webview.postMessage({
                            command: "chatResponse",
                            text: this._conversationHistory[finalAssistantMessageIdx].content,
                        });
                    }
                }
                finalAssistantMessageContent = this._conversationHistory[finalAssistantMessageIdx].content; // Already cleaned
                finalAssistantMessageProcessed = true;
                console.log("Finished streaming final response from: " + this._currentModel);
            }
            // Restore the original short user prompt in the internal history (user message before last assistant response)
            const lastUserMessageIndex = this._conversationHistory.map(m => m.role).lastIndexOf("user");
            if (lastUserMessageIndex !== -1 && this._conversationHistory[lastUserMessageIndex].content === fullPrompt) {
                this._conversationHistory[lastUserMessageIndex].content = userPrompt;
            }
            // Send the final state (filtered) to the webview to mark completion
            this._view.webview.postMessage({
                command: "chatCompletion",
                text: finalAssistantMessageContent, // Send the final text content
                messages: this._conversationHistory, // Send final filtered history
            });
        }
        catch (error) {
            console.error("Error in _handleUserPrompt or Ollama call:", error);
            let errorMessage = "An error occurred while processing your request.";
            if (error instanceof Error) {
                errorMessage = `Error: ${error.message}`;
            }
            else if (typeof error === 'string') {
                errorMessage = error;
            }
            else if (error && typeof error.response?.data === 'string') { // Check for specific Ollama error format
                const ollamaError = error.response.data;
                if (ollamaError.includes('invalid tool_call format')) {
                    errorMessage = `Ollama Error: The model provided an invalid tool call format. Please check the model's capabilities or the tool definitions. Details: ${ollamaError}`;
                    console.error("Invalid tool call format detected:", ollamaError);
                }
                else if (ollamaError.includes('unknown function')) {
                    errorMessage = `Ollama Error: The model tried to call an unknown function. Details: ${ollamaError}`;
                    console.error("Unknown function call detected:", ollamaError);
                }
                else {
                    errorMessage = `Ollama Error: ${ollamaError}`;
                }
            }
            else if (error && typeof error.message === 'string') {
                errorMessage = `Ollama Error: ${error.message}`;
            }
            else {
                try {
                    errorMessage = `Error: ${JSON.stringify(error)}`;
                }
                catch {
                    errorMessage = "An unknown error occurred.";
                }
            }
            // Add or update an assistant error message in the internal history
            let lastMessage = this._conversationHistory.length > 0 ? this._conversationHistory[this._conversationHistory.length - 1] : null;
            if (lastMessage && lastMessage.role === "assistant" && (lastMessage.content === "" || lastMessage.content.startsWith("Thinking")) && !lastMessage.tool_calls) {
                // Update the placeholder message with the error
                lastMessage.content = errorMessage;
            }
            else {
                // Avoid adding duplicate error messages if the last one was already an error.
                if (!(lastMessage && lastMessage.role === "assistant" && lastMessage.content.startsWith("Error:"))) {
                    this._conversationHistory.push({ role: "assistant", content: errorMessage });
                }
            }
            // Send the error state (filtered) to the webview
            this._view?.webview.postMessage({
                command: "chatCompletion",
                text: errorMessage, // Ensure the error text is sent
                messages: this._conversationHistory,
            });
            vscode.window.showErrorMessage("LoCopilot error: " + (error instanceof Error ? error.message : String(error)));
        }
    }
}
exports.default = LoCopilotViewProvider;
//# sourceMappingURL=LoCopilotProvider.js.map