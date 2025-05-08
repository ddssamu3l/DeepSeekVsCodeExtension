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
exports.availableTools = exports.functionsMap = exports.write = exports.edit = exports.read = exports.grep = exports.glob = void 0;
const vscode = __importStar(require("vscode"));
const fast_glob_1 = __importDefault(require("fast-glob"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// --- Tool Implementations ---
const getWorkspaceRoot = () => {
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        return vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    console.warn("No workspace folder found. File operations might be relative to an unexpected directory.");
    return undefined;
};
/**
 * Finds files based on filename patterns (e.g. .ts or auth/*.py)
 */
const glob = async (args) => {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        return JSON.stringify({ error: "Workspace root not found. Cannot perform glob search." });
    }
    const patterns = args.pattern.split(",").map(p => p.trim());
    try {
        const files = await (0, fast_glob_1.default)(patterns, {
            cwd: workspaceRoot,
            ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/.vscode/**"],
            absolute: true,
            onlyFiles: true,
            dot: true, // Include hidden files if they match the pattern
        });
        return JSON.stringify({ files });
    }
    catch (error) { // Catching 'any' as fast-glob might throw various errors
        console.error("Error in glob tool:", error);
        return JSON.stringify({ error: `Glob execution failed: ${error.message || String(error)}` });
    }
};
exports.glob = glob;
/**
 * Searches inside files for code/content matching a regex pattern.
 */
const grep = async (args) => {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        return JSON.stringify({ error: "Workspace root not found. Cannot perform grep search." });
    }
    const fileGlob = args.filePattern || "**/*";
    // Escape shell special characters in pattern and fileGlob for security and correctness
    const escapeShellArg = (arg) => `"${arg.replace(/(?=[\"$`!\\])/g, '\\')}"`;
    const escapedPattern = escapeShellArg(args.pattern);
    // Note: ripgrep's globbing is powerful, but we use it carefully here.
    // We'll let rg handle the globbing within the CWD.
    const cmd = `rg --with-filename --line-number --color never -e ${escapedPattern} ${escapeShellArg(fileGlob)}`;
    try {
        console.log(`Executing grep command: ${cmd} in ${workspaceRoot}`);
        const { stdout, stderr } = await execAsync(cmd, { cwd: workspaceRoot });
        if (stderr) {
            console.warn("Grep stderr:", stderr);
        }
        const matches = stdout
            .split(/\r?\n/)
            .filter(line => line.trim().length > 0)
            .map(line => {
            // Ripgrep output format: FILENAME:LINENUMBER:MATCH_TEXT
            // Or just FILENAME if --files-with-matches is used, but we are not using it here.
            // We want to return the full path to the file.
            const parts = line.split(':');
            if (parts.length >= 2) {
                const filePath = path.resolve(workspaceRoot, parts[0]);
                return `${filePath}:${parts.slice(1).join(':')}`;
            }
            return line; // Fallback, though should not happen with --with-filename
        });
        return JSON.stringify({ matches });
    }
    catch (err) {
        const stdout = err.stdout?.toString() || "";
        const stderr = err.stderr?.toString() || "";
        const matches = stdout
            .split(/\r?\n/)
            .filter((line) => line.trim().length > 0)
            .map((line) => {
            const parts = line.split(':');
            if (parts.length >= 2) {
                const filePath = path.resolve(workspaceRoot, parts[0]);
                return `${filePath}:${parts.slice(1).join(':')}`;
            }
            return line;
        });
        if (err.code === 1) { // rg exits with 1 if no matches are found
            return JSON.stringify({ matches: [] }); // No matches is not an error in this context
        }
        console.error("Error in grep tool:", { code: err.code, stdout, stderr, message: err.message });
        return JSON.stringify({ error: `Grep execution failed: ${err.message}`, details: stderr || stdout });
    }
};
exports.grep = grep;
/**
 * Loads file content (fully or partially) to include in context.
 */
const read = async (args) => {
    const workspaceRoot = getWorkspaceRoot();
    const absolutePath = path.isAbsolute(args.filePath) ? args.filePath : workspaceRoot ? path.resolve(workspaceRoot, args.filePath) : path.resolve(args.filePath);
    try {
        if (!await fs.promises.stat(absolutePath).then(s => s.isFile()).catch(() => false)) {
            return JSON.stringify({ error: `File not found or is not a file: ${absolutePath}` });
        }
        const text = await fs.promises.readFile(absolutePath, "utf8");
        const lines = text.split(/\r?\n/);
        const start = Math.max(0, (args.startLine ?? 1) - 1); // 0-indexed start
        const end = args.endLine ? Math.min(args.endLine, lines.length) : lines.length; // endLine is exclusive for slice
        const content = lines.slice(start, end).join("\n");
        return JSON.stringify({ filePath: absolutePath, content });
    }
    catch (error) {
        console.error(`Error reading file ${absolutePath}:`, error);
        return JSON.stringify({ error: `Failed to read file ${args.filePath}: ${error.message}` });
    }
};
exports.read = read;
/**
 * Modifies a specific file based on AI-generated changes.
 */
