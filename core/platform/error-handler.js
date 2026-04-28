var ErrorHandler = function(options) {
  var opts = options || {};
  this.options = {
    maxRetries: opts.maxRetries !== undefined ? opts.maxRetries : 3,
    retryDelay: opts.retryDelay !== undefined ? opts.retryDelay : 1000,
    maxRetryDelay: opts.maxRetryDelay !== undefined ? opts.maxRetryDelay : 30000,
    backoffMultiplier: opts.backoffMultiplier !== undefined ? opts.backoffMultiplier : 2,
    timeout: opts.timeout !== undefined ? opts.timeout : 30000
  };

  this.retryableErrors = [
    'NetworkError',
    'TimeoutError',
    'ConnectionError',
    'FetchError',
    'AbortError',
    'Network request failed',
    'Failed to fetch',
    'net::ERR_'
  ];

  this.errorLog = [];
  this.maxLogSize = 1000;
  this.listeners = {};
};

ErrorHandler.prototype.on = function(event, callback) {
  if (!this.listeners[event]) {
    this.listeners[event] = [];
  }
  this.listeners[event].push(callback);
};

ErrorHandler.prototype.off = function(event, callback) {
  if (!this.listeners[event]) return;
  this.listeners[event] = this.listeners[event].filter(function(cb) { return cb !== callback; });
};

ErrorHandler.prototype.emit = function(event, data) {
  if (!this.listeners[event]) return;
  var listeners = this.listeners[event];
  for (var i = 0; i < listeners.length; i++) {
    listeners[i](data);
  }
};

ErrorHandler.prototype.executeWithRetry = function(fn, options) {
  var self = this;
  var opts = options || {};
  
  var maxRetries = opts.maxRetries !== undefined ? opts.maxRetries : this.options.maxRetries;
  var retryDelay = opts.retryDelay !== undefined ? opts.retryDelay : this.options.retryDelay;
  var backoffMultiplier = opts.backoffMultiplier !== undefined ? opts.backoffMultiplier : this.options.backoffMultiplier;
  var shouldRetry = opts.shouldRetry || this.isRetryableError.bind(this);

  return new Promise(function(resolve) {
    var lastError = null;
    var currentDelay = retryDelay;
    var attempt = 0;

    function tryExecute() {
      Promise.resolve(fn()).then(function(result) {
        resolve({
          success: true,
          result: result,
          attempts: attempt + 1
        });
      }).catch(function(error) {
        lastError = error;
        var errorInfo = self.normalizeError(error);

        self.logError({
          error: errorInfo,
          attempt: attempt + 1,
          totalAttempts: maxRetries + 1,
          context: opts.context
        });

        self.emit('error', {
          error: errorInfo,
          attempt: attempt + 1,
          willRetry: attempt < maxRetries && shouldRetry(errorInfo)
        });

        if (attempt >= maxRetries || !shouldRetry(errorInfo)) {
          resolve({
            success: false,
            error: self.normalizeError(lastError),
            attempts: maxRetries + 1
          });
          return;
        }

        self.emit('retryScheduled', {
          delay: currentDelay,
          attempt: attempt + 1,
          nextAttempt: attempt + 2
        });

        attempt++;
        self.sleep(currentDelay).then(function() {
          currentDelay = Math.min(currentDelay * backoffMultiplier, self.options.maxRetryDelay);
          tryExecute();
        });
      });
    }

    tryExecute();
  });
};

