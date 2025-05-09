import * as vscode from "vscode";
import fg from "fast-glob";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { spawn } from 'child_process';

const execAsync = promisify(exec);

/**
 * Interface for defining the structure of arguments for a tool function.
 */
export interface ToolArguments {
  [key: string]: any;
}

/**
 * Interface for a tool call object, typically from an AI model.
 */
export interface ToolCall {
  name: string;
  arguments: ToolArguments;
  id?: string; // Optional ID for the tool call
}

/**
 * Interface for the JSON schema definition of a tool's parameters.
 */
export interface ToolParameters {
  type: "object";
  properties: Record<string, { type: string; description: string; enum?: string[] }>;
  required: string[];
}

/**
 * Interface for defining a tool for Ollama API.
 */
export interface OllamaApiTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameters;
  };
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>; // Define more specific parameter types as needed
}

// --- Tool Implementations ---

const getWorkspaceRoot = (): string | undefined => {
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
  }
  console.warn("No workspace folder found. File operations might be relative to an unexpected directory.");
  return undefined;
};

/**
 * Finds files based on filename patterns (e.g. .ts or auth/*.py)
 */
export const glob = async (args: { pattern: string }): Promise<string> => {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    return JSON.stringify({ error: "Workspace root not found. Cannot perform glob search." });
  }
  const patterns = args.pattern.split(",").map(p => p.trim());
  try {
    const files = await fg(patterns, {
      cwd: workspaceRoot,
      ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/.vscode/**"],
      absolute: true,
      onlyFiles: true,
      dot: true, // Include hidden files if they match the pattern
    });
    return JSON.stringify({ files });
  } catch (error: any) { // Catching 'any' as fast-glob might throw various errors
    console.error("Error in glob tool:", error);
    return JSON.stringify({ error: `Glob execution failed: ${error.message || String(error)}` });
  }
};

/**
 * Searches inside files for code/content matching a regex pattern.
 */
export const grep = async (args: { pattern: string; filePattern?: string; caseSensitive?: boolean }): Promise<string> => {
  const workspaceRoot = getWorkspaceRoot(); 
  if (!workspaceRoot) {
    return JSON.stringify({ error: "Workspace root not found. Cannot perform grep search." });
  }
  if (!args.pattern) {
    return JSON.stringify({ error: "Missing search pattern for grep." });
  }

  const rgArgs: string[] = [
    '--with-filename',
    '--line-number',
    '--color=never',   // For machine parsing
    '--heading',       // Group results by file, simplifies parsing
    // Standard exclusions
    '--glob=!**/node_modules/**',
    '--glob=!**/dist/**',
    '--glob=!**/.git/**',
    '--glob=!**/.vscode/**',
    '--glob=!**/bower_components/**',
    '--glob=!**/*.lock',
    '--glob=!**/*.log',
  ];

  // Main search pattern
  rgArgs.push('-e', args.pattern);

  // Case sensitivity
  if (args.caseSensitive === false) {
      rgArgs.push('--ignore-case');
  } else if (args.caseSensitive === true) {
      rgArgs.push('--case-sensitive');
  } // Else: rg's default "smart case"

  // File Pattern for rg's --glob flag
  if (args.filePattern && typeof args.filePattern === 'string' && args.filePattern.trim() !== '') {
      rgArgs.push('--glob', args.filePattern.trim());
  }
  // If no filePattern is provided, rg searches the CWD (workspaceRoot) by default.

  return new Promise((resolve) => {
    const command = 'rg';
    console.log(`Executing grep command: ${command} ${rgArgs.join(' ')} in ${workspaceRoot}`);

    const rgProcess = spawn(command, rgArgs, { cwd: workspaceRoot, shell: false });

    let stdout = '';
    let stderr = '';

    rgProcess.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    rgProcess.stderr.on('data', (data) => {
        stderr += data.toString();
    });

    rgProcess.on('close', (code) => {
        if (stderr && code !== 0 && code !== 1) { // code 1 for rg means "no matches found"
            console.error('Error in grep tool:', { code, stdout, stderr, message: `Command failed: ${command} ${rgArgs.join(' ')}\n${stderr}` });
            resolve(JSON.stringify({ error: `ripgrep error (code ${code}): ${stderr.trim()}`, matches: [] }));
        } else if (code === 1 && stdout.trim() === '') { // No matches found
            resolve(JSON.stringify({ matches: [] }));
        } else {
            const matches: { filePath: string; lineNumber: number; lineContent: string; absolutePath: string }[] = [];
            let currentFilePath = '';
            const outputLines = stdout.trim().split('\n');

            for (const line of outputLines) {
                if (!line.trim()) continue;

                const isMatchLine = /^[0-9]+:/.test(line);

                if (!isMatchLine && line.length > 0) {
                    currentFilePath = line.trim(); // This line is a file path due to --heading
                    continue; 
                }
                
                if (isMatchLine && currentFilePath) {
                    const firstColonIndex = line.indexOf(':');
                    if (firstColonIndex > 0) { 
                        const numStr = line.substring(0, firstColonIndex);
                        const lineNumber = parseInt(numStr, 10);
                        if (!isNaN(lineNumber)) {
                            const lineContent = line.substring(firstColonIndex + 1);
                            matches.push({
                                filePath: currentFilePath, // This is already an absolute path or path relative to workspaceRoot from rg
                                lineNumber: lineNumber,
                                lineContent: lineContent.trim(),
                                absolutePath: path.isAbsolute(currentFilePath) ? currentFilePath : path.join(workspaceRoot, currentFilePath)
                            });
                        }
                    }
                }
            }
            resolve(JSON.stringify({ matches }));
        }
    });

    rgProcess.on('error', (err) => { 
        console.error('Failed to start ripgrep process:', err);
        resolve(JSON.stringify({ error: `Failed to start ripgrep: ${err.message}`, matches: [] }));
    });
  });
};

/**
 * Loads file content (fully or partially) to include in context.
 */
export const read = async (
  args: { filePath: string; startLine?: number; endLine?: number }
): Promise<string> => {
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
  } catch (error: any) {
    console.error(`Error reading file ${absolutePath}:`, error);
    return JSON.stringify({ error: `Failed to read file ${args.filePath}: ${error.message}` });
  }
};

/**
 * Modifies a specific file based on AI-generated changes.
 */
export const edit = async (
  args: { filePath: string; changes: string }
): Promise<string> => {
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
  } catch (error: any) {
    console.error(`Error editing file ${absolutePath}:`, error);
    return JSON.stringify({ error: `Failed to edit file ${args.filePath}: ${error.message}` });
  }
};

/**
 * Creates new files or overwrites existing ones with new code.
 */
export const write = async (
  args: { filePath: string; content: string; overwrite?: boolean }
): Promise<string> => {
  const workspaceRoot = getWorkspaceRoot();
  const absolutePath = path.isAbsolute(args.filePath) ? args.filePath : workspaceRoot ? path.resolve(workspaceRoot, args.filePath) : path.resolve(args.filePath);
  const dir = path.dirname(absolutePath);

  try {
    await fs.promises.mkdir(dir, { recursive: true }); // Ensure directory exists
    const flag = args.overwrite ? "w" : "wx"; // 'wx' fails if file exists
    await fs.promises.writeFile(absolutePath, args.content, { encoding: "utf8", flag });
    return JSON.stringify({ status: `File ${absolutePath} written successfully` });
  } catch (error: any) {
    console.error(`Error writing file ${absolutePath}:`, error);
    if (error.code === 'EEXIST') {
      return JSON.stringify({ error: `File ${args.filePath} already exists. Set overwrite to true to replace it.` });
    }
    return JSON.stringify({ error: `Failed to write file ${args.filePath}: ${error.message}` });
  }
};

// --- Tool Mappings and Definitions ---

export const functionsMap: Record<string, (args: any) => Promise<string>> = {
  glob,
  grep,
  read,
  edit,
  write,
  // agent, // Agent tool still commented out based on previous instruction
};

export const availableTools: OllamaApiTool[] = [
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
          filePattern: { type: "string", description: "Optional glob pattern to filter files to search within (relative to workspace root), e.g., '*.ts', 'src/**', '**/*.{js,jsx}'. Default is all files ('**/*')." },
          caseSensitive: { type: "boolean", description: "Whether to perform a case-sensitive search. Defaults to false." }
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