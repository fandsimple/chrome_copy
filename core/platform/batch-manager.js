class BatchManager {
  constructor(options = {}) {
    this.options = {
      maxConcurrent: 3,
      retryDelay: 1000,
      maxRetries: 3,
      timeout: 30000,
      ...options
    };

    this.queue = [];
    this.processing = false;
    this.results = [];
    this.errors = [];
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

  add(item) {
    const queueItem = {
      id: this.generateId(),
      ...item,
      status: 'pending',
      retries: 0,
      error: null,
      result: null,
      addedAt: Date.now(),
      startedAt: null,
      completedAt: null
    };

    this.queue.push(queueItem);
    this.emit('itemAdded', queueItem);
    return queueItem;
  }

  addBatch(items) {
    const addedItems = [];
    for (const item of items) {
      addedItems.push(this.add(item));
    }
    this.emit('batchAdded', addedItems);
    return addedItems;
  }

  async process(options = {}) {
    if (this.processing) {
      return { success: false, error: 'Already processing' };
    }

    this.processing = true;
    this.results = [];
    this.errors = [];

    this.emit('processingStarted', {
      total: this.queue.length,
      timestamp: Date.now()
    });

    const concurrent = options.concurrent || this.options.maxConcurrent;
    const processor = options.processor || this.defaultProcessor.bind(this);

    const pendingItems = this.queue.filter(item => item.status === 'pending');
    let processedCount = 0;

    const processItem = async (item) => {
      item.status = 'processing';
      item.startedAt = Date.now();
      this.emit('itemStarted', item);

      try {
        const result = await this.withRetry(
          () => processor(item),
          this.options.maxRetries,
          this.options.retryDelay
        );

        item.status = 'completed';
        item.result = result;
        item.completedAt = Date.now();
        this.results.push({ item, result });
        this.emit('itemCompleted', { item, result });

      } catch (error) {
        item.status = 'failed';
        item.error = error.message;
        item.completedAt = Date.now();
        this.errors.push({ item, error });
        this.emit('itemFailed', { item, error });
      }

      processedCount++;
      this.emit('progress', {
        processed: processedCount,
        total: pendingItems.length,
        percentage: Math.round((processedCount / pendingItems.length) * 100)
      });
    };

    const workers = [];
    for (let i = 0; i < concurrent; i++) {
      workers.push(this.runWorker(pendingItems, processItem));
    }

    await Promise.all(workers);

    this.processing = false;
    this.emit('processingCompleted', {
      total: pendingItems.length,
      completed: this.results.length,
      failed: this.errors.length,
      timestamp: Date.now()
    });

    return {
      success: true,
      total: pendingItems.length,
      completed: this.results.length,
      failed: this.errors.length,
      results: this.results,
      errors: this.errors
    };
  }

  async runWorker(items, processItem) {
    for (const item of items) {
      if (item.status === 'pending') {
        await processItem(item);
      }
    }
  }

  async withRetry(fn, maxRetries, delay) {
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          this.emit('retry', {
            attempt: attempt + 1,
            maxRetries: maxRetries,
            delay: delay,
            error: error.message
          });
          await this.sleep(delay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async defaultProcessor(item) {
    if (item.url && typeof chrome !== 'undefined' && chrome.tabs) {
      return this.processTab(item);
    }
    return item;
  }

  async processTab(item) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Processing timeout'));
      }, this.options.timeout);

      chrome.tabs.query({ url: item.url }, async (tabs) => {
        if (tabs.length > 0) {
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: () => {
                return {
                  title: document.title,
                  url: window.location.href,
                  html: document.documentElement.outerHTML
                };
              }
            });

            clearTimeout(timeout);
            resolve({
              tabId: tabs[0].id,
              ...results[0]?.result
            });
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        } else {
          clearTimeout(timeout);
          reject(new Error('Tab not found'));
        }
      });
    });
  }

  getStatus() {
    return {
      processing: this.processing,
      queueLength: this.queue.length,
      pendingCount: this.queue.filter(i => i.status === 'pending').length,
      processingCount: this.queue.filter(i => i.status === 'processing').length,
      completedCount: this.queue.filter(i => i.status === 'completed').length,
      failedCount: this.queue.filter(i => i.status === 'failed').length,
      resultsCount: this.results.length,
      errorsCount: this.errors.length
    };
  }

  getQueue(options = {}) {
    let queue = [...this.queue];

    if (options.status) {
      queue = queue.filter(i => i.status === options.status);
    }

    if (options.limit) {
      queue = queue.slice(0, options.limit);
    }

    return queue;
  }

  getItem(id) {
    return this.queue.find(item => item.id === id);
  }

  removeItem(id) {
    const index = this.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      const item = this.queue.splice(index, 1)[0];
      this.emit('itemRemoved', item);
      return item;
    }
    return null;
  }

  clearQueue() {
    if (this.processing) {
      return false;
    }
    const oldQueue = [...this.queue];
    this.queue = [];
    this.results = [];
    this.errors = [];
    this.emit('queueCleared', { count: oldQueue.length });
    return true;
  }

  requeueFailed() {
    const failedItems = this.queue.filter(i => i.status === 'failed');
    const requeued = [];

    for (const item of failedItems) {
      item.status = 'pending';
      item.retries = 0;
      item.error = null;
      item.startedAt = null;
      item.completedAt = null;
      requeued.push(item);
    }

    this.emit('itemsRequeued', { count: requeued.length, items: requeued });
    return requeued;
  }

  generateId() {
    return 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  async saveQueue(storageKey = 'batch_queue') {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return false;
    }

    try {
      const queueData = this.queue.map(item => ({
        id: item.id,
        url: item.url,
        title: item.title,
        status: item.status,
        retries: item.retries,
        error: item.error,
        addedAt: item.addedAt,
        startedAt: item.startedAt,
        completedAt: item.completedAt,
        metadata: item.metadata
      }));

      await chrome.storage.local.set({ [storageKey]: queueData });
      return true;
    } catch (error) {
      console.error('Failed to save queue:', error);
      return false;
    }
  }

  async loadQueue(storageKey = 'batch_queue') {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      return false;
    }

    try {
      const result = await chrome.storage.local.get(storageKey);
      const savedQueue = result[storageKey];

      if (savedQueue && Array.isArray(savedQueue)) {
        this.queue = savedQueue.map(item => ({
          ...item,
          result: null
        }));
        this.emit('queueLoaded', { count: this.queue.length });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to load queue:', error);
      return false;
    }
  }
}

