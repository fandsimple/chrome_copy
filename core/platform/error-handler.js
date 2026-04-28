class ErrorHandler {
  constructor(options = {}) {
    this.options = {
      maxRetries: 3,
      retryDelay: 1000,
      maxRetryDelay: 30000,
      backoffMultiplier: 2,
      timeout: 30000,
      ...options
    };

    this.retryableErrors = new Set([
      'NetworkError',
      'TimeoutError',
      'ConnectionError',
      'FetchError',
      'AbortError',
      'Network request failed',
      'Failed to fetch',
      'net::ERR_'
    ]);

    this.errorLog = [];
    this.maxLogSize = 1000;
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(data));
  }

  async executeWithRetry(fn, options = {}) {
    const maxRetries = options.maxRetries ?? this.options.maxRetries;
    const retryDelay = options.retryDelay ?? this.options.retryDelay;
    const backoffMultiplier = options.backoffMultiplier ?? this.options.backoffMultiplier;
    const shouldRetry = options.shouldRetry || this.isRetryableError.bind(this);

    let lastError = null;
    let currentDelay = retryDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        return {
          success: true,
          result: result,
          attempts: attempt + 1
        };
      } catch (error) {
        lastError = error;
        const errorInfo = this.normalizeError(error);

        this.logError({
          error: errorInfo,
          attempt: attempt + 1,
          totalAttempts: maxRetries + 1,
          context: options.context
        });

        this.emit('error', {
          error: errorInfo,
          attempt: attempt + 1,
          willRetry: attempt < maxRetries && shouldRetry(errorInfo)
        });

        if (attempt >= maxRetries || !shouldRetry(errorInfo)) {
          break;
        }

        this.emit('retryScheduled', {
          delay: currentDelay,
          attempt: attempt + 1,
          nextAttempt: attempt + 2
        });

        await this.sleep(currentDelay);
        currentDelay = Math.min(currentDelay * backoffMultiplier, this.options.maxRetryDelay);
      }
    }

    return {
      success: false,
      error: this.normalizeError(lastError),
      attempts: maxRetries + 1
    };
  }

  isRetryableError(error) {
    if (!error) return false;

    const errorMessage = (error.message || error.name || String(error)).toLowerCase();

    for (const retryable of this.retryableErrors) {
      if (errorMessage.includes(retryable.toLowerCase())) {
        return true;
      }
    }

    if (error.name) {
      if (['TimeoutError', 'NetworkError', 'AbortError', 'TypeError'].includes(error.name)) {
        return true;
      }
    }

    if (error.status) {
      if (error.status >= 500 && error.status < 600) {
        return true;
      }
      if (error.status === 429) {
        return true;
      }
    }

    return false;
  }

  normalizeError(error) {
    if (!error) {
      return {
        name: 'UnknownError',
        message: 'An unknown error occurred',
        timestamp: Date.now()
      };
    }

    if (typeof error === 'string') {
      return {
        name: 'Error',
        message: error,
        timestamp: Date.now()
      };
    }

    return {
      name: error.name || 'Error',
      message: error.message || String(error),
      stack: error.stack,
      status: error.status,
      statusText: error.statusText,
      code: error.code,
      timestamp: Date.now()
    };
  }

  logError(errorEntry) {
    const entry = {
      id: this.generateId(),
      ...errorEntry,
      timestamp: Date.now()
    };

    this.errorLog.push(entry);

    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize / 2);
    }

    this.emit('errorLogged', entry);
  }

  getErrorLog(options = {}) {
    let log = [...this.errorLog];

    if (options.since) {
      log = log.filter(entry => entry.timestamp >= options.since);
    }

    if (options.errorType) {
      log = log.filter(entry => 
        entry.error?.name === options.errorType);
    }

    if (options.limit) {
      log = log.slice(-options.limit);
    }

    return log;
  }

  clearErrorLog() {
    const oldLog = [...this.errorLog];
    this.errorLog = [];
    this.emit('errorLogCleared', { count: oldLog.length });
    return oldLog;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateId() {
    return 'err_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  wrapForErrorHandling(fn, options = {}) {
    return async (...args) => {
      return this.executeWithRetry(() => fn(...args), options);
    };
  }

  createSafeWrapper(options = {}) {
    return {
      wrap: (fn) => this.wrapForErrorHandling(fn, options),
      execute: (fn) => this.executeWithRetry(fn, options),
      log: (error, context) => this.logError({ error, context }),
      getErrors: (opts) => this.getErrorLog(opts),
      clearErrors: () => this.clearErrorLog()
    };
  }
}

