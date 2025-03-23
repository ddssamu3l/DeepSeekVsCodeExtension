import * as vscode from 'vscode';
import type { Message, Tool, ToolCall } from 'ollama';

export function getTools(): Tool[] {
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

export function handleToolCalls(tool_call: ToolCall ): Message{
  const response = {
    role: "user_tool_call_response",
    content: "",
  };

  if(tool_call.function.name === "get_user_selected_text"){
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const selection = editor.selection;

      if (selection.isEmpty) {
        console.log("Cursor only — no text is selected.");
      } else {
        const selectedText = editor.document.getText(selection);
        response.content = "Tool call response for get_user_selected_text: " + selectedText;
      }
    }
  }

  return response;
}

