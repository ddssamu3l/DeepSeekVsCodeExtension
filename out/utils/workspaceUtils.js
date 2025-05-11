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
exports.getWorkspaceRoot = getWorkspaceRoot;
exports.buildWorkspaceMap = buildWorkspaceMap;
exports.createCondensedMapForPrompt = createCondensedMapForPrompt;
exports.recordFileAccess = recordFileAccess;
exports.buildPrioritizedWorkspaceMap = buildPrioritizedWorkspaceMap;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Gets the root directory of the current workspace
 * @returns {string | undefined} The workspace root path or undefined if no workspace is open
 */
function getWorkspaceRoot() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    return workspaceFolders[0].uri.fsPath;
}
/**
 * Cache to store information about tracked files
 * This helps prioritize which files to include in the context
 */
const fileTrackingCache = new Map();
/**
 * Scans the workspace and builds a map of file contents
 * @param {number} maxFileSizeKb - Maximum file size in KB to include in the map
 * @param {string[]} excludePatterns - Array of glob patterns to exclude
 * @returns {Promise<FileEntry[]>} Array of file entries
 */
async function buildWorkspaceMap(maxFileSizeKb = 100, excludePatterns = ['**/node_modules/**', '**/.git/**']) {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
        console.error('No workspace open');
        return [];
    }
    const fileEntries = [];
    const maxSizeBytes = maxFileSizeKb * 1024;
    // Get all files in the workspace using vscode API
    const files = await vscode.workspace.findFiles('**/*', `{${excludePatterns.join(',')}}`);
    for (const file of files) {
        try {
            const filePath = file.fsPath;
            const stats = fs.statSync(filePath);
            // Skip directories and files that are too large
            if (stats.isDirectory() || stats.size > maxSizeBytes) {
                continue;
            }
            // Skip binary files based on common extensions
            const ext = path.extname(filePath).toLowerCase();
            if (['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.pdf', '.zip', '.gz', '.tar', '.mp4', '.mp3', '.mov', '.avi'].includes(ext)) {
                continue;
            }
            // Read the file content
            const content = fs.readFileSync(filePath, 'utf8');
            const relativePath = path.relative(workspaceRoot, filePath);
            fileEntries.push({
                filePath,
                relativePath,
                content,
                size: stats.size
            });
        }
        catch (error) {
            console.warn(`Error reading file ${file.fsPath}:`, error);
        }
    }
    return fileEntries;
}
/**
 * Creates a condensed representation of the workspace map suitable for inclusion in a system prompt
 * @param {FileEntry[]} workspaceMap - The workspace map to summarize
 * @param {number} maxTotalSizeKb - Maximum total size in KB for the condensed map
 * @returns {string} Condensed map as a string
 */
function createCondensedMapForPrompt(workspaceMap, maxTotalSizeKb = 8000) {
    const maxTotalChars = maxTotalSizeKb * 1024;
    let totalSize = 0;
    let result = "PROJECT CODEBASE MAP:\n";
    // Sort files by relative path for better organization
    const sortedMap = [...workspaceMap].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    for (const entry of sortedMap) {
        // Create an entry with truncated content if needed to stay within size limits
        const fileEntry = `FILE: ${entry.relativePath}\n${entry.content}\nEND OF FILE\n\n`;
        // Check if adding this file would exceed the size limit
        if (totalSize + fileEntry.length > maxTotalChars) {
            // If we're about to exceed the limit, add a truncated version or skip
            const remainingSpace = maxTotalChars - totalSize - `FILE: ${entry.relativePath}\n[Content truncated due to size]\nEND OF FILE\n\n`.length;
            if (remainingSpace > 100) { // Only include if we can add a meaningful portion
                result += `FILE: ${entry.relativePath}\n${entry.content.substring(0, remainingSpace)}\n[...truncated...]\nEND OF FILE\n\n`;
            }
            else {
                result += `FILE: ${entry.relativePath}\n[Content omitted due to size constraints]\nEND OF FILE\n\n`;
            }
            // We've reached the limit, add a note and stop
            result += `NOTE: Additional ${sortedMap.length - sortedMap.indexOf(entry) - 1} files were omitted due to size constraints.`;
            break;
        }
        result += fileEntry;
        totalSize += fileEntry.length;
    }
    return result;
}
/**
 * Records file access for prioritization purposes
 * @param {string} filePath - The path to the accessed file
 */
function recordFileAccess(filePath) {
    if (!filePath)
        return;
    const now = Date.now();
    const existingEntry = fileTrackingCache.get(filePath);
    if (existingEntry) {
        existingEntry.lastAccessed = now;
        existingEntry.accessCount += 1;
        existingEntry.isPriority = true;
    }
    else {
        try {
            const stats = fs.statSync(filePath);
            const workspaceRoot = getWorkspaceRoot();
            if (!workspaceRoot)
                return;
            const relativePath = path.relative(workspaceRoot, filePath);
            fileTrackingCache.set(filePath, {
                filePath,
                relativePath,
                content: '', // We'll load this when needed
                size: stats.size,
                lastAccessed: now,
                accessCount: 1,
                lastModified: stats.mtime.getTime(),
                isPriority: true
            });
        }
        catch (error) {
            console.warn(`Error tracking file access for ${filePath}:`, error);
        }
    }
}
/**
 * Builds a prioritized workspace map, focusing on recently accessed/modified files
 * @param {number} maxFileSizeKb - Maximum file size in KB to include
 * @param {string[]} excludePatterns - Glob patterns to exclude
 * @param {number} priorityLimit - Maximum number of priority files to include
 * @returns {Promise<FileEntry[]>} Array of file entries, with prioritized files first
 */
