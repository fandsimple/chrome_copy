class ExportManager {
  constructor(options = {}) {
    this.options = {
      defaultFormat: 'markdown',
      autoSavePath: 'articles/',
      autoNaming: true,
      includeMetadata: true,
      maxFilenameLength: 200,
      ...options
    };

    this.formats = {
      markdown: {
        extension: '.md',
        mimeType: 'text/markdown',
        handler: this.exportToMarkdown.bind(this)
      },
      html: {
        extension: '.html',
        mimeType: 'text/html',
        handler: this.exportToHtml.bind(this)
      },
      txt: {
        extension: '.txt',
        mimeType: 'text/plain',
        handler: this.exportToText.bind(this)
      },
      pdf: {
        extension: '.pdf',
        mimeType: 'application/pdf',
        handler: this.exportToPdf.bind(this)
      }
    };
  }

  async export(parsedData, options = {}) {
    const format = options.format || this.options.defaultFormat;
    const formatConfig = this.formats[format];

    if (!formatConfig) {
      throw new Error(`Unsupported export format: ${format}`);
    }

    const result = {
      success: false,
      format: format,
      filename: '',
      content: null,
      blob: null,
      error: null
    };

    try {
      const exportResult = await formatConfig.handler(parsedData, options);
      
      result.success = true;
      result.content = exportResult.content;
      result.blob = exportResult.blob;
      result.filename = this.generateFilename(parsedData, format, options);

      if (options.saveToFile !== false) {
        await this.downloadFile(result.blob, result.filename, options);
      }

      if (options.addToHistory !== false) {
        await this.addToHistory(parsedData, result, options);
      }

    } catch (error) {
      result.success = false;
      result.error = error.message;
      console.error('Export failed:', error);
    }

    return result;
  }

  async exportToMarkdown(parsedData, options = {}) {
    let content = '';

    if (options.templateId) {
      const templateEngine = options.templateEngine;
      if (templateEngine) {
        const templateData = templateEngine.prepareTemplateData(parsedData, options);
        content = templateEngine.render(options.templateId, templateData);
      }
    }

    if (!content) {
      content = this.generateDefaultMarkdown(parsedData, options);
    }

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });

    return {
      content: content,
      blob: blob
    };
  }

  generateDefaultMarkdown(parsedData, options = {}) {
    const lines = [];

    if (options.includeMetadata !== false && this.options.includeMetadata) {
      const metadata = this.generateFrontMatter(parsedData);
      if (metadata) {
        lines.push('---');
        lines.push(metadata);
        lines.push('---');
        lines.push('');
      }
    }

    if (parsedData.title) {
      lines.push(`# ${parsedData.title}`);
      lines.push('');
    }

    if (options.includeInfo !== false) {
      const infoLines = [];
      if (parsedData.author) {
        infoLines.push(`**作者**: ${parsedData.author}`);
      }
      if (parsedData.date) {
        infoLines.push(`**日期**: ${parsedData.date}`);
      }
      if (parsedData.url) {
        infoLines.push(`**来源**: [原文链接](${parsedData.url})`);
      }

      if (infoLines.length > 0) {
        lines.push('> ' + infoLines.join('  \n> '));
        lines.push('');
      }
    }

    if (options.includeTOC !== false && parsedData.markdownTOC) {
      lines.push(parsedData.markdownTOC);
    }

    if (parsedData.htmlContent) {
      if (typeof TurndownService !== 'undefined') {
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
          bulletListMarker: '-',
          fence: '```'
        });

        turndownService.addRule('codeBlock', {
          filter: ['pre'],
          replacement: function(content, node) {
            const code = node.querySelector('code');
            const language = code ? 
              (code.className.match(/language-(\w+)/) || [])[1] || '' : '';
            return `\n\`\`\`${language}\n${node.textContent}\n\`\`\`\n\n`;
          }
        });

        turndownService.addRule('table', {
          filter: ['table'],
          replacement: function(content, node) {
            if (parsedData.tables) {
              const tableIndex = Array.from(node.parentNode.querySelectorAll('table')).indexOf(node);
              if (tableIndex >= 0 && parsedData.tables[tableIndex]) {
                return '\n' + parsedData.tables[tableIndex].markdown + '\n';
              }
            }
            return content;
          }
        });

        const markdownContent = turndownService.turndown(parsedData.htmlContent);
        lines.push(markdownContent);
      } else {
        lines.push('<!-- HTML content (Turndown not available) -->');
        lines.push('');
        lines.push(parsedData.htmlContent);
      }
    }

    if (options.includeFooter !== false) {
      lines.push('');
      lines.push('---');
      lines.push('');
      lines.push('*本文由 Smart Article Extractor 自动提取*');
      lines.push(`*提取时间: ${new Date().toLocaleString()}*`);
    }

    return lines.join('\n');
  }

  generateFrontMatter(parsedData) {
    const metadata = parsedData.metadata || {};
    const frontMatter = [];

    if (parsedData.title) {
      frontMatter.push(`title: "${parsedData.title.replace(/"/g, '\\"')}"`);
    }
    if (parsedData.author) {
      frontMatter.push(`author: "${parsedData.author.replace(/"/g, '\\"')}"`);
    }
    if (parsedData.date) {
      frontMatter.push(`date: ${parsedData.date}`);
    }
    if (parsedData.platform) {
      frontMatter.push(`platform: ${parsedData.platform}`);
    }
    if (parsedData.url) {
      frontMatter.push(`source_url: "${parsedData.url}"`);
    }
    if (metadata.estimatedReadTime) {
      frontMatter.push(`read_time: ${metadata.estimatedReadTime} 分钟`);
    }
    if (metadata.contentCategory) {
      frontMatter.push(`category: ${metadata.contentCategory}`);
    }
    if (parsedData.codeBlocks && parsedData.codeBlocks.length > 0) {
      frontMatter.push(`code_blocks: ${parsedData.codeBlocks.length}`);
    }
    if (parsedData.images && parsedData.images.length > 0) {
      frontMatter.push(`images: ${parsedData.images.length}`);
    }

    return frontMatter.join('\n');
  }

  async exportToHtml(parsedData, options = {}) {
    const htmlContent = this.generateHtmlDocument(parsedData, options);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });

    return {
      content: htmlContent,
      blob: blob
    };
  }

  generateHtmlDocument(parsedData, options = {}) {
    const lines = [];

    lines.push('<!DOCTYPE html>');
    lines.push('<html lang="zh-CN">');
    lines.push('<head>');
    lines.push('  <meta charset="UTF-8">');
    lines.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">');
    
    if (parsedData.title) {
      lines.push(`  <title>${this.escapeHtml(parsedData.title)}</title>`);
    }

    lines.push('  <style>');
    lines.push('    * { box-sizing: border-box; }');
    lines.push('    body {');
    lines.push('      max-width: 800px;');
    lines.push('      margin: 0 auto;');
    lines.push('      padding: 40px 20px;');
    lines.push('      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;');
    lines.push('      font-size: 18px;');
    lines.push('      line-height: 1.8;');
    lines.push('      color: #333;');
    lines.push('      background-color: #fafafa;');
    lines.push('    }');
    lines.push('    h1, h2, h3, h4, h5, h6 {');
    lines.push('      font-weight: 600;');
    lines.push('      line-height: 1.4;');
    lines.push('      margin-top: 2em;');
    lines.push('      margin-bottom: 0.5em;');
    lines.push('    }');
    lines.push('    h1 { font-size: 2em; border-bottom: 2px solid #e1e4e8; padding-bottom: 0.5em; }');
    lines.push('    h2 { font-size: 1.5em; }');
    lines.push('    h3 { font-size: 1.25em; }');
    lines.push('    code {');
    lines.push('      background-color: #f6f8fa;');
    lines.push('      padding: 2px 6px;');
    lines.push('      border-radius: 4px;');
    lines.push('      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;');
    lines.push('      font-size: 0.9em;');
    lines.push('      color: #d73a49;');
    lines.push('    }');
    lines.push('    pre {');
    lines.push('      background-color: #1e1e1e;');
    lines.push('      color: #d4d4d4;');
    lines.push('      padding: 16px;');
    lines.push('      border-radius: 8px;');
    lines.push('      overflow-x: auto;');
    lines.push('      margin: 1em 0;');
    lines.push('    }');
    lines.push('    pre code {');
    lines.push('      background: none;');
    lines.push('      padding: 0;');
    lines.push('      color: #d4d4d4;');
    lines.push('    }');
    lines.push('    a {');
    lines.push('      color: #0366d6;');
    lines.push('      text-decoration: none;');
    lines.push('    }');
    lines.push('    a:hover { text-decoration: underline; }');
    lines.push('    img {');
    lines.push('      max-width: 100%;');
    lines.push('      height: auto;');
    lines.push('      border-radius: 4px;');
    lines.push('      margin: 1em 0;');
    lines.push('    }');
    lines.push('    blockquote {');
    lines.push('      border-left: 4px solid #dfe2e5;');
    lines.push('      padding-left: 16px;');
    lines.push('      margin: 1em 0;');
    lines.push('      color: #6a737d;');
    lines.push('      font-style: italic;');
    lines.push('      background-color: #f8f9fa;');
    lines.push('      padding: 16px;');
    lines.push('      border-radius: 0 4px 4px 0;');
    lines.push('    }');
    lines.push('    table {');
    lines.push('      width: 100%;');
    lines.push('      border-collapse: collapse;');
    lines.push('      margin: 1em 0;');
    lines.push('    }');
    lines.push('    th, td {');
    lines.push('      border: 1px solid #dfe2e5;');
    lines.push('      padding: 12px 16px;');
    lines.push('      text-align: left;');
    lines.push('    }');
    lines.push('    th {');
    lines.push('      background-color: #f6f8fa;');
    lines.push('      font-weight: 600;');
    lines.push('    }');
    lines.push('    ul, ol { padding-left: 2em; margin: 1em 0; }');
    lines.push('    li { margin: 0.5em 0; line-height: 1.6; }');
    lines.push('    hr { border: 0; height: 1px; background: #e1e4e8; margin: 2em 0; }');
    lines.push('    .article-meta {');
    lines.push('      background-color: #f8f9fa;');
    lines.push('      padding: 16px;');
    lines.push('      border-radius: 8px;');
    lines.push('      margin-bottom: 2em;');
    lines.push('      border-left: 4px solid #0366d6;');
    lines.push('    }');
    lines.push('    .article-meta p { margin: 4px 0; }');
    lines.push('    .footer {');
    lines.push('      margin-top: 3em;');
    lines.push('      padding-top: 1em;');
    lines.push('      border-top: 1px solid #e1e4e8;');
    lines.push('      font-size: 0.9em;');
    lines.push('      color: #6a737d;');
    lines.push('      text-align: center;');
    lines.push('    }');
    lines.push('  </style>');
    lines.push('</head>');
    lines.push('<body>');

    if (parsedData.title) {
      lines.push(`  <h1>${this.escapeHtml(parsedData.title)}</h1>`);
    }

    if (parsedData.author || parsedData.date || parsedData.url) {
      lines.push('  <div class="article-meta">');
      if (parsedData.author) {
        lines.push(`    <p><strong>作者:</strong> ${this.escapeHtml(parsedData.author)}</p>`);
      }
      if (parsedData.date) {
        lines.push(`    <p><strong>日期:</strong> ${this.escapeHtml(parsedData.date)}</p>`);
      }
      if (parsedData.url) {
        lines.push(`    <p><strong>来源:</strong> <a href="${this.escapeHtml(parsedData.url)}" target="_blank">原文链接</a></p>`);
      }
      lines.push('  </div>');
    }

    if (parsedData.htmlContent) {
      lines.push('  <article>');
      lines.push(`    ${parsedData.htmlContent}`);
      lines.push('  </article>');
    }

    lines.push('  <div class="footer">');
    lines.push('    <p>本文由 Smart Article Extractor 自动提取</p>');
    lines.push(`    <p>提取时间: ${new Date().toLocaleString()}</p>`);
    lines.push('  </div>');

    lines.push('</body>');
    lines.push('</html>');

    return lines.join('\n');
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async exportToText(parsedData, options = {}) {
    const textContent = this.generateTextDocument(parsedData, options);
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });

    return {
      content: textContent,
      blob: blob
    };
  }

  generateTextDocument(parsedData, options = {}) {
    const lines = [];

    if (parsedData.title) {
      lines.push(parsedData.title);
      lines.push('='.repeat(parsedData.title.length));
      lines.push('');
    }

    if (parsedData.author) {
      lines.push(`作者: ${parsedData.author}`);
    }
    if (parsedData.date) {
      lines.push(`日期: ${parsedData.date}`);
    }
    if (parsedData.url) {
      lines.push(`来源: ${parsedData.url}`);
    }

    if (parsedData.author || parsedData.date || parsedData.url) {
      lines.push('');
      lines.push('-'.repeat(40));
      lines.push('');
    }

    if (parsedData.htmlContent) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = parsedData.htmlContent;
      const text = tempDiv.textContent || tempDiv.innerText || '';
      lines.push(text);
    }

    lines.push('');
    lines.push('-'.repeat(40));
    lines.push('');
    lines.push('本文由 Smart Article Extractor 自动提取');
    lines.push(`提取时间: ${new Date().toLocaleString()}`);

    return lines.join('\n');
  }

  async exportToPdf(parsedData, options = {}) {
    if (typeof jsPDF === 'undefined' && typeof html2canvas === 'undefined') {
      const htmlContent = this.generateHtmlDocument(parsedData, options);
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      
      console.warn('jsPDF or html2canvas not available, falling back to HTML export');
      return {
        content: htmlContent,
        blob: blob,
        warning: 'PDF export requires jsPDF and html2canvas libraries. HTML export used instead.'
      };
    }

    const htmlContent = this.generateHtmlDocument(parsedData, options);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });

    return {
      content: htmlContent,
      blob: blob,
      info: 'PDF generation would use jsPDF with html2canvas'
    };
  }

  generateFilename(parsedData, format, options = {}) {
    const formatConfig = this.formats[format];
    const extension = options.extension || formatConfig?.extension || `.${format}`;

    if (options.filename) {
      return this.sanitizeFilename(options.filename) + extension;
    }

    if (!this.options.autoNaming && !options.autoNaming) {
      return `article_${Date.now()}${extension}`;
    }

    let filename = '';

    if (parsedData.title) {
      filename = this.sanitizeFilename(parsedData.title);
    } else if (parsedData.url) {
      try {
        const urlObj = new URL(parsedData.url);
        filename = urlObj.pathname.split('/').pop() || 'article';
        filename = this.sanitizeFilename(filename);
      } catch {
        filename = 'article';
      }
    } else {
      filename = 'article';
    }

    if (options.includeDate !== false) {
      const dateStr = new Date().toISOString().split('T')[0];
      filename = `${filename}_${dateStr}`;
    }

    if (options.includePlatform !== false && parsedData.platform) {
      filename = `${filename}_${parsedData.platform}`;
    }

    filename = filename.substring(0, this.options.maxFilenameLength - extension.length);

    return filename + extension;
  }

  sanitizeFilename(name) {
    if (!name) return 'untitled';

    let sanitized = name;
    sanitized = sanitized.replace(/[<>:"/\\|?*]/g, '_');
    sanitized = sanitized.replace(/[\x00-\x1F\x80-\x9F]/g, '');
    sanitized = sanitized.trim();
    sanitized = sanitized.replace(/\s+/g, '_');
    sanitized = sanitized.replace(/_+/g, '_');
    sanitized = sanitized.replace(/^_+|_+$/g, '');

    if (!sanitized) {
      sanitized = 'untitled';
    }

    return sanitized;
  }

  async downloadFile(blob, filename, options = {}) {
    if (typeof chrome !== 'undefined' && chrome.downloads) {
      const url = URL.createObjectURL(blob);
      const savePath = this.options.autoSavePath || '';
      const fullPath = savePath ? `${savePath}${filename}` : filename;

      try {
        await chrome.downloads.download({
          url: url,
          filename: fullPath,
          saveAs: options.saveAs !== false
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    } else if (typeof window !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      throw new Error('No download API available');
    }
  }

  async addToHistory(parsedData, exportResult, options = {}) {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return;
    }

    const historyKey = 'export_history';
    const maxHistoryItems = options.maxHistoryItems || 100;

    try {
      const result = await chrome.storage.local.get(historyKey);
      let history = result[historyKey] || [];

      const historyItem = {
        id: Date.now().toString(),
        title: parsedData.title || 'Untitled',
        url: parsedData.url || '',
        platform: parsedData.platform || 'generic',
        format: exportResult.format,
        filename: exportResult.filename,
        exportedAt: Date.now(),
        wordCount: parsedData.metadata?.wordCount || 0,
        codeBlockCount: parsedData.codeBlocks?.length || 0,
        imageCount: parsedData.images?.length || 0,
        metadata: {
          author: parsedData.author,
          date: parsedData.date,
          contentCategory: parsedData.metadata?.contentCategory
        }
      };

      history.unshift(historyItem);

      if (history.length > maxHistoryItems) {
        history = history.slice(0, maxHistoryItems);
      }

      await chrome.storage.local.set({ [historyKey]: history });
    } catch (error) {
      console.error('Failed to add to export history:', error);
    }
  }

  async getExportHistory(options = {}) {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return [];
    }

    const historyKey = 'export_history';

    try {
      const result = await chrome.storage.local.get(historyKey);
      let history = result[historyKey] || [];

      if (options.platform) {
        history = history.filter(item => item.platform === options.platform);
      }

      if (options.format) {
        history = history.filter(item => item.format === options.format);
      }

      if (options.startDate) {
        history = history.filter(item => item.exportedAt >= options.startDate);
      }

      if (options.endDate) {
        history = history.filter(item => item.exportedAt <= options.endDate);
      }

      if (options.limit) {
        history = history.slice(0, options.limit);
      }

      return history;
    } catch (error) {
      console.error('Failed to get export history:', error);
      return [];
    }
  }

  async clearExportHistory(options = {}) {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return false;
    }

    const historyKey = 'export_history';

    try {
      if (options.beforeDate) {
        const result = await chrome.storage.local.get(historyKey);
        let history = result[historyKey] || [];
        history = history.filter(item => item.exportedAt >= options.beforeDate);
        await chrome.storage.local.set({ [historyKey]: history });
      } else {
        await chrome.storage.local.remove(historyKey);
      }
      return true;
    } catch (error) {
      console.error('Failed to clear export history:', error);
      return false;
    }
  }

  getSupportedFormats() {
    return Object.keys(this.formats).map(format => ({
      format: format,
      extension: this.formats[format].extension,
      mimeType: this.formats[format].mimeType
    }));
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExportManager;
}