const edit = async (args) => {
    const workspaceRoot = getWorkspaceRoot();
    const absolutePath = path.isAbsolute(args.filePath) ? args.filePath : workspaceRoot ? path.resolve(workspaceRoot, args.filePath) : path.resolve(args.filePath);
    try {
        if (!await fs.promises.stat(absolutePath).then(s => s.isFile()).catch(() => false)) {
            return JSON.stringify({ error: `File not found for editing: ${absolutePath}` });
        }
        // This is a placeholder. Real implementation needs careful handling of edits.
        // For now, it overwrites. A more robust solution would use vscode.WorkspaceEdit or diff-match-patch.
        await fs.promises.writeFile(absolutePath, args.changes, "utf8");
        return JSON.stringify({ status: `Edit applied to ${absolutePath} (simulated full overwrite)` });
    }
    catch (error) {
        console.error(`Error editing file ${absolutePath}:`, error);
        return JSON.stringify({ error: `Failed to edit file ${args.filePath}: ${error.message}` });
    }
};
exports.edit = edit;
/**
 * Creates new files or overwrites existing ones with new code.
 */
const write = async (args) => {
    const workspaceRoot = getWorkspaceRoot();
    const absolutePath = path.isAbsolute(args.filePath) ? args.filePath : workspaceRoot ? path.resolve(workspaceRoot, args.filePath) : path.resolve(args.filePath);
    const dir = path.dirname(absolutePath);
    try {
        await fs.promises.mkdir(dir, { recursive: true }); // Ensure directory exists
        const flag = args.overwrite ? "w" : "wx"; // 'wx' fails if file exists
        await fs.promises.writeFile(absolutePath, args.content, { encoding: "utf8", flag });
        return JSON.stringify({ status: `File ${absolutePath} written successfully` });
    }
    catch (error) {
        console.error(`Error writing file ${absolutePath}:`, error);
        if (error.code === 'EEXIST') {
            return JSON.stringify({ error: `File ${args.filePath} already exists. Set overwrite to true to replace it.` });
        }
        return JSON.stringify({ error: `Failed to write file ${args.filePath}: ${error.message}` });
    }
};
exports.write = write;
// --- Tool Mappings and Definitions ---
exports.functionsMap = {
    glob: exports.glob,
    grep: exports.grep,
    read: exports.read,
    edit: exports.edit,
    write: exports.write,
    // agent, // Agent tool still commented out based on previous instruction
};
exports.availableTools = [
    {
        type: 'function',
        function: {
            name: "glob",
            description: "Finds files based on filename patterns (e.g. **/*.ts or auth/*.py) within the current workspace. Patterns can be comma-separated. Ignores node_modules, dist, .git, .vscode by default. Returns an array of absolute file paths.",
            parameters: {
                type: "object",
                properties: {
                    pattern: { type: "string", description: "The glob pattern(s) to search for, relative to the workspace root. e.g., '**/*.ts', 'src/**/*.js,test/**/*.spec.ts'" }
                },
                required: ["pattern"]
            },
        }
    },
    {
        type: 'function',
        function: {
            name: "grep",
            description: "Searches inside files for code/content matching a regex pattern within the current workspace. Responds with found lines, their line numbers, and full file paths. File patterns can be used to narrow the search.",
            parameters: {
                type: "object",
                properties: {
                    pattern: { type: "string", description: "The regex pattern to search for." },
                    filePattern: { type: "string", description: "Optional glob pattern to filter files to search within (relative to workspace root), e.g., '*.ts', 'src/**', '**/*.{js,jsx}'. Default is all files ('**/*')." }
                },
                required: ["pattern"]
            },
        }
    },
    {
        type: 'function',
        function: {
            name: "read",
            description: "Loads file content (fully or partially) from the workspace. Specify a file path (can be relative to workspace root or absolute). Optionally, specify start and end line numbers for partial reads.",
            parameters: {
                type: "object",
                properties: {
                    filePath: { type: "string", description: "The path to the file to read (relative to workspace root or absolute)." },
                    startLine: { type: "number", description: "Optional: The 1-indexed line number to start reading from." },
                    endLine: { type: "number", description: "Optional: The 1-indexed line number to end reading at (inclusive)." }
                },
                required: ["filePath"]
            },
        }
    },
    {
        type: 'function',
        function: {
            name: "edit",
            description: "Modifies a specific file in the workspace by replacing its entire content. Provide the file path and the new content. Use with caution.",
            parameters: {
                type: "object",
                properties: {
                    filePath: { type: "string", description: "The path to the file to edit (relative to workspace root or absolute)." },
                    changes: { type: "string", description: "The new full content for the file." }
                },
                required: ["filePath", "changes"]
            },
        }
    },
    {
        type: 'function',
        function: {
            name: "write",
            description: "Creates new files or overwrites existing ones in the workspace. Specify file path and content. Use 'overwrite: true' to replace an existing file, otherwise it will fail if the file exists.",
            parameters: {
                type: "object",
                properties: {
                    filePath: { type: "string", description: "The path to the file to write (relative to workspace root or absolute)." },
                    content: { type: "string", description: "The content to write to the file." },
                    overwrite: { type: "boolean", description: "Whether to overwrite the file if it already exists. Defaults to false." }
                },
                required: ["filePath", "content"]
            },
        }
    },
];
//# sourceMappingURL=tools.js.map