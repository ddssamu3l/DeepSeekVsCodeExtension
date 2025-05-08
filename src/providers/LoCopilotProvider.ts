import * as vscode from "vscode";
import ollama from "ollama";

import getFileContext from "../utils/editorUtils";
import removeThink from "../utils/removeThink";
import getWebviewContent from "../webviewContent";
import { functionsMap, availableTools, ToolCall as LocalToolCall } from "../utils/tools";

// Interface for tool calls as expected/returned by Ollama
interface OllamaToolCall {
  id: string; // ID provided by Ollama for the tool call
  type: 'function';
  function: {
    name: string;
    arguments: Record<string, any> | string; // Arguments can be an object or a stringified JSON
  };
}

/**
 * Interface representing a message in the conversation.
 * @interface Message
 */
interface Message {
  /** The role of the message sender */
  role: "user" | "assistant" | "system" | "tool";
  /** The content of the message */
  content: string;
  /** Optional array of tool calls made by the assistant */
  tool_calls?: OllamaToolCall[];
  /** Optional ID of the tool call, present if role is 'tool' */
  tool_call_id?: string;
  /** Optional name of the tool, present if role is 'tool' */
  name?: string;
}

/**
 * Provider class for the LoCopilot VS Code extension.
 * Handles the webview, conversation history, and communication with Ollama.
 * @implements {vscode.WebviewViewProvider}
 */
export default class LoCopilotViewProvider implements vscode.WebviewViewProvider {
  /** The current webview instance */
  private _view?: vscode.WebviewView;
  /** History of messages in the current conversation */
  private _conversationHistory: Message[];
  /** The current Ollama model being used */
  private _currentModel: string;
  /** Reference to the active text editor */
  private _editor: vscode.TextEditor | undefined;

  /**
   * Creates a new instance of LoCopilotViewProvider.
   * @param {vscode.Uri} _extensionUri - The URI of the extension directory
   */
  constructor(private readonly _extensionUri: vscode.Uri) {
    const toolDescriptionsForSystemPrompt = availableTools.map(t => ({
        type: t.type,
        function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters
        }
    }));

