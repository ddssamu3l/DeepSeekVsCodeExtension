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
exports.getTools = getTools;
exports.handleToolCalls = handleToolCalls;
const vscode = __importStar(require("vscode"));
function getTools() {
    return [
        {
            type: 'function',
            function: {
                name: 'get_user_selected_text',
                description: "Get the text that is selected by the user's mouse. Can be used to fill in missing context.",
                parameters: {
                    type: 'object',
                    required: [],
                    properties: {},
                },
            },
        },
    ];
}
function handleToolCalls(tool_call) {
    const response = {
        role: "user_tool_call_response",
        content: "",
    };
    if (tool_call.function.name === "get_user_selected_text") {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;
            if (selection.isEmpty) {
                console.log("Cursor only — no text is selected.");
            }
            else {
                const selectedText = editor.document.getText(selection);
                response.content = "Tool call response for get_user_selected_text: " + selectedText;
            }
        }
    }
    return response;
}
//# sourceMappingURL=tools.js.map