ErrorHandler.prototype.isRetryableError = function(error) {
  if (!error) return false;

  var errorMessage = '';
  if (error.message) {
    errorMessage = error.message.toLowerCase();
  } else if (error.name) {
    errorMessage = error.name.toLowerCase();
  } else {
    errorMessage = String(error).toLowerCase();
  }

  for (var i = 0; i < this.retryableErrors.length; i++) {
    if (errorMessage.indexOf(this.retryableErrors[i].toLowerCase()) !== -1) {
      return true;
    }
  }

  if (error.name) {
    var retryableNames = ['TimeoutError', 'NetworkError', 'AbortError', 'TypeError'];
    for (var j = 0; j < retryableNames.length; j++) {
      if (error.name === retryableNames[j]) {
        return true;
      }
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
};

ErrorHandler.prototype.normalizeError = function(error) {
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
};

ErrorHandler.prototype.logError = function(errorEntry) {
  var entry = {
    id: this.generateId(),
    timestamp: Date.now()
  };
  
  for (var key in errorEntry) {
    if (errorEntry.hasOwnProperty(key)) {
      entry[key] = errorEntry[key];
    }
  }

  this.errorLog.push(entry);

  if (this.errorLog.length > this.maxLogSize) {
    this.errorLog = this.errorLog.slice(-Math.floor(this.maxLogSize / 2));
  }

  this.emit('errorLogged', entry);
};

ErrorHandler.prototype.getErrorLog = function(options) {
  var opts = options || {};
  var log = [];
  
  for (var i = 0; i < this.errorLog.length; i++) {
    log.push(this.errorLog[i]);
  }

  if (opts.since) {
    log = log.filter(function(entry) {
      return entry.timestamp >= opts.since;
    });
  }

  if (opts.errorType) {
    log = log.filter(function(entry) {
      return entry.error && entry.error.name === opts.errorType;
    });
  }

  if (opts.limit) {
    log = log.slice(-opts.limit);
  }

  return log;
};

ErrorHandler.prototype.clearErrorLog = function() {
  var oldLog = [];
  for (var i = 0; i < this.errorLog.length; i++) {
    oldLog.push(this.errorLog[i]);
  }
  this.errorLog = [];
  this.emit('errorLogCleared', { count: oldLog.length });
  return oldLog;
};

ErrorHandler.prototype.sleep = function(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
};

ErrorHandler.prototype.generateId = function() {
  return 'err_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

ErrorHandler.prototype.wrapForErrorHandling = function(fn, options) {
  var self = this;
  return function() {
    var args = arguments;
    return self.executeWithRetry(function() {
      return fn.apply(null, args);
    }, options);
  };
};

ErrorHandler.prototype.createSafeWrapper = function(options) {
  var self = this;
  return {
    wrap: function(fn) { return self.wrapForErrorHandling(fn, options); },
    execute: function(fn) { return self.executeWithRetry(fn, options); },
    log: function(error, context) { return self.logError({ error: error, context: context }); },
    getErrors: function(opts) { return self.getErrorLog(opts); },
    clearErrors: function() { return self.clearErrorLog(); }
  };
};

var SilentParser = function(options) {
  var opts = options || {};
  this.options = {
    maxConcurrent: opts.maxConcurrent !== undefined ? opts.maxConcurrent : 2,
    requestTimeout: opts.requestTimeout !== undefined ? opts.requestTimeout : 30000,
    rateLimit: opts.rateLimit !== undefined ? opts.rateLimit : 1000
  };

  this.parser = opts.parser;
  this.enhancer = opts.enhancer;
  this.errorHandler = new ErrorHandler();
  this.queue = [];
  this.processing = false;
  this.results = {};
};

SilentParser.prototype.parseSilently = function(doc, url, options) {
  var self = this;
  var opts = options || {};
  
  return this.errorHandler.executeWithRetry(
    function() {
      if (!self.parser) {
        throw new Error('Parser not initialized');
      }
      return self.parser.parse(doc, url, opts.customRules);
    },
    {
      maxRetries: opts.maxRetries !== undefined ? opts.maxRetries : self.options.maxRetries,
      context: { url: url, operation: 'parse' }
    }
  ).then(function(result) {
    if (result.success && self.enhancer) {
      try {
        result.result = self.enhancer.enhance(result.result);
      } catch (enhanceError) {
        console.warn('Content enhancement failed:', enhanceError);
      }
    }
    return result;
  });
};

SilentParser.prototype.parseUrlSilently = function(url, options) {
  var self = this;
  var opts = options || {};
  
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    return Promise.resolve({
      success: false,
      error: {
        name: 'EnvironmentError',
        message: 'Chrome tabs API not available'
      }
    });
  }

  return this.errorHandler.executeWithRetry(
    function() {
      return new Promise(function(resolve, reject) {
        var timeout = setTimeout(function() {
          reject(new Error('Parse request timeout'));
        }, self.options.requestTimeout);

        chrome.tabs.query({ url: url }, function(tabs) {
          clearTimeout(timeout);

          if (tabs.length === 0) {
            reject(new Error('Tab not found for URL: ' + url));
            return;
          }

          try {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: function() {
                return {
                  title: document.title,
                  url: window.location.href,
                  html: document.documentElement.outerHTML
                };
              }
            }, function(results) {
              if (!results || results.length === 0) {
                reject(new Error('Failed to execute script'));
                return;
              }
              resolve(results[0].result);
            });
          } catch (scriptError) {
            reject(scriptError);
          }
        });
      });
    },
    {
      maxRetries: opts.maxRetries !== undefined ? opts.maxRetries : self.options.maxRetries,
      context: { url: url, operation: 'fetchPage' }
    }
  );
};

