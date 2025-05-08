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
        const toolDescriptions = tools_1.availableTools.map(t => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters
        }));
        const systemPrompt = `You are an AI Coding agent. You will help your user with code related tasks.
The user's prompts may include selected text or current file content for context. Use this information if relevant.
You can use tools to perform actions. When you decide to use tools, your response must be a JSON object with a "tool_calls" key.
The "tool_calls" value should be an array of objects, where each object has a "type" field set to "function" and a "function" field.
The "function" field should be an object with "name" (the tool name) and "arguments" (an object of parameters).
Example of a tool call response:
{
  "role": "assistant",
  "content": "I will use a tool to find files.",
  "tool_calls": [
    {
      "type": "function",
      "id": "call_123", // The model should generate a unique ID for each call
      "function": {
        "name": "glob",
        "arguments": {"pattern": "*.ts"}
      }
    }
  ]
}
After I execute the tools, I will provide their results in messages with role "tool". Then you can continue processing.

Available tools:
${JSON.stringify(toolDescriptions, null, 2)}`;
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
                        messages: this._conversationHistory
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
        // clear all messages except for the system prompt
        this._conversationHistory.length = 1;
        console.log("Chat history cleared");
        if (this._view) {
            this._view.webview.postMessage({
                command: "loadConversation",
                messages: this._conversationHistory
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
                isInstalled: true
            });
            return true;
        }
        catch (error) {
            console.log(`Model ${modelName} is not installed`);
            this._view.webview.postMessage({
                command: "modelInstalledResult",
                isInstalled: false
            });
            return false;
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
        let fullPrompt = `User prompt: ${userPrompt}`;
        if (selectedText.trim()) {
            fullPrompt += `\nUser selected text:\n${selectedText}`;
        }
        // if (fileContent.trim()) {
        //   fullPrompt += `\nText content of current file:\n${fileContent}`;
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
        // Add user message to history
        this._conversationHistory.push({ role: "user", content: fullPrompt });
        this._view.webview.postMessage({ command: "loadConversation", messages: this._conversationHistory });
        try {
            // Prepare messages for Ollama (send a copy)
            let messagesForOllama = JSON.parse(JSON.stringify(this._conversationHistory));
            // Ensure content is string for all messages being sent
            messagesForOllama.forEach(msg => {
                if (msg.content === null || msg.content === undefined) {
                    msg.content = "";
                }
            });
            // First call to Ollama
            const response = await ollama_1.default.chat({
                model: this._currentModel,
                messages: messagesForOllama, // Use 'as any' if type discrepancies persist with ollama library
                tools: tools_1.availableTools, // availableTools should be in the format [{ type: 'function', function: {...} }]
                stream: false, // Get the full response to check for tool_calls
            });
            let assistantMessageFromOllama = response.message;
            // Ensure content is a string, even if Ollama sends null/undefined
            assistantMessageFromOllama.content = assistantMessageFromOllama.content || "";
            this._conversationHistory.push(assistantMessageFromOllama);
            this._view.webview.postMessage({ command: "loadConversation", messages: this._conversationHistory }); // Update UI with assistant's initial response
            if (assistantMessageFromOllama.tool_calls && assistantMessageFromOllama.tool_calls.length > 0) {
                console.log("Tool calls requested:", JSON.stringify(assistantMessageFromOllama.tool_calls, null, 2));
                // Display initial assistant content if any (e.g., "Okay, I will search for files...")
                if (assistantMessageFromOllama.content) {
                    this._view.webview.postMessage({
                        command: "chatResponse", // Or a more specific command
                        text: assistantMessageFromOllama.content,
                        messages: this._conversationHistory, // Send current history
                    });
                }
                const toolResultMessages = [];
                for (const toolCall of assistantMessageFromOllama.tool_calls) {
                    const toolName = toolCall.function.name;
                    let toolArgs = toolCall.function.arguments;
                    const toolCallId = toolCall.id; // Use the ID from Ollama's response
                    if (typeof toolArgs === 'string') {
                        try {
                            toolArgs = JSON.parse(toolArgs);
                        }
                        catch (e) {
                            console.error(`Error parsing arguments for tool ${toolName}: ${toolArgs}`, e);
                            toolResultMessages.push({
                                role: "tool",
                                tool_call_id: toolCallId,
                                name: toolName,
                                content: `Error: Could not parse arguments for tool ${toolName}. Arguments: ${toolArgs}`,
                            });
                            continue;
                        }
                    }
                    const toolFunction = tools_1.functionsMap[toolName];
                    if (toolFunction) {
                        try {
                            const result = await toolFunction(toolArgs);
                            toolResultMessages.push({
                                role: "tool",
                                tool_call_id: toolCallId,
                                name: toolName, // For our reference
                                content: typeof result === 'string' ? result : JSON.stringify(result),
                            });
                        }
                        catch (error) {
                            console.error(`Error executing tool ${toolName}:`, error);
                            toolResultMessages.push({
                                role: "tool",
                                tool_call_id: toolCallId,
                                name: toolName,
                                content: `Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
                            });
                        }
                    }
                    else {
                        console.warn(`Tool ${toolName} not found`);
                        toolResultMessages.push({
                            role: "tool",
                            tool_call_id: toolCallId,
                            name: toolName,
                            content: `Error: Tool "${toolName}" not found.`,
                        });
                    }
                }
                this._conversationHistory.push(...toolResultMessages);
                this._view.webview.postMessage({ command: "loadConversation", messages: this._conversationHistory });
                // Second call to Ollama with tool results, this time streaming for the final answer
                // Prepare messages again, ensuring content is string
                let messagesForFinalResponse = JSON.parse(JSON.stringify(this._conversationHistory));
                messagesForFinalResponse.forEach(msg => {
                    if (msg.content === null || msg.content === undefined) {
                        msg.content = "";
                    }
                });
                const finalResponseStream = await ollama_1.default.chat({
                    model: this._currentModel,
                    messages: messagesForFinalResponse,
                    stream: true,
                });
                let finalResponseText = "";
                this._conversationHistory.push({ role: "assistant", content: "" }); // Placeholder for the final assistant message
                const finalAssistantMessageIdx = this._conversationHistory.length - 1;
                for await (const part of finalResponseStream) {
                    if (part.message.content) {
                        finalResponseText += part.message.content;
                        this._conversationHistory[finalAssistantMessageIdx].content = finalResponseText;
                        this._view?.webview.postMessage({
                            command: "chatResponse",
                            text: finalResponseText, // Streamed text
                            messages: this._conversationHistory, // To update the last message
                        });
                    }
                }
                this._conversationHistory[finalAssistantMessageIdx].content = (0, removeThink_1.default)(finalResponseText);
            }
            else {
                // No tool calls, the first response is the final answer.
                // The assistantMessageFromOllama is already in history.
                // We just need to ensure its content is cleaned.
                const lastMessage = this._conversationHistory[this._conversationHistory.length - 1];
                if (lastMessage.role === 'assistant') {
                    lastMessage.content = (0, removeThink_1.default)(lastMessage.content);
                }
            }
            // Restore the original short user prompt in history
            const lastUserMessageIndex = this._conversationHistory
                .map(m => m.role)
                .lastIndexOf("user");
            if (lastUserMessageIndex !== -1 && this._conversationHistory[lastUserMessageIndex].content === fullPrompt) {
                this._conversationHistory[lastUserMessageIndex].content = userPrompt;
            }
            console.log("Finished processing prompt from: " + this._currentModel);
            const finalMessageToDisplay = this._conversationHistory[this._conversationHistory.length - 1];
            this._view.webview.postMessage({
                command: "chatCompletion",
                text: finalMessageToDisplay.content,
                messages: this._conversationHistory,
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
            else {
                try {
                    errorMessage = `Error: ${JSON.stringify(error)}`;
                }
                catch {
                    errorMessage = "An unknown error occurred.";
                }
            }
            // Ensure there's an assistant message to display the error
            let lastMessage = this._conversationHistory[this._conversationHistory.length - 1];
            if (lastMessage && lastMessage.role === "assistant" && (lastMessage.content === "" || lastMessage.content === "Thinking...") && !lastMessage.tool_calls) {
                lastMessage.content = errorMessage;
            }
            else {
                this._conversationHistory.push({ role: "assistant", content: errorMessage });
            }
            this._view?.webview.postMessage({
                command: "chatCompletion", // Use chatCompletion to indicate the turn is over
                text: errorMessage,
                messages: this._conversationHistory,
            });
            vscode.window.showErrorMessage("LoCopilot error: " + errorMessage);
        }
    }
}
exports.default = LoCopilotViewProvider;
//# sourceMappingURL=LoCopilotProvider.js.map