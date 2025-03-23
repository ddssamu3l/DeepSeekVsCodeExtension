"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markdownToHTML = markdownToHTML;
/**
 * Converts Markdown text to HTML.
 * @function markdownToHTML
 * @param {string} markdown - The Markdown text to convert
 * @returns {string} The converted HTML string
 */
function markdownToHTML(markdown) {
    // First, escape HTML special characters to prevent injection issues.
    let html = markdown.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    // Convert code blocks (```language\ncode\n```)
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code class="language-${lang || 'plaintext'}">${code}</code></pre>`;
    });
    // Convert inline code (using backticks)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Convert headings (from # to ######)
    html = html.replace(/^###### (.*)$/gim, '<h6>$1</h6>');
    html = html.replace(/^##### (.*)$/gim, '<h5>$1</h5>');
    html = html.replace(/^#### (.*)$/gim, '<h4>$1</h4>');
    html = html.replace(/^### (.*)$/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*)$/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*)$/gim, '<h1>$1</h1>');
    // Convert bold text (**text**)
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    // Convert italic text (*text* or _text_)
    html = html.replace(/(\*|_)(.*?)\1/gim, '<em>$2</em>');
    // Convert blockquotes (lines starting with >)
    html = html.replace(/^\> (.*)$/gim, '<blockquote>$1</blockquote>');
    // // Convert unordered list items (lines starting with - or *)
    // html = html.replace(/^\s*[-*]\s+(.*)$/gim, '<li>$1</li>');
    // // Wrap consecutive <li> elements in <ul> tags
    // html = html.replace(/(<li>[\s\S]+?<\/li>)/gim, '<ul>$1</ul>');
    // // Convert ordered list items (lines starting with a number and a dot)
    // html = html.replace(/^\s*\d+\.\s+(.*)$/gim, '<li>$1</li>');
    // // Wrap consecutive <li> elements in <ol> tags
    // html = html.replace(/(<li>[\s\S]+?<\/li>)/gim, '<ol>$1</ol>');
    // Convert remaining newlines to <br> for simple line breaks.
    html = html.replace(/\n/g, '<br>');
    // convert <think> tags to <div> tag with a "think" class
    html = html.replace(/<think>/g, '<p>');
    html = html.replace(/<\/think>/g, '</p>');
    return html;
}
//# sourceMappingURL=markdownConverter.js.map