SilentParser.prototype.addToParseQueue = function(url, options) {
  var queueItem = {
    id: this.generateId(),
    url: url,
    options: options || {},
    status: 'queued',
    addedAt: Date.now(),
    startedAt: null,
    completedAt: null,
    result: null,
    error: null
  };

  this.queue.push(queueItem);
  return queueItem;
};

SilentParser.prototype.processQueue = function(options) {
  var self = this;
  var opts = options || {};
  
  if (this.processing) {
    return Promise.resolve({ success: false, error: 'Already processing queue' });
  }

  this.processing = true;
  var concurrent = opts.concurrent !== undefined ? opts.concurrent : this.options.maxConcurrent;
  
  var pendingItems = [];
  for (var i = 0; i < this.queue.length; i++) {
    if (this.queue[i].status === 'queued') {
      pendingItems.push(this.queue[i]);
    }
  }

  var processItem = function(item) {
    item.status = 'processing';
    item.startedAt = Date.now();

    return self.parseUrlSilently(item.url, item.options).then(function(result) {
      item.status = result.success ? 'completed' : 'failed';
      item.result = result.success ? result.result : null;
      item.error = result.success ? null : result.error;

      if (result.success) {
        self.results[item.id] = result.result;
      }
    }).catch(function(error) {
      item.status = 'failed';
      item.error = self.errorHandler.normalizeError(error);
    }).finally(function() {
      item.completedAt = Date.now();
      return item;
    });
  };

  var runWorker = function(items) {
    return new Promise(function(resolve) {
      var index = 0;
      
      function next() {
        if (index >= items.length) {
          resolve();
          return;
        }
        
        var item = items[index];
        index++;
        
        if (item.status === 'queued') {
          processItem(item).then(function() {
            return self.errorHandler.sleep(self.options.rateLimit);
          }).then(next);
        } else {
          next();
        }
      }
      
      next();
    });
  };

  var workers = [];
  var itemsPerWorker = Math.ceil(pendingItems.length / concurrent);
  
  for (var w = 0; w < concurrent; w++) {
    var start = w * itemsPerWorker;
    var end = Math.min(start + itemsPerWorker, pendingItems.length);
    var workerItems = pendingItems.slice(start, end);
    workers.push(runWorker(workerItems));
  }

  return Promise.all(workers).then(function() {
    self.processing = false;
    
    var completed = 0;
    var failed = 0;
    for (var i = 0; i < self.queue.length; i++) {
      if (self.queue[i].status === 'completed') completed++;
      if (self.queue[i].status === 'failed') failed++;
    }

    return {
      success: true,
      total: pendingItems.length,
      completed: completed,
      failed: failed,
      results: self.results
    };
  });
};

