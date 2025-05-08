"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.availableTools = exports.functionsMap = exports.agent = exports.write = exports.edit = exports.read = exports.grep = exports.glob = void 0;
const glob = async (args) => {
    // Implementation for glob tool
    console.log("Executing glob tool with pattern:", args.pattern);
    return JSON.stringify({ files: ["Not yet implemented"] });
};
exports.glob = glob;
const grep = async (args) => {
    // Implementation for grep tool
    console.log("Executing grep tool with pattern:", args.pattern, "in files matching:", args.filePattern);
    return JSON.stringify({ matches: ["Not yet implemented"] });
};
exports.grep = grep;
const read = async (args) => {
    // Implementation for read tool
    console.log("Executing read tool for file:", args.filePath);
    return JSON.stringify({ content: "File content not yet implemented" });
};
exports.read = read;
const edit = async (args) => {
    // Implementation for edit tool
    console.log("Executing edit tool for file:", args.filePath);
    return JSON.stringify({ status: "Edit not yet implemented" });
};
exports.edit = edit;
const write = async (args) => {
    // Implementation for write tool
    console.log("Executing write tool for file:", args.filePath);
    return JSON.stringify({ status: "Write not yet implemented" });
};
exports.write = write;
const agent = async (args) => {
    // Implementation for agent tool
    console.log("Executing agent tool for task:", args.task);
    return JSON.stringify({ result: "Agent execution not yet implemented" });
};
exports.agent = agent;
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
        name: "glob",
        description: "Finds files based on filename patterns (e.g. **/*.ts or auth/*.py)",
        parameters: { type: "object", properties: { pattern: { type: "string", description: "The glob pattern to search for." } }, required: ["pattern"] },
    },
    {
        name: "grep",
        description: "Searches inside files for code/content matching a pattern",
        parameters: { type: "object", properties: { pattern: { type: "string", description: "The regex pattern to search for." }, filePattern: { type: "string", description: "Optional glob pattern to filter files to search within." } }, required: ["pattern"] },
    },
    {
        name: "read",
        description: "Loads file content (fully or partially) to include in context",
        parameters: { type: "object", properties: { filePath: { type: "string", description: "The path to the file to read." }, startLine: { type: "number", description: "Optional start line number." }, endLine: { type: "number", description: "Optional end line number." } }, required: ["filePath"] },
    },
    {
        name: "edit",
        description: "Modifies a specific file based on AI-generated changes",
        parameters: { type: "object", properties: { filePath: { type: "string", description: "The path to the file to edit." }, changes: { type: "string", description: "The changes to apply, describe the edits clearly." } }, required: ["filePath", "changes"] },
    },
    {
        name: "write",
        description: "Creates new files or overwrites existing ones with new code",
        parameters: { type: "object", properties: { filePath: { type: "string", description: "The path to the file to write." }, content: { type: "string", description: "The content to write to the file." }, overwrite: { type: "boolean", description: "Whether to overwrite the file if it already exists. Defaults to false." } }, required: ["filePath", "content"] },
    },
    {
        name: "agent",
        description: "Plans and executes multi-step actions (e.g., search → read → write)",
        parameters: { type: "object", properties: { task: { type: "string", description: "A detailed description of the multi-step task to perform." } }, required: ["task"] },
    }
];
//# sourceMappingURL=tools.js.map