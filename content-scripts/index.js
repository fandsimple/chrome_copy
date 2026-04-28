class ContentScriptManager {
  constructor() {
    this.parser = null;
    this.enhancer = null;
    this.customRulesManager = null;
    this.templateEngine = null;
    this.exportManager = null;
    this.batchManager = null;
    this.mergeManager = null;
    this.errorHandler = null;
    this.siteCompatibility = null;

    this.isInitialized = false;
    this.settings = {};
    this.platform = null;

    this.init();
  }

  async init() {
    try {
      this.detectPlatform();
      await this.loadSettings();
      this.initializeCoreClasses();
      this.setupMessageListeners();
      this.injectExportButton();
      this.isInitialized = true;
      console.log('Smart Article Extractor: Content script initialized');
    } catch (error) {
      console.error('Smart Article Extractor: Initialization failed', error);
    }
  }

  detectPlatform() {
    const url = window.location.href;

    const platformRules = {
      csdn: ['blog.csdn.net'],
      juejin: ['juejin.cn', 'juejin.im'],
      cnblogs: ['cnblogs.com'],
      jianshu: ['jianshu.com'],
      zhihu: ['zhihu.com', 'zhuanlan.zhihu.com'],
      segmentfault: ['segmentfault.com'],
      dgstack: ['dgstack.cn'],
      baiduwk: ['wenku.baidu.com']
    };

    for (const [platform, patterns] of Object.entries(platformRules)) {
      for (const pattern of patterns) {
        if (url.includes(pattern)) {
          this.platform = platform;
          return;
        }
      }
    }

    this.platform = 'generic';
  }

  async loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const result = await chrome.storage.local.get('smart_extractor_settings');
        this.settings = result.smart_extractor_settings || this.getDefaultSettings();
      } catch (error) {
        console.warn('Failed to load settings, using defaults:', error);
        this.settings = this.getDefaultSettings();
      }
    } else {
      this.settings = this.getDefaultSettings();
    }
  }

  getDefaultSettings() {
    return {
      autoInjectButton: true,
      enableReadingMode: true,
      enableImageOffline: false,
      enableCodeHighlight: true,
      enableTableOfContents: true,
      defaultExportFormat: 'markdown',
      autoSave: false,
      maxRetries: 3,
      enabledPlatforms: ['csdn', 'juejin', 'cnblogs', 'jianshu', 'zhihu', 'segmentfault', 'generic']
    };
  }

  initializeCoreClasses() {
    if (typeof AIParser !== 'undefined') {
      this.parser = new AIParser({
        enableSemanticAnalysis: true,
        enableAdFiltering: true,
        enableStructureExtraction: true,
        enableAutoTOC: this.settings.enableTableOfContents,
        enableCodeFormatting: this.settings.enableCodeHighlight,
        enableLayoutFix: true
      });
    }

    if (typeof ContentEnhancer !== 'undefined') {
      this.enhancer = new ContentEnhancer({
        removeRedundant: true,
        normalizeLinks: true,
        preserveCodeHighlight: this.settings.enableCodeHighlight,
        fixFormatting: true,
        deduplicateContent: true,
        enableReadingMode: this.settings.enableReadingMode,
        enableImageOffline: this.settings.enableImageOffline,
        preserveFormulas: true,
        preserveTables: true
      });
    }

    if (typeof CustomRulesManager !== 'undefined') {
      this.customRulesManager = new CustomRulesManager();
    }

    if (typeof TemplateEngine !== 'undefined') {
      this.templateEngine = new TemplateEngine();
    }

    if (typeof ExportManager !== 'undefined') {
      this.exportManager = new ExportManager({
        defaultFormat: this.settings.defaultExportFormat,
        autoSavePath: 'articles/',
        autoNaming: true,
        includeMetadata: true
      });
    }

    if (typeof BatchManager !== 'undefined') {
      this.batchManager = new BatchManager({
        maxConcurrent: 2,
        maxRetries: this.settings.maxRetries
      });
    }

    if (typeof MergeManager !== 'undefined') {
      this.mergeManager = new MergeManager();
    }

    if (typeof ErrorHandler !== 'undefined') {
      this.errorHandler = new ErrorHandler({
        maxRetries: this.settings.maxRetries
      });
    }

    if (typeof SiteCompatibilityLayer !== 'undefined') {
      this.siteCompatibility = new SiteCompatibilityLayer();
    }
  }

  setupMessageListeners() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        this.handleMessage(request, sender, sendResponse);
        return true;
      });
    }

    document.addEventListener('smart-extractor-parse', (event) => {
      this.handleParseEvent(event.detail);
    });
  }

  async handleMessage(request, sender, sendResponse) {
    const { action, data } = request;

    try {
      switch (action) {
        case 'PARSE_ARTICLE':
          const parseResult = await this.parseCurrentPage(data?.options);
          sendResponse({ success: true, data: parseResult });
          break;

        case 'COPY_TO_CLIPBOARD':
          const clipboardResult = await this.copyToClipboard(data?.options);
          sendResponse({ success: true, data: clipboardResult });
          break;

        case 'EXPORT_MARKDOWN':
          const exportResult = await this.exportContent(data?.format, data?.options);
          sendResponse({ success: true, data: exportResult });
          break;

        case 'ENABLE_READING_MODE':
          const readingModeResult = await this.enableReadingMode();
          sendResponse({ success: true, data: readingModeResult });
          break;

        case 'GET_PAGE_INFO':
          const pageInfo = this.getPageInfo();
          sendResponse({ success: true, data: pageInfo });
          break;

        case 'ADD_TO_BATCH':
          const batchResult = this.addToBatchQueue(data);
          sendResponse({ success: true, data: batchResult });
          break;

        case 'APPLY_CUSTOM_RULE':
          const ruleResult = await this.applyCustomRule(data?.ruleId);
          sendResponse({ success: true, data: ruleResult });
          break;

        case 'GET_SETTINGS':
          sendResponse({ success: true, data: this.settings });
          break;

        case 'UPDATE_SETTINGS':
          this.settings = { ...this.settings, ...data };
          await this.saveSettings();
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: `Unknown action: ${action}` });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async parseCurrentPage(options = {}) {
    console.log('Smart Article Extractor: Parsing current page...');

    const url = window.location.href;
    const doc = document.cloneNode(true);

    let parsedData = null;

    if (this.siteCompatibility) {
      const compatibilityResult = await this.siteCompatibility.parseWithFallback(doc, url, {
        parser: this.parser,
        enhancer: this.enhancer
      });

      if (compatibilityResult.success) {
        parsedData = compatibilityResult.result;
      }
    }

    if (!parsedData && this.parser) {
      let customRules = null;
      if (options.customRuleId && this.customRulesManager) {
        customRules = await this.customRulesManager.getRule(options.customRuleId);
      }

      parsedData = await this.parser.parse(doc, url, customRules);
    }

    if (!parsedData) {
      throw new Error('Failed to parse page: no parser available');
    }

    if (this.enhancer && parsedData.success) {
      parsedData = this.enhancer.enhance(parsedData);
    }

    parsedData.platform = this.platform;
    parsedData.parseTime = Date.now();

    console.log('Smart Article Extractor: Parse complete', parsedData);
    return parsedData;
  }

  async copyToClipboard(options = {}) {
    const parsedData = await this.parseCurrentPage(options);

    if (!parsedData.success) {
      throw new Error(`Parse failed: ${parsedData.error}`);
    }

    let markdownContent = '';

    if (this.templateEngine && options.templateId) {
      const templateData = this.templateEngine.prepareTemplateData(parsedData, options);
      markdownContent = this.templateEngine.render(options.templateId, templateData);
    } else if (this.exportManager) {
      const exportResult = await this.exportManager.exportToMarkdown(parsedData, options);
      markdownContent = exportResult.content;
    } else {
      markdownContent = this.generateSimpleMarkdown(parsedData);
    }

    await this.writeToClipboard(markdownContent);

    return {
      success: true,
      content: markdownContent,
      length: markdownContent.length
    };
  }

  generateSimpleMarkdown(parsedData) {
    const lines = [];

    if (parsedData.title) {
      lines.push(`# ${parsedData.title}`);
      lines.push('');
    }

    if (parsedData.author) {
      lines.push(`**作者**: ${parsedData.author}`);
    }
    if (parsedData.date) {
      lines.push(`**日期**: ${parsedData.date}`);
    }
    if (parsedData.url) {
      lines.push(`**来源**: [原文链接](${parsedData.url})`);
    }

    if (parsedData.author || parsedData.date || parsedData.url) {
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    if (parsedData.markdownTOC) {
      lines.push(parsedData.markdownTOC);
    }

    if (parsedData.htmlContent && typeof TurndownService !== 'undefined') {
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced'
      });

      turndownService.addRule('codeBlock', {
        filter: ['pre'],
        replacement: function(content, node) {
          const code = node.querySelector('code');
          const language = code ? (code.className.match(/language-(\w+)/) || [])[1] || '' : '';
          return `\n\`\`\`${language}\n${node.textContent}\n\`\`\`\n\n`;
        }
      });

      const markdown = turndownService.turndown(parsedData.htmlContent);
      lines.push(markdown);
    } else if (parsedData.htmlContent) {
      lines.push('<!-- HTML content (Turndown not available) -->');
      lines.push('');
      lines.push(parsedData.htmlContent);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('*本文由 Smart Article Extractor 自动提取*');

    return lines.join('\n');
  }

  async writeToClipboard(content) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(content);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = content;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textArea);
      }
    }
  }

  async exportContent(format = 'markdown', options = {}) {
    if (!this.exportManager) {
      throw new Error('ExportManager not available');
    }

    const parsedData = await this.parseCurrentPage(options);

    if (!parsedData.success) {
      throw new Error(`Parse failed: ${parsedData.error}`);
    }

    const exportResult = await this.exportManager.export(parsedData, {
      format: format,
      templateId: options.templateId,
      templateEngine: this.templateEngine,
      ...options
    });

    return exportResult;
  }

  async enableReadingMode() {
    const parsedData = await this.parseCurrentPage();

    if (!parsedData.success || !parsedData.readingModeHTML) {
      throw new Error('Reading mode HTML not available');
    }

    const readingModeContainer = document.createElement('div');
    readingModeContainer.id = 'smart-article-reading-mode';
    readingModeContainer.innerHTML = parsedData.readingModeHTML;

    const overlay = document.createElement('div');
    overlay.id = 'smart-article-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 99998;
      overflow: auto;
    `;

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '×';
    closeButton.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #fff;
      border: none;
      font-size: 24px;
      cursor: pointer;
      z-index: 99999;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;

    closeButton.onclick = () => {
      overlay.remove();
      closeButton.remove();
      document.body.style.overflow = '';
    };

    overlay.appendChild(readingModeContainer);
    document.body.appendChild(overlay);
    document.body.appendChild(closeButton);
    document.body.style.overflow = 'hidden';

    return {
      success: true,
      title: parsedData.title,
      hasTOC: parsedData.tableOfContents?.length > 0
    };
  }

  getPageInfo() {
    return {
      title: document.title,
      url: window.location.href,
      platform: this.platform,
      hasArticle: this.detectArticleContent(),
      settings: this.settings
    };
  }

  detectArticleContent() {
    const articleSelectors = [
      'article',
      '.article-content',
      '.post-content',
      '.entry-content',
      '#article_content',
      '.markdown-body',
      '#content_views'
    ];

    for (const selector of articleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim().length > 100) {
        return true;
      }
    }

    return false;
  }

  addToBatchQueue(data) {
    if (!this.batchManager) {
      return { success: false, error: 'BatchManager not available' };
    }

    const item = {
      url: data.url || window.location.href,
      title: data.title || document.title,
      platform: this.platform,
      metadata: data.metadata || {}
    };

    const queueItem = this.batchManager.add(item);

    return {
      success: true,
      item: queueItem,
      queueLength: this.batchManager.getQueueStatus().queueLength
    };
  }

  async applyCustomRule(ruleId) {
    if (!this.customRulesManager) {
      return { success: false, error: 'CustomRulesManager not available' };
    }

    const rule = await this.customRulesManager.getRule(ruleId);
    if (!rule) {
      return { success: false, error: `Rule not found: ${ruleId}` };
    }

    const parsedData = await this.parseCurrentPage({ customRuleId: ruleId });

    return {
      success: true,
      rule: rule,
      result: parsedData
    };
  }

  async saveSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ smart_extractor_settings: this.settings });
    }
  }

  injectExportButton() {
    if (!this.settings.autoInjectButton) {
      return;
    }

    if (!this.settings.enabledPlatforms.includes(this.platform)) {
      return;
    }

    const buttonConfig = this.getPlatformButtonConfig();

    setTimeout(() => {
      this.createExportButton(buttonConfig);
    }, 1000);
  }

  getPlatformButtonConfig() {
    const configs = {
      csdn: {
        containerSelector: 'div.article-title-box, .title-box',
        position: 'append',
        style: 'margin-left: 10px;'
      },
      juejin: {
        containerSelector: '.article-title, .title-area',
        position: 'append',
        style: 'margin-left: 10px;'
      },
      cnblogs: {
        containerSelector: '.postTitle, #cb_post_title_url',
        position: 'after',
        style: 'margin-left: 10px;'
      },
      jianshu: {
        containerSelector: 'h1.title, .article-title',
        position: 'after',
        style: 'margin-left: 10px;'
      },
      zhihu: {
        containerSelector: '.Post-Title, .QuestionHeader-title',
        position: 'append',
        style: 'margin-left: 10px;'
      },
      segmentfault: {
        containerSelector: 'h1.article__title, .question__title',
        position: 'append',
        style: 'margin-left: 10px;'
      },
      generic: {
        containerSelector: 'h1, .title',
        position: 'after',
        style: 'margin-left: 10px;'
      }
    };

    return configs[this.platform] || configs.generic;
  }

  createExportButton(config) {
    const container = document.querySelector(config.containerSelector);
    if (!container) {
      console.log('Smart Article Extractor: Could not find button container');
      return;
    }

    const existingButton = document.getElementById('smart-article-export-btn');
    if (existingButton) {
      return;
    }

    const button = document.createElement('button');
    button.id = 'smart-article-export-btn';
    button.innerHTML = '📄 导出文章';
    button.style.cssText = `
      ${config.style}
      padding: 6px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
      transition: all 0.2s ease;
    `;

    button.onmouseenter = () => {
      button.style.transform = 'translateY(-1px)';
      button.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    };

    button.onmouseleave = () => {
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
    };

    button.onclick = () => this.handleExportButtonClick();

    if (config.position === 'append') {
      container.appendChild(button);
    } else if (config.position === 'after') {
      container.parentNode.insertBefore(button, container.nextSibling);
    } else if (config.position === 'prepend') {
      container.insertBefore(button, container.firstChild);
    }

    console.log('Smart Article Extractor: Export button injected');
  }

  async handleExportButtonClick() {
    this.showExportMenu();
  }

  showExportMenu() {
    const existingMenu = document.getElementById('smart-article-export-menu');
    if (existingMenu) {
      existingMenu.remove();
      return;
    }

    const button = document.getElementById('smart-article-export-btn');
    if (!button) return;

    const menu = document.createElement('div');
    menu.id = 'smart-article-export-menu';
    menu.style.cssText = `
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 5px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 100000;
      min-width: 180px;
      overflow: hidden;
    `;

    const menuItems = [
      { id: 'copy-md', label: '📋 复制为 Markdown', action: () => this.copyToClipboard() },
      { id: 'export-md', label: '💾 保存为 Markdown', action: () => this.exportContent('markdown') },
      { id: 'export-html', label: '🌐 保存为 HTML', action: () => this.exportContent('html') },
      { id: 'export-txt', label: '📄 保存为 TXT', action: () => this.exportContent('txt') },
      { id: 'reading-mode', label: '📖 阅读模式', action: () => this.enableReadingMode() },
      { id: 'add-batch', label: '📦 添加到批量队列', action: () => this.addToBatchQueue({}) }
    ];

    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.style.cssText = `
        padding: 12px 16px;
        cursor: pointer;
        transition: background 0.2s;
        font-size: 14px;
        color: #333;
      `;
      menuItem.innerHTML = item.label;

      menuItem.onmouseenter = () => {
        menuItem.style.background = '#f5f5f5';
      };
      menuItem.onmouseleave = () => {
        menuItem.style.background = 'white';
      };
      menuItem.onclick = async () => {
        menu.remove();
        try {
          await item.action();
          this.showToast('操作成功!');
        } catch (error) {
          this.showToast('操作失败: ' + error.message, 'error');
        }
      };

      menu.appendChild(menuItem);
    });

    button.parentNode.style.position = 'relative';
    button.parentNode.appendChild(menu);

    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target) && !button.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
  }

  showToast(message, type = 'success') {
    const existingToast = document.getElementById('smart-article-toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'smart-article-toast';
    toast.innerHTML = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 24px;
      background: ${type === 'error' ? '#ef4444' : '#10b981'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      z-index: 100001;
      font-size: 14px;
      font-weight: 500;
      animation: smartArticleFadeIn 0.3s ease;
    `;

    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes smartArticleFadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes smartArticleFadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-10px); }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'smartArticleFadeOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  handleParseEvent(detail) {
    this.parseCurrentPage(detail?.options)
      .then(result => {
        document.dispatchEvent(new CustomEvent('smart-extractor-parse-complete', {
          detail: result
        }));
      })
      .catch(error => {
        document.dispatchEvent(new CustomEvent('smart-extractor-parse-error', {
          detail: { error: error.message }
        }));
      });
  }
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.smartArticleExtractor = new ContentScriptManager();
    });
  } else {
    window.smartArticleExtractor = new ContentScriptManager();
  }
}
