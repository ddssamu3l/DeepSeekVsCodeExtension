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
exports.LoCopilotCompletionProvider = void 0;
const vscode = __importStar(require("vscode"));
const ollama_1 = __importDefault(require("ollama")); // Assuming ollama is already a dependency
const editorUtils_1 = require("../utils/editorUtils"); // Import the new context utility
// TODO: Import or define necessary types for Ollama responses and configuration
class LoCopilotCompletionProvider {
    isEnabled = true;
    completionModel = 'qwen3:8b';
    completionDebounceDelay = 500;
    debounceTimer;
    lastRequestTime = 0;
    // private readonly debounceDelay: number = 500; // Will be replaced by completionDebounceDelay
    configurationChangeListener;
    constructor() {
        this.loadConfiguration();
        this.configurationChangeListener = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('loCopilot.completion')) {
                this.loadConfiguration();
            }
        });
    }
    loadConfiguration() {
        const config = vscode.workspace.getConfiguration('loCopilot.completion');
        this.isEnabled = config.get('enabled', true);
        this.completionModel = config.get('modelName', 'qwen3:8b');
        this.completionDebounceDelay = config.get('debounceDelay', 500);
        console.log(`LoCopilotCompletionProvider configuration loaded: enabled=${this.isEnabled}, model=${this.completionModel}, debounce=${this.completionDebounceDelay}`);
    }
    async provideCompletionItems(document, position, token, context) {
        if (!this.isEnabled) {
            console.log('LoCopilotCompletionProvider is disabled via configuration.');
            return undefined;
        }
        console.log('LoCopilotCompletionProvider.provideCompletionItems triggered');
        const { prefix, suffix, precedingLines, followingLines } = (0, editorUtils_1.getCompletionContext)(document, position);
        if (context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter && !prefix.trim()) {
            console.log("Skipping completion: empty prefix on trigger character.");
            return undefined;
        }
        if (context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter && prefix.endsWith(' ')) {
            console.log("Skipping completion: ends with space on trigger character.");
            return undefined;
        }
        if (prefix.length < 2 && context.triggerKind !== vscode.CompletionTriggerKind.Invoke) {
            console.log("Skipping completion: prefix too short.");
            return undefined;
        }
        const completionUserPrompt = this.constructCompletionPrompt(prefix, suffix, precedingLines, followingLines);
        return new Promise((resolve) => {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }
            this.debounceTimer = setTimeout(async () => {
                if (token.isCancellationRequested) {
                    console.log("Ollama request cancelled before sending due to token.");
                    return resolve(undefined);
                }
                this.lastRequestTime = Date.now();
                return vscode.window.withProgress({
                    location: vscode.ProgressLocation.Window,
                    title: "LoCopilot: Thinking...",
                    cancellable: false // We use the CancellationToken from provideCompletionItems
                }, async (progress) => {
                    try {
                        console.log(`Requesting completion from Ollama model: ${this.completionModel}`);
                        const ollamaRequestParams = {
                            model: this.completionModel, // Use configured model
                            prompt: completionUserPrompt,
                            stream: false,
                            raw: true,
                            options: {
                            // num_predict: 25, 
                            // temperature: 0.2,
                            // stop: ["\n", "\t", ";", "(", "{", ".", "="] // Adjust stop tokens as needed
                            }
                        };
                        if (token.isCancellationRequested) {
                            console.log("Ollama request cancelled by VS Code token before API call execution.");
                            return resolve(undefined);
                        }
                        const ollamaResponse = await ollama_1.default.generate(ollamaRequestParams);
                        if (token.isCancellationRequested) {
                            console.log("Ollama request cancelled by VS Code token during/after API call.");
                            return resolve(undefined);
                        }
                        if (ollamaResponse && ollamaResponse.response) {
                            const rawCompletion = ollamaResponse.response;
                            console.log("Raw completion from Ollama:", rawCompletion);
                            let cleanedCompletion = rawCompletion.trim();
                            // Basic cleaning: if the model prepends the prompt, remove it.
                            // This is a simple heuristic and might need refinement.
                            if (cleanedCompletion.startsWith(completionUserPrompt) && completionUserPrompt.length > 0) {
                                cleanedCompletion = cleanedCompletion.substring(completionUserPrompt.length).trimStart();
                            }
                            // Remove common markdown code block fences if the model doesn't respect "code only"
                            cleanedCompletion = cleanedCompletion.replace(/^```[a-zA-Z]*\s*\n?/, '').replace(/\n?```$/, '').trim();
                            if (cleanedCompletion) {
                                const item = new vscode.CompletionItem(cleanedCompletion, vscode.CompletionItemKind.Snippet);
                                // Define the range to be replaced
                                const startPosition = new vscode.Position(position.line, position.character - prefix.length);
                                const endPosition = position;
                                item.range = new vscode.Range(startPosition, endPosition);
                                item.insertText = cleanedCompletion;
                                item.sortText = `000-${cleanedCompletion}`;
                                item.preselect = true;
                                item.detail = "LoCopilot (Ollama)";
                                item.documentation = new vscode.MarkdownString(`**LoCopilot (Ollama)** suggests:\n\n\`\`\`\n${cleanedCompletion}\n\`\`\``);
                                return resolve([item]);
                            }
                            else {
                                console.log("Ollama returned an effectively empty completion after cleaning.");
                                return resolve(undefined);
                            }
                        }
                        else {
                            console.warn("Ollama response was empty or not in expected format.", ollamaResponse);
                            return resolve(undefined);
                        }
                    }
                    catch (error) {
                        if (token.isCancellationRequested) {
                            console.log("Ollama request failed but was cancelled by token.", error.message);
                            return resolve(undefined);
                        }
                        console.error("Error calling Ollama for completion:", error.message);
                        // Create an error completion item
                        const errorItem = new vscode.CompletionItem("LoCopilot: Error fetching suggestion", vscode.CompletionItemKind.Text);
                        errorItem.insertText = ""; // Don't insert anything on accept
                        errorItem.detail = "Ollama API Error";
                        errorItem.documentation = new vscode.MarkdownString(`An error occurred while fetching suggestions from Ollama:\n\n\`\`\`\n${error.message || 'Unknown error'}\n\`\`\``);
                        errorItem.sortText = "zzz_error"; // Ensure it sorts last if other items were somehow present
                        errorItem.preselect = false;
                        return resolve([errorItem]);
                    }
                });
            }, this.completionDebounceDelay); // Use configured debounce delay
        });
    }
    constructCompletionPrompt(prefix, suffix, precedingLines, followingLines) {
        let fullContextForPrompt = precedingLines.join('\n');
        if (precedingLines.length > 0) {
            fullContextForPrompt += '\n';
        }
        fullContextForPrompt += prefix;
        if (!fullContextForPrompt.trim() && !prefix.trim()) {
            console.warn("Constructing completion prompt for effectively empty context.");
        }
        return fullContextForPrompt;
    }
    // We'll also need a helper to get the system prompt for completions
    getCompletionSystemPrompt() {
        return "You are an AI code completion assistant. Your goal is to provide a single, relevant code completion based on the provided context. Respond ONLY with the code completion itself, without any surrounding text, explanations, or markdown formatting. Do not use any markdown code blocks.";
    }
    // Optional: resolveCompletionItem for adding more details lazily
    // async resolveCompletionItem(item: vscode.CompletionItem, token: vscode.CancellationToken): Promise<vscode.CompletionItem | undefined> {
    //     // TODO: If needed, fetch more details for a selected item (e.g., documentation from Ollama)
    //     return item;
    // }
    dispose() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.configurationChangeListener.dispose();
    }
}
exports.LoCopilotCompletionProvider = LoCopilotCompletionProvider;
//# sourceMappingURL=LoCopilotCompletionProvider.js.map