async function buildPrioritizedWorkspaceMap(maxFileSizeKb = 100, excludePatterns = ['**/node_modules/**', '**/.git/**'], priorityLimit = 20) {
    // First, get all files from the workspace
    const allFiles = await buildWorkspaceMap(maxFileSizeKb, excludePatterns);
    // Identify active editor files and recently accessed files
    const activeEditorPath = vscode.window.activeTextEditor?.document.uri.fsPath;
    if (activeEditorPath) {
        recordFileAccess(activeEditorPath);
    }
    // Add entries for all files in the workspace
    for (const file of allFiles) {
        const existingEntry = fileTrackingCache.get(file.filePath);
        if (existingEntry) {
            // Update the content but preserve tracking info
            existingEntry.content = file.content;
            existingEntry.size = file.size;
        }
        else {
            // Create a new entry with tracking info
            fileTrackingCache.set(file.filePath, {
                ...file,
                accessCount: 0,
                lastModified: fs.statSync(file.filePath).mtime.getTime(),
                isPriority: false
            });
        }
    }
    // Convert map to array and sort by priority factors
    const allTrackedFiles = Array.from(fileTrackingCache.values());
    // Sort files: priority first, then by access count and last modified
    allTrackedFiles.sort((a, b) => {
        // First prioritize explicitly marked priority files
        if (a.isPriority && !b.isPriority)
            return -1;
        if (!a.isPriority && b.isPriority)
            return 1;
        // Then prioritize by access count
        if (a.accessCount !== b.accessCount) {
            return b.accessCount - a.accessCount;
        }
        // Finally prioritize by last modified time
        return b.lastModified - a.lastModified;
    });
    // Build the final result with prioritized files first
    const result = [];
    // Add the priority files (with most accessed/recently modified first)
    const priorityFiles = allTrackedFiles.filter(f => f.isPriority).slice(0, priorityLimit);
    for (const file of priorityFiles) {
        // Ensure content is loaded for priority files
        if (!file.content) {
            try {
                file.content = fs.readFileSync(file.filePath, 'utf8');
            }
            catch (error) {
                console.warn(`Error reading priority file ${file.filePath}:`, error);
                file.content = `[Error reading file: ${error instanceof Error ? error.message : String(error)}]`;
            }
        }
        result.push(file);
    }
    // Fill in the rest from allFiles, excluding already added files
    const priorityPaths = new Set(priorityFiles.map(f => f.filePath));
    for (const file of allFiles) {
        if (!priorityPaths.has(file.filePath)) {
            result.push(file);
        }
    }
    return result;
}
// Update editor tracking to record file accesses
vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor?.document?.uri?.fsPath) {
        recordFileAccess(editor.document.uri.fsPath);
    }
});
// Track document changes to keep cached content up-to-date
vscode.workspace.onDidChangeTextDocument(event => {
    const filePath = event.document.uri.fsPath;
    const trackedFile = fileTrackingCache.get(filePath);
    if (trackedFile) {
        // Update the content in our cache
        trackedFile.content = event.document.getText();
        trackedFile.lastModified = Date.now();
        trackedFile.isPriority = true; // Recently modified files are priority
        // Bump the access count too
        trackedFile.accessCount += 1;
    }
});
// Track newly created files
vscode.workspace.onDidCreateFiles(event => {
    for (const uri of event.files) {
        try {
            const filePath = uri.fsPath;
            const stats = fs.statSync(filePath);
            const workspaceRoot = getWorkspaceRoot();
            if (!workspaceRoot)
                continue;
            const relativePath = path.relative(workspaceRoot, filePath);
            // Skip directories and binary files
            if (stats.isDirectory())
                continue;
            const ext = path.extname(filePath).toLowerCase();
            if (['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.pdf', '.zip', '.gz', '.tar', '.mp4', '.mp3', '.mov', '.avi'].includes(ext)) {
                continue;
            }
            // Try to read the file content
            let content = '';
            try {
                content = fs.readFileSync(filePath, 'utf8');
            }
            catch (error) {
                console.warn(`Error reading new file ${filePath}:`, error);
            }
            // Add to tracking cache as a priority file
            fileTrackingCache.set(filePath, {
                filePath,
                relativePath,
                content,
                size: stats.size,
                lastAccessed: Date.now(),
                accessCount: 1,
                lastModified: stats.mtime.getTime(),
                isPriority: true // New files are priority
            });
        }
        catch (error) {
            console.warn(`Error tracking new file ${uri.fsPath}:`, error);
        }
    }
});
// Track deleted files
vscode.workspace.onDidDeleteFiles(event => {
    for (const uri of event.files) {
        // Remove from tracking cache
        fileTrackingCache.delete(uri.fsPath);
    }
});
//# sourceMappingURL=workspaceUtils.js.map