class MergeManager {
  constructor(options = {}) {
    this.options = {
      separator: '\n\n---\n\n',
      includeToc: true,
      includeTitles: true,
      ...options
    };

    this.mergeQueue = [];
  }

  addToMerge(item) {
    const mergeItem = {
      id: this.generateId(),
      ...item,
      addedAt: Date.now()
    };
    this.mergeQueue.push(mergeItem);
    return mergeItem;
  }

  addBatchToMerge(items) {
    return items.map(item => this.addToMerge(item));
  }

  removeFromMerge(id) {
    const index = this.mergeQueue.findIndex(item => item.id === id);
    if (index !== -1) {
      return this.mergeQueue.splice(index, 1)[0];
    }
    return null;
  }

  reorderMerge(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.mergeQueue.length ||
        toIndex < 0 || toIndex >= this.mergeQueue.length) {
      return false;
    }

    const [item] = this.mergeQueue.splice(fromIndex, 1);
    this.mergeQueue.splice(toIndex, 0, item);
    return true;
  }

  clearMergeQueue() {
    this.mergeQueue = [];
  }

  getMergeQueue() {
    return [...this.mergeQueue];
  }

  async merge(options = {}) {
    if (this.mergeQueue.length === 0) {
      throw new Error('No items to merge');
    }

    const opts = { ...this.options, ...options };
    const mergedContent = [];
    const mergedToc = [];
    let globalHeadingIndex = 0;

    for (let i = 0; i < this.mergeQueue.length; i++) {
      const item = this.mergeQueue[i];

      if (opts.includeTitles && item.title) {
        const sectionLevel = 1;
        mergedContent.push(`# ${item.title}`);
        mergedContent.push('');

        mergedToc.push({
          level: sectionLevel,
          text: item.title,
          id: `section-${i}`,
          index: globalHeadingIndex++
        });
      }

      if (item.content) {
        const adjustedContent = this.adjustHeadings(item.content, i + 1);
        mergedContent.push(adjustedContent);
      }

      if (item.tableOfContents && item.tableOfContents.length > 0) {
        const adjustedToc = item.tableOfContents.map(tocItem => ({
          ...tocItem,
          level: tocItem.level + 1,
          index: globalHeadingIndex++,
          parentSection: i
        }));
        mergedToc.push(...adjustedToc);
      }

      if (i < this.mergeQueue.length - 1) {
        mergedContent.push('');
        mergedContent.push(opts.separator.trim());
        mergedContent.push('');
      }
    }

    let finalContent = mergedContent.join('\n');

    if (opts.includeToc && mergedToc.length > 0) {
      const tocMarkdown = this.generateTocMarkdown(mergedToc);
      finalContent = tocMarkdown + '\n\n---\n\n' + finalContent;
    }

    return {
      content: finalContent,
      tableOfContents: mergedToc,
      itemCount: this.mergeQueue.length,
      metadata: {
        mergedAt: Date.now(),
        options: opts
      }
    };
  }

  adjustHeadings(content, sectionOffset) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    const headings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');

    headings.forEach(heading => {
      const currentLevel = parseInt(heading.tagName.charAt(1));
      const newLevel = Math.min(currentLevel + 1, 6);
      const newTag = `h${newLevel}`;

      const newHeading = document.createElement(newTag);
      newHeading.innerHTML = heading.innerHTML;
      newHeading.id = heading.id;

      if (heading.parentNode) {
        heading.parentNode.replaceChild(newHeading, heading);
      }
    });

    return tempDiv.innerHTML;
  }

  generateTocMarkdown(toc) {
    if (!toc || toc.length === 0) return '';

    let markdown = '## 合并文档目录\n\n';
    toc.forEach(item => {
      const indent = '  '.repeat(item.level - 1);
      const anchor = item.id || item.text.toLowerCase().replace(/\s+/g, '-');
      markdown += `${indent}- [${item.text}](#${anchor})\n`;
    });

    return markdown;
  }

  generateId() {
    return 'merge_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BatchManager, MergeManager };
}