SilentParser.prototype.getQueueStatus = function() {
  var queued = 0;
  var processing = 0;
  var completed = 0;
  var failed = 0;
  var resultsCount = 0;
  
  for (var i = 0; i < this.queue.length; i++) {
    var item = this.queue[i];
    if (item.status === 'queued') queued++;
    else if (item.status === 'processing') processing++;
    else if (item.status === 'completed') completed++;
    else if (item.status === 'failed') failed++;
  }
  
  for (var key in this.results) {
    if (this.results.hasOwnProperty(key)) {
      resultsCount++;
    }
  }

  return {
    processing: this.processing,
    queueLength: this.queue.length,
    queued: queued,
    processing: processing,
    completed: completed,
    failed: failed,
    resultsCount: resultsCount
  };
};

SilentParser.prototype.getResult = function(id) {
  return this.results[id] || null;
};

SilentParser.prototype.clearQueue = function() {
  if (this.processing) {
    return false;
  }
  this.queue = [];
  this.results = {};
  return true;
};

SilentParser.prototype.generateId = function() {
  return 'parse_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

var SiteCompatibilityLayer = function(options) {
  var opts = options || {};
  this.options = {
    fallbackEnabled: opts.fallbackEnabled !== false,
    adaptiveParsing: opts.adaptiveParsing !== false
  };

  this.siteStrategies = {};
  this.fallbackStrategy = this.createFallbackStrategy();
  this.errorHandler = new ErrorHandler();

  this.initDefaultStrategies();
};

SiteCompatibilityLayer.prototype.initDefaultStrategies = function() {
  this.registerStrategy('csdn', {
    name: 'CSDN',
    selectors: {
      title: ['h1.title-article', '.article-title'],
      content: ['#article_content', '.markdown_views'],
      adBlocks: ['.recommend-item-box', '.ad-box']
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
};

SiteCompatibilityLayer.prototype.registerStrategy = function(site, config) {
  this.siteStrategies[site] = {
    id: site,
    registeredAt: Date.now()
  };
  
  for (var key in config) {
    if (config.hasOwnProperty(key)) {
      this.siteStrategies[site][key] = config[key];
    }
  }
};

SiteCompatibilityLayer.prototype.getStrategy = function(site) {
  return this.siteStrategies[site] || this.fallbackStrategy;
};

SiteCompatibilityLayer.prototype.createFallbackStrategy = function() {
  return {
    name: 'Fallback',
    selectors: {
      title: ['h1', 'title', '.title', '.article-title'],
      content: ['article', '.article-content', '.post-content', '#content', 'body'],
      adBlocks: ['.ad', '.ads', '.advertisement']
    },
    specialHandling: ['generic']
  };
};

SiteCompatibilityLayer.prototype.detectSite = function(url) {
  var sitePatterns = [
    { site: 'csdn', patterns: ['blog.csdn.net'] },
    { site: 'juejin', patterns: ['juejin.cn', 'juejin.im'] },
    { site: 'zhihu', patterns: ['zhihu.com', 'zhuanlan.zhihu.com'] },
    { site: 'cnblogs', patterns: ['cnblogs.com'] },
    { site: 'jianshu', patterns: ['jianshu.com'] },
    { site: 'segmentfault', patterns: ['segmentfault.com'] }
  ];

  for (var i = 0; i < sitePatterns.length; i++) {
    var sp = sitePatterns[i];
    for (var j = 0; j < sp.patterns.length; j++) {
      if (url.indexOf(sp.patterns[j]) !== -1) {
        return sp.site;
      }
    }
  }

  return 'generic';
};

SiteCompatibilityLayer.prototype.parseWithFallback = function(doc, url, options) {
  var self = this;
  var opts = options || {};
  
  var site = this.detectSite(url);
  var strategy = this.getStrategy(site);

  var result = {
    site: site,
    strategyUsed: strategy.name,
    success: false,
    result: null,
    error: null,
    attempts: []
  };

  return Promise.resolve().then(function() {
    var processedDoc = doc;

    if (strategy.preProcess) {
      try {
        processedDoc = strategy.preProcess(doc.cloneNode(true));
        result.attempts.push({ step: 'preProcess', success: true });
      } catch (preError) {
        result.attempts.push({ step: 'preProcess', success: false, error: preError.message });
      }
    }

    if (opts.parser) {
      return opts.parser.parse(processedDoc, url).then(function(parseResult) {
        result.result = parseResult;
        result.success = parseResult.success;

        if (result.success) {
          result.attempts.push({ step: 'parse', success: true });
        } else {
          result.attempts.push({ step: 'parse', success: false, error: parseResult.error });
        }
        return parseResult;
      });
    }
    return null;
  }).then(function(parseResult) {
    if (strategy.specialHandling && opts.parser) {
      for (var i = 0; i < strategy.specialHandling.length; i++) {
        var handling = strategy.specialHandling[i];
        try {
          self.applySpecialHandling(doc, handling, opts);
          result.attempts.push({ step: 'specialHandling:' + handling, success: true });
        } catch (handleError) {
          result.attempts.push({ step: 'specialHandling:' + handling, success: false, error: handleError.message });
        }
      }
    }
    return result;
  }).catch(function(error) {
    result.error = self.errorHandler.normalizeError(error);

    if (self.options.fallbackEnabled && strategy.name !== 'Fallback') {
      result.attempts.push({ step: 'fallback', message: 'Attempting fallback strategy' });

      return self.parseWithFallback(doc, url, {
        parser: opts.parser,
        forceFallback: true
      }).then(function(fallbackResult) {
        if (fallbackResult.success) {
          result.result = fallbackResult.result;
          result.success = true;
          result.strategyUsed = 'Fallback';
          result.attempts.push({ step: 'fallback', success: true });
        }
        return result;
      }).catch(function(fallbackError) {
        result.attempts.push({ step: 'fallback', success: false, error: fallbackError.message });
        return result;
      });
    }
    
    return result;
  });
};

SiteCompatibilityLayer.prototype.applySpecialHandling = function(doc, handlingType, options) {
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
};

SiteCompatibilityLayer.prototype.handleDynamicContent = function(doc) {
  var lazyElements = doc.querySelectorAll('[data-src], [data-original], [data-lazy]');

  for (var i = 0; i < lazyElements.length; i++) {
    var el = lazyElements[i];
    var dataSrc = el.getAttribute('data-src');
    var dataOriginal = el.getAttribute('data-original');
    var dataLazy = el.getAttribute('data-lazy');

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
  }

  return doc;
};

SiteCompatibilityLayer.prototype.handleLazyImages = function(doc) {
  var images = doc.querySelectorAll('img');

  for (var i = 0; i < images.length; i++) {
    var img = images[i];
    var sources = [
      img.getAttribute('data-src'),
      img.getAttribute('data-original'),
      img.getAttribute('data-lazy'),
      img.getAttribute('data-srcset') ? img.getAttribute('data-srcset').split(' ')[0] : null
    ];

    for (var j = 0; j < sources.length; j++) {
      var src = sources[j];
      if (src && src.length > 0) {
        if (!img.src || img.src.indexOf('placeholder') !== -1) {
          img.src = src;
        }
        break;
      }
    }
  }

  return doc;
};

SiteCompatibilityLayer.prototype.handleCodeHighlight = function(doc) {
  var codeBlocks = doc.querySelectorAll('pre, code');

  for (var i = 0; i < codeBlocks.length; i++) {
    var block = codeBlocks[i];
    if (block.style && !block.style.whiteSpace) {
      block.style.whiteSpace = 'pre-wrap';
    }
  }

  return doc;
};

SiteCompatibilityLayer.prototype.getRegisteredSites = function() {
  var sites = [];
  for (var key in this.siteStrategies) {
    if (this.siteStrategies.hasOwnProperty(key)) {
      sites.push(key);
    }
  }
  return sites;
};

SiteCompatibilityLayer.prototype.getSiteInfo = function(site) {
  return this.siteStrategies[site] || null;
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ErrorHandler: ErrorHandler,
    SilentParser: SilentParser,
    SiteCompatibilityLayer: SiteCompatibilityLayer
  };
}