    const systemPrompt = `You are an AI Coding agent. CRITICAL: Assume every question the user asks is related to the current codebase that the user is looking at. 
    
    You will help your user with code related tasks.
The user's prompts may include selected text or current file content for context. Use this information if relevant.
You have access to a set of tools to gather information about the user's codebase or perform actions. You have the ability to call multiple tools sequentially, or multiple tools at once if needed.
When you decide to use a tool, your response MUST be a JSON object containing a "tool_calls" array.
Each object in the "tool_calls" array must have a "type" field set to "function", and a "function" field.
The "function" field must be an object with a "name" (the tool's name) and "arguments" (an object of parameters).
You MUST also provide a unique "id" for each tool call (e.g., "call_123", "call_abc", etc.). This ID will be used to match the tool's output back to your request.

Example of a tool call response:
{
  "role": "assistant",
  "content": "Okay, I need to find some files first.",
  "tool_calls": [
    {
      "id": "call_xyz_1",
      "type": "function",
      "function": {
        "name": "glob",
        "arguments": {"pattern": "*.ts"}
      }
    }
  ]
}

After you provide tool calls, I will execute them and return the results in "tool" role messages, each with a "tool_call_id" matching your request and "content" holding the tool's output (as a JSON string).
You can then use these results to make further decisions, call more tools, or generate your final answer to the user.
If you need to call multiple tools sequentially (e.g., find files, then read one), make one set of tool calls, wait for the results, then make the next set of tool calls.
When you have all the information you need and are ready to provide the final answer to the user, respond with your answer in the "content" field and DO NOT include a "tool_calls" field.

IMPORTANT: If you are unable to gather the information needed to answer the user's question, respond with a message telling the user that you are unable to answer their question, asking them to specify which files contain the information you need in order to answer their question.

Available tools:
${JSON.stringify(toolDescriptionsForSystemPrompt, null, 2)}`;

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
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
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
      this._view.webview.onDidReceiveMessage(async (message: any) => {
        if (message.command === "userPrompt") {
          await this._handleUserPrompt(message.text);
        } else if (message.command === "clearConversation") {
          this._clearConversation();
        } else if (message.command === "debug") {
          // Allow webview to send debug messages
          console.log("DEBUG from webview:", message.text);
        } else if (message.command === "checkModelInstalled") {
          await this._checkModelInstalled(message.modelName);
        } else if (message.command === "setModel") {
          console.log("LoCopilot model set to: " + message.modelName);
          this._currentModel = message.modelName;
        }
      });
    } catch (error) {
      console.error("Error initializing webview:", error);
      vscode.window.showErrorMessage(
        `LoCopilot webview initialization failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Updates the HTML content of the webview and initializes it with the conversation history.
   * @private
   */
  private _updateWebview() {
    if (!this._view) {
      console.error("Cannot update webview - view is undefined");
      return;
    }

    try {
      const htmlContent = getWebviewContent();
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
    } catch (error) {
      console.error("Error setting webview HTML:", error);
      vscode.window.showErrorMessage(
        `LoCopilot failed to render content: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Clears the conversation history, keeping only the system prompt.
   * @private
   */
  private _clearConversation() {
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
  private async _checkModelInstalled(modelName: string): Promise<boolean> {
    if (!this._view) {
      console.error("Cannot check model - view is undefined");
      return false;
    }
    
    try {
      await ollama.show({ model: modelName });
      this._view.webview.postMessage({
        command: "modelInstalledResult",
        isInstalled: true
      });
      return true;
    } catch (error) {
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
  private _buildNewChatResponse(fullPrompt: string) {
    this._conversationHistory.push({ role: "user", content: fullPrompt });
  }

  /**
   * Builds the complete prompt that will be sent to Ollama with all relevant context.
   * @private
   * @param {string} userPrompt - The text prompt that the user entered
   * @returns {string} The complete prompt with user input, selected text, and file content
   */
  private _buildFullPrompt(userPrompt: string): string {
    const { fileContent, selectedText } = getFileContext();

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
  private async _handleUserPrompt(userPrompt: string) {
    if (!this._view) {
      console.error("Cannot handle prompt - view is undefined");
      return;
    }

    console.log("Received user prompt: " + userPrompt);
    const fullPrompt = this._buildFullPrompt(userPrompt);

    this._conversationHistory.push({ role: "user", content: fullPrompt });
    this._view.webview.postMessage({ command: "loadConversation", messages: this._conversationHistory });

    let currentMessages: Message[] = JSON.parse(JSON.stringify(this._conversationHistory));
    const maxToolRounds = 5; 
    let finalAssistantMessageContent = "";
    let finalAssistantMessageProcessed = false;

    try {
      for (let round = 0; round < maxToolRounds; round++) {
        // Ensure content is string and clean up messages for Ollama
        const messagesForOllama = currentMessages.map(msg => ({
          ...msg,
          content: msg.content === null || msg.content === undefined ? "" : msg.content,
          // Ollama expects tool_calls only on assistant messages if they are making calls
          // and tool_call_id only on tool messages.
          tool_calls: msg.role === 'assistant' ? msg.tool_calls : undefined,
          tool_call_id: msg.role === 'tool' ? msg.tool_call_id : undefined,
          name: msg.role === 'tool' ? msg.name : undefined, // Only for tool role
        }));

        console.log(`Round ${round + 1}: Sending to Ollama`);

        const ollamaResponse = await ollama.chat({
          model: this._currentModel,
          messages: messagesForOllama as any, // Cast needed due to ollama library's specific Message type
          tools: availableTools,
          stream: false, 
        });

        const assistantMessageFromOllama = ollamaResponse.message as Message;
        assistantMessageFromOllama.content = assistantMessageFromOllama.content || ""; 
        
        // Add assistant's response (text and/or tool_calls) to the true history
        this._conversationHistory.push(assistantMessageFromOllama);
        currentMessages = JSON.parse(JSON.stringify(this._conversationHistory)); // Update currentMessages for the next loop
        this._view.webview.postMessage({ command: "loadConversation", messages: this._conversationHistory });

        if (assistantMessageFromOllama.tool_calls && assistantMessageFromOllama.tool_calls.length > 0) {
          console.log("Tool calls requested:", JSON.stringify(assistantMessageFromOllama.tool_calls, null, 2));
          const toolResultMessages: Message[] = [];

          for (const toolCall of assistantMessageFromOllama.tool_calls) {
            const toolName = toolCall.function.name;
            let toolArgs = toolCall.function.arguments;
            const toolCallId = toolCall.id; 

            if (typeof toolArgs === 'string') {
              try {
                toolArgs = JSON.parse(toolArgs);
              } catch (e) {
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

            const toolFunction = functionsMap[toolName];
            if (toolFunction) {
              try {
                const result = await toolFunction(toolArgs);
                console.log(`Tool "${toolName}" result:\n`, result);
                toolResultMessages.push({
                  role: "tool",
                  tool_call_id: toolCallId,
                  name: toolName,
                  content: typeof result === 'string' ? result : JSON.stringify(result),
                });
              } catch (error) {
                console.error(`Error executing tool ${toolName}:`, error);
                toolResultMessages.push({
                  role: "tool",
                  tool_call_id: toolCallId,
                  name: toolName,
                  content: `Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
                });
              }
            } else {
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
          currentMessages = JSON.parse(JSON.stringify(this._conversationHistory));
          this._view.webview.postMessage({ command: "loadConversation", messages: this._conversationHistory });
        } else {
          // No tool calls, this is the final response content from the non-streaming call
          finalAssistantMessageContent = removeThink(assistantMessageFromOllama.content);
          finalAssistantMessageProcessed = true;
          console.log("Finished processing prompt (final response from non-streaming call) from: " + this._currentModel);
          break; // Exit the tool call loop
        }
      }

      if (!finalAssistantMessageProcessed && currentMessages[currentMessages.length - 1].role !== 'assistant') {
        // If maxToolRounds reached or some other unexpected exit from loop without a final assistant message,
        // make one last streaming call to get a coherent textual response.
        console.warn(finalAssistantMessageProcessed ? "Max tool rounds reached, getting final response." : "No tool calls in last round, getting final response via stream.");
        
        // Add a placeholder for the final assistant message
        this._conversationHistory.push({ role: "assistant", content: "" });
        const finalAssistantMessageIdx = this._conversationHistory.length - 1;
        this._view.webview.postMessage({ command: "loadConversation", messages: this._conversationHistory });

        const messagesForStreaming = currentMessages.map(msg => ({ // Use currentMessages which has tool results
            ...msg,
            content: msg.content === null || msg.content === undefined ? "" : msg.content,
            tool_calls: msg.role === 'assistant' ? msg.tool_calls : undefined,
            tool_call_id: msg.role === 'tool' ? msg.tool_call_id : undefined,
            name: msg.role === 'tool' ? msg.name : undefined,
          }));

        const finalStream = await ollama.chat({
          model: this._currentModel,
          messages: messagesForStreaming as any,
          stream: true, 
          // No 'tools' parameter here, we expect a textual answer
        });

        let streamedText = "";
        for await (const part of finalStream) {
          if (part.message.content) {
            streamedText += part.message.content;
            this._conversationHistory[finalAssistantMessageIdx].content = streamedText;
            this._view?.webview.postMessage({
              command: "chatResponse",
              text: streamedText,
              messages: this._conversationHistory,
            });
          }
        }
        finalAssistantMessageContent = removeThink(streamedText);
        this._conversationHistory[finalAssistantMessageIdx].content = finalAssistantMessageContent;
        finalAssistantMessageProcessed = true;
        console.log("Finished streaming final response from: " + this._currentModel);
      } else if (!finalAssistantMessageProcessed && this._conversationHistory.length > 0) {
        // Fallback: if loop ended, but no clear final message, use the last assistant message's content
        const lastMessage = this._conversationHistory[this._conversationHistory.length -1];
        if (lastMessage.role === 'assistant') {
            finalAssistantMessageContent = removeThink(lastMessage.content);
            finalAssistantMessageProcessed = true;
        }
      }

      // Restore the original short user prompt in history
      const lastUserMessageIndex = this._conversationHistory.map(m => m.role).lastIndexOf("user");
      if (lastUserMessageIndex !== -1 && this._conversationHistory[lastUserMessageIndex].content === fullPrompt) {
        this._conversationHistory[lastUserMessageIndex].content = userPrompt;
      }
      
      this._view.webview.postMessage({
        command: "chatCompletion",
        text: finalAssistantMessageContent,
        messages: this._conversationHistory,
      });

    } catch (error) {
      console.error("Error in _handleUserPrompt or Ollama call:", error);
      let errorMessage = "An error occurred while processing your request.";
      if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof (error as any).message === 'string') {
        errorMessage = `Ollama Error: ${(error as any).message}`;
      } else {
        try {
          errorMessage = `Error: ${JSON.stringify(error)}`;
        } catch {
          errorMessage = "An unknown error occurred.";
        }
      }
      
      // Ensure there's an assistant message to display the error, or update the last one
      let lastMessage = this._conversationHistory.length > 0 ? this._conversationHistory[this._conversationHistory.length - 1] : null;
      if (lastMessage && lastMessage.role === "assistant" && (lastMessage.content === "" || lastMessage.content.startsWith("Thinking")) && !lastMessage.tool_calls) {
          lastMessage.content = errorMessage;
      } else {
          this._conversationHistory.push({ role: "assistant", content: errorMessage });
      }

      this._view?.webview.postMessage({
        command: "chatCompletion", 
        text: errorMessage,
        messages: this._conversationHistory,
      });

      vscode.window.showErrorMessage("LoCopilot error: " + (error instanceof Error ? error.message : String(error)));
    }
  }
}
