"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.availableTools = exports.functionsMap = exports.agent = exports.write = exports.edit = exports.read = exports.grep = exports.glob = void 0;
// --- Tool Implementations ---
const glob = async (args) => {
    // Placeholder implementation
    console.log("Executing glob tool with pattern:", args.pattern);
    // In a real scenario, you'd use a library like 'glob' or vscode.workspace.findFiles
    // For now, returning a dummy response
    return JSON.stringify({ files: [`file1.ts`, `utils/${args.pattern}`] });
};
exports.glob = glob;
const grep = async (args) => {
    // Placeholder implementation
    console.log("Executing grep tool with pattern:", args.pattern, "in files matching:", args.filePattern);
    return JSON.stringify({ matches: [`Found '${args.pattern}' in some_file.txt`] });
};
exports.grep = grep;
const read = async (args) => {
    // Placeholder implementation
    console.log("Executing read tool for file:", args.filePath, "from", args.startLine, "to", args.endLine);
    return JSON.stringify({ content: `Content of ${args.filePath} (lines ${args.startLine || 'start'}-${args.endLine || 'end'})` });
};
exports.read = read;
const edit = async (args) => {
    // Placeholder implementation
    console.log("Executing edit tool for file:", args.filePath, "with changes:", args.changes);
    return JSON.stringify({ status: "Edit applied successfully (simulated)" });
};
exports.edit = edit;
const write = async (args) => {
    // Placeholder implementation
    console.log("Executing write tool for file:", args.filePath, "overwrite:", args.overwrite);
    return JSON.stringify({ status: `File ${args.filePath} written (simulated)` });
};
exports.write = write;
const agent = async (args) => {
    // Placeholder implementation
    console.log("Executing agent tool for task:", args.task);
    return JSON.stringify({ result: "Agent task processed (simulated)" });
};
exports.agent = agent;
// --- Tool Mappings and Definitions ---
exports.functionsMap = {
    glob: exports.glob,
    grep: exports.grep,
    read: exports.read,
    edit: exports.edit,
    write: exports.write,
    agent: exports.agent,
};
exports.availableTools = [
    {
        type: 'function',
        function: {
            name: "glob",
            description: "Finds files based on filename patterns (e.g. **/*.ts or auth/*.py)",
            parameters: {
                type: "object",
                properties: {
                    pattern: { type: "string", description: "The glob pattern to search for. e.g., '**/*.ts', 'src/**/*.js'" }
                },
                required: ["pattern"]
            },
        }
    },
    {
        type: 'function',
        function: {
            name: "grep",
            description: "Searches inside files for code/content matching a regex pattern. Responds with found lines and their line numbers.",
            parameters: {
                type: "object",
                properties: {
                    pattern: { type: "string", description: "The regex pattern to search for." },
                    filePattern: { type: "string", description: "Optional glob pattern to filter files to search within. e.g., '*.ts', 'src/**'" }
                },
                required: ["pattern"]
            },
        }
    },
    {
        type: 'function',
        function: {
            name: "read",
            description: "Loads file content (fully or partially) to include in context. Specify a file path. Optionally, specify start and end line numbers for partial reads.",
            parameters: {
                type: "object",
                properties: {
                    filePath: { type: "string", description: "The path to the file to read." },
                    startLine: { type: "number", description: "Optional start line number (1-indexed)." },
                    endLine: { type: "number", description: "Optional end line number (inclusive)." }
                },
                required: ["filePath"]
            },
        }
    },
    {
        type: 'function',
        function: {
            name: "edit",
            description: "Modifies a specific file based on AI-generated changes. Provide the file path and a description of changes or new content.",
            parameters: {
                type: "object",
                properties: {
                    filePath: { type: "string", description: "The path to the file to edit." },
                    changes: { type: "string", description: "A detailed description of the changes to apply or the new content sections." }
                },
                required: ["filePath", "changes"]
            },
        }
    },
    {
        type: 'function',
        function: {
            name: "write",
            description: "Creates new files or overwrites existing ones with new code. Specify file path and content. Use 'overwrite: true' to replace an existing file.",
            parameters: {
                type: "object",
                properties: {
                    filePath: { type: "string", description: "The path to the file to write." },
                    content: { type: "string", description: "The content to write to the file." },
                    overwrite: { type: "boolean", description: "Whether to overwrite the file if it already exists. Defaults to false." }
                },
                required: ["filePath", "content"]
            },
        }
    },
    {
        type: 'function',
        function: {
            name: "agent",
            description: "Plans and executes multi-step actions (e.g., search → read → write). Provide a detailed description of the task for the agent to perform.",
            parameters: {
                type: "object",
                properties: {
                    task: { type: "string", description: "A detailed description of the multi-step task to perform." }
                },
                required: ["task"]
            },
        }
    }
];
//# sourceMappingURL=tools.js.map