class SilentParser {
  constructor(options = {}) {
    this.options = {
      maxConcurrent: 2,
      requestTimeout: 30000,
      rateLimit: 1000,
      ...options
    };

    this.parser = options.parser;
    this.enhancer = options.enhancer;
    this.errorHandler = new ErrorHandler();
    this.queue = [];
    this.processing = false;
    this.results = new Map();
  }

  async parseSilently(doc, url, options = {}) {
    const result = await this.errorHandler.executeWithRetry(
      async () => {
        if (!this.parser) {
          throw new Error('Parser not initialized');
        }

        return this.parser.parse(doc, url, options.customRules);
      },
      {
        maxRetries: options.maxRetries ?? this.options.maxRetries,
        context: { url, operation: 'parse' }
      }
    );

    if (result.success && this.enhancer) {
      try {
        result.result = this.enhancer.enhance(result.result);
      } catch (enhanceError) {
        console.warn('Content enhancement failed:', enhanceError);
      }
    }

    return result;
  }

  async parseUrlSilently(url, options = {}) {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      return {
        success: false,
        error: {
          name: 'EnvironmentError',
          message: 'Chrome tabs API not available'
        }
      };
    }

    return this.errorHandler.executeWithRetry(
      async () => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Parse request timeout'));
          }, this.options.requestTimeout);

          chrome.tabs.query({ url: url }, async (tabs) => {
            clearTimeout(timeout);

            if (tabs.length === 0) {
              reject(new Error(`Tab not found for URL: ${url}`));
              return;
            }

            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: (parserOptions => {
                  return {
                    title: document.title,
                    url: window.location.href,
                    html: document.documentElement.outerHTML
                  };
                },
                args: [options]
              });

              if (!results || results.length === 0) {
                reject(new Error('Failed to execute script'));
                return;
              }

              const tabData = results[0].result;
              resolve(tabData);
            } catch (scriptError) {
              reject(scriptError);
            }
          });
        });
      },
      {
        maxRetries: options.maxRetries ?? this.options.maxRetries,
        context: { url, operation: 'fetchPage' }
      }
    );
  }

  addToParseQueue(url, options = {}) {
    const queueItem = {
      id: this.generateId(),
      url: url,
      options: options,
      status: 'queued',
      addedAt: Date.now(),
      startedAt: null,
      completedAt: null,
      result: null,
      error: null
    };

    this.queue.push(queueItem);
    return queueItem;
  }

  async processQueue(options = {}) {
    if (this.processing) {
      return { success: false, error: 'Already processing queue' };
    }

    this.processing = true;
    const concurrent = options.concurrent ?? this.options.maxConcurrent;
    const pendingItems = this.queue.filter(item => item.status === 'queued');

    const processItem = async (item) => {
      item.status = 'processing';
      item.startedAt = Date.now();

      try {
        const result = await this.parseUrlSilently(item.url, item.options);
        item.status = result.success ? 'completed' : 'failed';
        item.result = result.success ? result.result : null;
        item.error = result.success ? null : result.error;

        if (result.success) {
          this.results.set(item.id, result.result);
        }
      } catch (error) {
        item.status = 'failed';
        item.error = this.errorHandler.normalizeError(error);
      }

      item.completedAt = Date.now();
      return item;
    };

    const workers = [];
    for (let i = 0; i < concurrent; i++) {
      workers.push(this.runWorker(pendingItems, processItem));
    }

    await Promise.all(workers);
    this.processing = false;

    const completed = this.queue.filter(i => i.status === 'completed').length;
    const failed = this.queue.filter(i => i.status === 'failed').length;

    return {
      success: true,
      total: pendingItems.length,
      completed,
      failed,
      results: Object.fromEntries(this.results)
    };
  }

  async runWorker(items, processItem) {
    for (const item of items) {
      if (item.status === 'queued') {
        await processItem(item);
        await this.errorHandler.sleep(this.options.rateLimit);
      }
    }
  }

  getQueueStatus() {
    return {
      processing: this.processing,
      queueLength: this.queue.length,
      queued: this.queue.filter(i => i.status === 'queued').length,
      processing: this.queue.filter(i => i.status === 'processing').length,
      completed: this.queue.filter(i => i.status === 'completed').length,
      failed: this.queue.filter(i => i.status === 'failed').length,
      resultsCount: this.results.size
    };
  }

  getResult(id) {
    return this.results.get(id);
  }

  clearQueue() {
    if (this.processing) {
      return false;
    }
    this.queue = [];
    this.results.clear();
    return true;
  }

  generateId() {
    return 'parse_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

class SiteCompatibilityLayer {
  constructor(options = {}) {
    this.options = {
      fallbackEnabled: true,
      adaptiveParsing: true,
      ...options
    };

    this.siteStrategies = new Map();
    this.fallbackStrategy = this.createFallbackStrategy();
    this.errorHandler = new ErrorHandler();

    this.initDefaultStrategies();
  }

  initDefaultStrategies() {
    this.registerStrategy('csdn', {
      name: 'CSDN',
      selectors: {
        title: ['h1.title-article', '.article-title'],
        content: ['#article_content', '.markdown_views'],
        adBlocks: ['.recommend-item-box', '.ad-box']
      },
      preProcess: (doc) => {
        const paywall = doc.querySelector('.hide-preCode-box, .vip-content, .need-login');
        if (paywall) {
          paywall.classList.remove('hide-preCode-box', 'vip-content', 'need-login');
        }
        return doc;
      },
      specialHandling: ['dynamicContent', 'codeHighlight']
    });

    this.registerStrategy('juejin', {
      name: '掘金',
      selectors: {
        title: ['h1.article-title'],
        content: ['.article-content', '.markdown-body'],
        adBlocks: ['.recommend-list', '.sidebar-block']
      },
      specialHandling: ['codeHighlight', 'lazyImages']
    });

    this.registerStrategy('zhihu', {
      name: '知乎',
      selectors: {
        title: ['.Post-Title', '.QuestionHeader-title'],
        content: ['.RichContent-inner', '.Post-RichText'],
        adBlocks: ['.Pc-word-card', '.AdblockBanner']
      },
      specialHandling: ['dynamicContent', 'lazyImages']
    });

    this.registerStrategy('cnblogs', {
      name: '博客园',
      selectors: {
        title: ['#cb_post_title_url', '.postTitle'],
        content: ['#cnblogs_post_body'],
        adBlocks: ['.ad_text', '#ad_text_under_commentbox']
      },
      specialHandling: ['codeHighlight']
    });

    this.registerStrategy('jianshu', {
      name: '简书',
      selectors: {
        title: ['h1.title'],
        content: ['.article', '._2rhmJa'],
        adBlocks: ['.recommend-collection', '.note-bottom-ad']
      },
      specialHandling: ['dynamicContent']
    });
  }

  registerStrategy(site, config) {
    this.siteStrategies.set(site, {
      ...config,
      id: site,
      registeredAt: Date.now()
    });
  }

  getStrategy(site) {
    return this.siteStrategies.get(site) || this.fallbackStrategy;
  }

  createFallbackStrategy() {
    return {
      name: 'Fallback',
      selectors: {
        title: ['h1', 'title', '.title', '.article-title'],
        content: ['article', '.article-content', '.post-content', '#content', 'body'],
        adBlocks: ['.ad', '.ads', '.advertisement']
      },
      specialHandling: ['generic']
    };
  }

  detectSite(url) {
    const sitePatterns = [
      { site: 'csdn', patterns: ['blog.csdn.net'] },
      { site: 'juejin', patterns: ['juejin.cn', 'juejin.im'] },
      { site: 'zhihu', patterns: ['zhihu.com', 'zhuanlan.zhihu.com'] },
      { site: 'cnblogs', patterns: ['cnblogs.com'] },
      { site: 'jianshu', patterns: ['jianshu.com'] },
      { site: 'segmentfault', patterns: ['segmentfault.com'] }
    ];

    for (const { site, patterns } of sitePatterns) {
      for (const pattern of patterns) {
        if (url.includes(pattern)) {
          return site;
        }
      }
    }

    return 'generic';
  }

  async parseWithFallback(doc, url, options = {}) {
    const site = this.detectSite(url);
    const strategy = this.getStrategy(site);

    const result = {
      site: site,
      strategyUsed: strategy.name,
      success: false,
      result: null,
      error: null,
      attempts: []
    };

    try {
      let processedDoc = doc;

      if (strategy.preProcess) {
        try {
          processedDoc = strategy.preProcess(doc.cloneNode(true));
          result.attempts.push({ step: 'preProcess', success: true });
        } catch (preError) {
          result.attempts.push({ step: 'preProcess', success: false, error: preError.message });
        }
      }

      if (options.parser) {
        const parseResult = await options.parser.parse(processedDoc, url);
        result.result = parseResult;
        result.success = parseResult.success;

        if (result.success) {
          result.attempts.push({ step: 'parse', success: true });
        } else {
          result.attempts.push({ step: 'parse', success: false, error: parseResult.error });
        }
      }

      if (strategy.specialHandling && options.parser) {
        for (const handling of strategy.specialHandling) {
        try {
          await this.applySpecialHandling(processedDoc, handling, options);
          result.attempts.push({ step: `specialHandling:${handling}`, success: true });
        } catch (handleError) {
          result.attempts.push({ step: `specialHandling:${handling}`, success: false, error: handleError.message });
        }
      }

    } catch (error) {
      result.error = this.errorHandler.normalizeError(error);

      if (this.options.fallbackEnabled && strategy.name !== 'Fallback') {
        result.attempts.push({ step: 'fallback', message: 'Attempting fallback strategy' });

        try {
          const fallbackResult = await this.parseWithFallback(doc, url, {
            ...options,
            forceFallback: true
          });
          if (fallbackResult.success) {
            result.result = fallbackResult.result;
            result.success = true;
            result.strategyUsed = 'Fallback';
            result.attempts.push({ step: 'fallback', success: true });
          }
        } catch (fallbackError) {
          result.attempts.push({ step: 'fallback', success: false, error: fallbackError.message });
        }
      }
    }

    return result;
  }

  async applySpecialHandling(doc, handlingType, options) {
    switch (handlingType) {
      case 'dynamicContent':
        return this.handleDynamicContent(doc);
      case 'lazyImages':
        return this.handleLazyImages(doc);
      case 'codeHighlight':
        return this.handleCodeHighlight(doc);
      default:
        return doc;
    }
  }

  handleDynamicContent(doc) {
    const lazyElements = doc.querySelectorAll('[data-src], [data-original], [data-lazy]');

    lazyElements.forEach(el => {
      const dataSrc = el.getAttribute('data-src');
      const dataOriginal = el.getAttribute('data-original');
      const dataLazy = el.getAttribute('data-lazy');

      if (dataSrc && !el.src) {
        el.src = dataSrc;
      }
      if (dataOriginal && !el.src) {
        el.src = dataOriginal;
      }
      if (dataLazy && !el.src) {
        el.src = dataLazy;
      }

      el.removeAttribute('data-src');
      el.removeAttribute('data-original');
      el.removeAttribute('data-lazy');
    });

    return doc;
  }

  handleLazyImages(doc) {
    const images = doc.querySelectorAll('img');

    images.forEach(img => {
      const sources = [
        img.getAttribute('data-src'),
        img.getAttribute('data-original'),
        img.getAttribute('data-lazy'),
        img.getAttribute('data-srcset')?.split(' ')[0],
        img.dataset?.src
      ];

      for (const src of sources) {
        if (src && src.length > 0) {
          if (!img.src || img.src.includes('placeholder')) {
            img.src = src;
          }
          break;
        }
      }
    });

    return doc;
  }

  handleCodeHighlight(doc) {
    const codeBlocks = doc.querySelectorAll('pre, code');

    codeBlocks.forEach(block => {
      if (block.style && !block.style.whiteSpace) {
        block.style.whiteSpace = 'pre-wrap';
      }
    });

    return doc;
  }

  getRegisteredSites() {
    return Array.from(this.siteStrategies.keys());
  }

  getSiteInfo(site) {
    return this.siteStrategies.get(site) || null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ErrorHandler,
    SilentParser,
    SiteCompatibilityLayer
  };
}
