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
const webviewContent_1 = __importDefault(require("../webviewContent"));
const tools_1 = require("../tools/tools");
// A class that provides the webview for the sidebar
class DeepSeekViewProvider {
    _extensionUri;
    _view;
    _conversationHistory;
    _currentModel;
    _tools;
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
        this._conversationHistory = [
            {
                role: "system",
                content: "You are an AI Coding agent. You will help the user with code related tasks. If the user asks you a question that isn't code related, tell the user that you are just a coding AI assistant. The conversation between you and the user will be stored in a conversation history, so you will have context of all messages send between you and the user. You also have the ability to call tools. Your tool call request and the tool call's response will also be stored in the conversation history. The conversation history is stored as an array of 'Message' objects. There are 4 types of roles in the conversation history, as indicated by the 'role' field in each 'Message' boject. A 'Message' object where the 'role' field is equal to 'assistant' means that its a message sent from you. A 'Message' object where the 'role' field is equal to 'user' means that the message's content is sent from the user. A 'Message' object where the 'role' field is equal to 'assistant_tool_call_request' is a tool call request made by you. A 'Message' object where the 'role' field is equal to 'user_tool_call_response' represents a response from a tool to a tool call request that you made previously. Be sure to read the tool call responses."
            },
        ];
        this._currentModel = "qwq";
        this._tools = (0, tools_1.getTools)();
    }
    // Called by VS Code when the view should be displayed
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
                    console.log("DeepSeek model set to: " + message.modelName);
                    this._currentModel = message.modelName;
                }
            });
        }
        catch (error) {
            console.error("Error initializing webview:", error);
            vscode.window.showErrorMessage(`DeepSeek webview initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // Update the webview content
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
            vscode.window.showErrorMessage(`DeepSeek failed to render content: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // Clear the conversation history
    _clearConversation() {
        // clear all messages except for the system prompt
        this._conversationHistory.length = 1;
        console.log("Chat history cleared");
    }
    // Check if a model is installed with Ollama
    async _checkModelInstalled(modelName) {
        if (!this._view) {
            console.error("Cannot check model - view is undefined");
            return;
        }
        try {
            try {
                // Try to get the model info - if it succeeds, the model is installed
                await ollama_1.default.show({ model: modelName });
                // If successful, the model is installed
                this._view.webview.postMessage({
                    command: "modelInstalledResult",
                    isInstalled: true
                });
                return true;
            }
            catch (error) {
                // If there's an error, the model is not installed
                console.log(`Model ${modelName} is not installed`);
                this._view.webview.postMessage({
                    command: "modelInstalledResult",
                    isInstalled: false
                });
                return false;
            }
        }
        catch (error) {
            console.error("Error checking model status:", error);
            this._view.webview.postMessage({
                command: "modelInstalledResult",
                isInstalled: false
            });
            return false;
        }
    }
    // Handle user prompts sent from the webview
    async _handleUserPrompt(userPrompt) {
        if (!this._view) {
            console.error("Cannot handle prompt - view is undefined");
            return;
        }
        let responseText = "";
        console.log("Received user prompt: " + userPrompt);
        try {
            // Add user message to conversation history
            this._conversationHistory.push({ role: "user", content: userPrompt });
            // push a new assistance response to the conversation history, with a placeholder of "" since the resopsne has yet to come in
            this._conversationHistory.push({
                role: "assistant",
                content: "",
            });
            // For immediate feedback while Ollama loads
            this._view.webview.postMessage({
                command: "chatResponse",
                text: "Processing your request...",
                messages: this._conversationHistory,
            });
            try {
                let responseText = "";
                let toolCallProcessed = false;
                do {
                    // Send the current conversation history to Ollama
                    const responseStream = await ollama_1.default.chat({
                        model: this._currentModel,
                        messages: this._conversationHistory,
                        tools: this._tools,
                        stream: true,
                    });
                    toolCallProcessed = false;
                    for await (const part of responseStream) {
                        // If a tool call is detected (content is empty and tool_calls exist)
                        if (part.message.tool_calls && part.message.content === "") {
                            console.log("Ollama responded with a tool call request: ", JSON.stringify(part.message.tool_calls));
                            // Remove the assistant placeholder that triggered the tool call
                            this._conversationHistory.pop();
                            const internalToolCallMsg = {
                                role: "assistant_tool_call_request",
                                content: "",
                                tool_calls: part.message.tool_calls,
                            };
                            // Process each tool call to get its response(s)
                            const toolCallResponses = part.message.tool_calls.map(tool_call => (0, tools_1.handleToolCalls)(tool_call));
                            console.log("Tool call responses: " + JSON.stringify(toolCallResponses));
                            // Append the internal record, the responses, and add a new assistant placeholder
                            this._conversationHistory.push(internalToolCallMsg, ...toolCallResponses, { role: "assistant", content: "" });
                            console.log("Updated conversation history: " + JSON.stringify(this._conversationHistory));
                            // Mark that we processed a tool call so we loop again
                            toolCallProcessed = true;
                            break;
                        }
                        else {
                            // Otherwise, accumulate streamed text and update the last assistant message
                            responseText += part.message.content;
                            const lastIndex = this._conversationHistory.length - 1;
                            this._conversationHistory[lastIndex].content = responseText;
                            if (this._view) {
                                this._view.webview.postMessage({
                                    command: "chatResponse",
                                    text: responseText,
                                    messages: this._conversationHistory,
                                });
                            }
                        }
                    }
                } while (toolCallProcessed);
                console.log("Finished streaming response from Ollama");
                // Set the status as completed
                this._view.webview.postMessage({
                    command: "chatCompletion",
                    messages: this._conversationHistory,
                });
            }
            catch (ollamaError) {
                // If we can't connect to Ollama, send an error response
                console.error("Error with Ollama:", ollamaError);
                if (this._view) {
                    const errorMessage = "Error connecting to Ollama: " +
                        (ollamaError instanceof Error
                            ? ollamaError.message
                            : String(ollamaError));
                    // Add error message to conversation history
                    this._conversationHistory.push({
                        role: "assistant",
                        content: errorMessage,
                    });
                    this._view.webview.postMessage({
                        command: "chatResponse",
                        text: errorMessage,
                        messages: this._conversationHistory,
                    });
                }
                // Re-throw for outer catch
                throw ollamaError;
            }
        }
        catch (error) {
            console.error("Error in handleUserPrompt:", error);
            if (this._view) {
                const errorMessage = "Error: " +
                    (error instanceof Error ? error.message : String(error));
                this._view.webview.postMessage({
                    command: "chatResponse",
                    text: errorMessage
                });
            }
            vscode.window.showErrorMessage("DeepSeek error: " +
                (error instanceof Error ? error.message : String(error)));
        }
    }
}
exports.default = DeepSeekViewProvider;
//# sourceMappingURL=DeepSeekProvider.js.map