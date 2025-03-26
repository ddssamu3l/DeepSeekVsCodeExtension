/**
 * Converts Markdown text to HTML.
 * @function markdownToHTML
 * @param {string} markdown - The Markdown text to convert
 * @returns {string} The converted HTML string
 */
export function markdownToHTML(markdown: string): string {
  // First, escape HTML special characters to prevent injection issues.
  let html = markdown.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Handle LaTeX-style math: block math \[...\] and inline math \(...\)
  html = html.replace(/\\\[(.*?)\\\]/gs, '<div class="math-block">\\[$1\\]</div>');
  html = html.replace(/\\\((.+?)\\\)/gs, '<span class="math-inline">\\($1\\)</span>');

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

  // Convert remaining newlines to <br> for simple line breaks.
  html = html.replace(/\n/g, '<br>');

  // Convert <think> tags to <p class="think">
  html = html.replace(/<think>/g, '<p class="think">');
  html = html.replace(/<\/think>/g, '</p>');

  return html;
}
