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
exports.CodebaseManager = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
/**
 * Class to handle codebase operations. Implements vscode.Disposable to manage the file watcher.
 */
class CodebaseManager {
    index;
    workspaceRoot;
    watcher;
    extensionContext; // To add disposables
    constructor(context) {
        this.extensionContext = context;
        this.index = {
            files: new Map(),
            fileTree: new Map()
        };
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        if (this.workspaceRoot) {
            this.watchWorkspaceChanges();
        }
    }
    watchWorkspaceChanges() {
        if (!this.workspaceRoot)
            return;
        this.watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(this.workspaceRoot, '**/*'), false, // ignoreCreateEvents - we handle them
        false, // ignoreChangeEvents - we handle them
        false // ignoreDeleteEvents - we handle them
        );
        this.watcher.onDidCreate(uri => this.handleFileCreate(uri));
        this.watcher.onDidChange(uri => this.handleFileChange(uri));
        this.watcher.onDidDelete(uri => this.handleFileDelete(uri));
        // Ensure extensionContext is valid before pushing
        if (this.extensionContext && this.extensionContext.subscriptions) {
            this.extensionContext.subscriptions.push(this.watcher);
            console.log("CodebaseManager: File system watcher started.");
        }
        else {
            console.error("CodebaseManager: ExtensionContext not available for watcher registration.");
        }
    }
    async handleFileCreate(uri) {
        const filePath = path.relative(this.workspaceRoot, uri.fsPath);
        if (this.isIgnored(filePath))
            return;
        console.log(`CodebaseManager: File created - ${filePath}`);
        try {
            const language = this.getLanguageFromPath(filePath);
            const stats = await fs.promises.stat(uri.fsPath);
            this.index.files.set(filePath, {
                path: filePath,
                language,
                lastModified: stats.mtimeMs
                // content and summary will be lazy-loaded/generated
            });
            let dir = path.dirname(filePath);
            if (dir === '.')
                dir = ''; // Normalize root directory key
            if (!this.index.fileTree.has(dir)) {
                this.index.fileTree.set(dir, []);
            }
            const filesInDir = this.index.fileTree.get(dir);
            if (!filesInDir.includes(filePath)) {
                filesInDir.push(filePath);
            }
        }
        catch (error) {
            console.error(`Error processing created file ${filePath}:`, error);
        }
    }
    async handleFileChange(uri) {
        const filePath = path.relative(this.workspaceRoot, uri.fsPath);
        if (this.isIgnored(filePath))
            return;
        console.log(`CodebaseManager: File changed - ${filePath}`);
        const fileData = this.index.files.get(filePath);
        if (fileData) {
            try {
                const stats = await fs.promises.stat(uri.fsPath);
                fileData.lastModified = stats.mtimeMs;
                delete fileData.content; // Invalidate cached content
                delete fileData.summary; // Invalidate cached summary
            }
            catch (error) {
                console.error(`Error processing changed file stats ${filePath}:`, error);
                this.handleFileDelete(uri);
            }
        }
        else {
            await this.handleFileCreate(uri);
        }
    }
    handleFileDelete(uri) {
        const filePath = path.relative(this.workspaceRoot, uri.fsPath);
        if (this.isIgnored(filePath))
            return;
        console.log(`CodebaseManager: File deleted - ${filePath}`);
        this.index.files.delete(filePath);
        let dir = path.dirname(filePath);
        if (dir === '.')
            dir = ''; // Normalize root directory key
        const filesInDir = this.index.fileTree.get(dir);
        if (filesInDir) {
            const index = filesInDir.indexOf(filePath);
            if (index > -1) {
                filesInDir.splice(index, 1);
            }
            if (filesInDir.length === 0) {
                this.index.fileTree.delete(dir);
            }
        }
    }
    isIgnored(filePath) {
        return filePath.includes('node_modules/') || filePath.includes('.git/') || filePath.startsWith('.') || !filePath;
    }
    dispose() {
        if (this.watcher) {
            this.watcher.dispose();
            console.log("CodebaseManager: File system watcher disposed.");
        }
    }
    async crawlCodebase() {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder found for CodebaseManager.');
        }
        this.index.files.clear();
        this.index.fileTree.clear();
        const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**,**/.git/**');
        for (const file of files) {
            const relativePath = path.relative(this.workspaceRoot, file.fsPath);
            if (this.isIgnored(relativePath)) {
                continue;
            }
            try {
                const language = this.getLanguageFromPath(file.fsPath);
                const stats = await fs.promises.stat(file.fsPath);
                this.index.files.set(relativePath, {
                    path: relativePath,
                    language,
                    lastModified: stats.mtimeMs
                });
                let dir = path.dirname(relativePath);
                if (dir === '.')
                    dir = ''; // Normalize root directory key
                if (!this.index.fileTree.has(dir)) {
                    this.index.fileTree.set(dir, []);
                }
                this.index.fileTree.get(dir)?.push(relativePath);
            }
            catch (error) {
                console.error(`Error initially indexing file ${relativePath}:`, error);
            }
        }
        console.log("CodebaseManager: Initial codebase scan complete.");
    }
    async getFileContent(filePath) {
        const fileData = this.index.files.get(filePath);
        if (!fileData)
            return undefined;
        if (fileData.content === undefined) {
            try {
                const fullPath = path.join(this.workspaceRoot, filePath);
                const contentBuffer = await vscode.workspace.fs.readFile(vscode.Uri.file(fullPath));
                fileData.content = contentBuffer.toString();
            }
            catch (error) {
                console.error(`Error loading content for file ${filePath}:`, error);
                return undefined;
            }
        }
        return fileData.content;
    }
    getFileSummary(filePath) {
        return this.index.files.get(filePath)?.summary;
    }
    setFileSummary(filePath, summary) {
        const fileData = this.index.files.get(filePath);
        if (fileData) {
            fileData.summary = summary;
        }
        else {
            console.warn(`CodebaseManager: Attempted to set summary for non-indexed file: ${filePath}`);
        }
    }
    getFilesInDirectory(dirPath) {
        const normalizedDirPath = dirPath === '.' ? '' : dirPath;
        return this.index.fileTree.get(normalizedDirPath) || [];
    }
    getProjectStructure() {
        let structure = '';
        const buildTreeRecursive = (currentDirKey, level = 0) => {
            const filesInCurrentDir = this.index.fileTree.get(currentDirKey) || [];
            const indent = '  '.repeat(level);
            const sortedFilePaths = filesInCurrentDir
                .filter(filePath => {
                let parentDir = path.dirname(filePath);
                if (parentDir === '.')
                    parentDir = '';
                return parentDir === currentDirKey;
            })
                .sort();
            for (const filePath of sortedFilePaths) {
                const baseName = path.basename(filePath);
                structure += `${indent}${baseName}\n`;
            }
            const subDirKeys = new Set();
            for (const dKey of this.index.fileTree.keys()) {
                if (dKey === currentDirKey || dKey === '')
                    continue;
                let parentOf_dKey = path.dirname(dKey);
                if (parentOf_dKey === '.')
                    parentOf_dKey = '';
                if (parentOf_dKey === currentDirKey) {
                    subDirKeys.add(dKey);
                }
            }
            for (const subDirKey of Array.from(subDirKeys).sort()) {
                const dirName = path.basename(subDirKey);
                structure += `${indent}${dirName}/\n`;
                buildTreeRecursive(subDirKey, level + 1);
            }
        };
        buildTreeRecursive('', 0);
        return structure;
    }
    async writeToFile(filePath, content) {
        const fullPath = path.join(this.workspaceRoot, filePath);
        await vscode.workspace.fs.writeFile(vscode.Uri.file(fullPath), Buffer.from(content));
        const fileData = this.index.files.get(filePath);
        if (fileData) {
            fileData.content = content;
            fileData.lastModified = Date.now();
            delete fileData.summary; // Invalidate summary on write
        }
        else {
            // File was created, watcher should pick it up. 
            // To be robust, we can call handleFileCreate explicitly or add it here.
            // For now, relying on watcher for new files created by user externally or by this method if not in index.
            // If we add it here, ensure no race conditions with watcher.
            console.log(`CodebaseManager: Wrote to new file ${filePath}, watcher should index it.`);
        }
    }
    searchFiles(query) {
        const results = [];
        if (!query || query.trim() === '')
            return results;
        const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        for (const file of this.index.files.values()) {
            if (searchRegex.test(file.path)) {
                results.push(file);
                continue;
            }
            if (file.content && searchRegex.test(file.content)) {
                results.push(file);
                continue;
            }
            if (file.summary && searchRegex.test(file.summary)) {
                results.push(file);
            }
        }
        return Array.from(new Map(results.map(file => [file.path, file])).values());
    }
    getLanguageFromPath(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap = {
            '.js': 'javascript', '.ts': 'typescript', '.jsx': 'javascript', '.tsx': 'typescript',
            '.py': 'python', '.java': 'java', '.cpp': 'cpp', '.c': 'c', '.h': 'c', '.hpp': 'cpp',
            '.cs': 'csharp', '.go': 'go', '.rs': 'rust', '.rb': 'ruby', '.php': 'php',
            '.swift': 'swift', '.kt': 'kotlin', '.scala': 'scala', '.html': 'html',
            '.css': 'css', '.scss': 'scss', '.json': 'json', '.xml': 'xml', '.md': 'markdown',
            '.txt': 'text'
        };
        return languageMap[ext] || 'unknown';
    }
}
exports.CodebaseManager = CodebaseManager;
//# sourceMappingURL=codebaseUtils.js.map