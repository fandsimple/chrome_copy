importScripts('../core/constants.js');

class BackgroundService {
  constructor() {
    this.settings = null;
    this.batchManager = null;
    this.errorHandler = null;
    this.exportManager = null;
    this.customRulesManager = null;
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.initializeManagers();
    this.setupMessageListeners();
    this.setupContextMenu();
    this.setupAlarmListeners();
    console.log('Smart Article Extractor: Background service initialized');
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
      this.settings = { ...this.getDefaultSettings(), ...result[STORAGE_KEYS.SETTINGS] };
    } catch (error) {
      console.warn('Failed to load settings, using defaults:', error);
      this.settings = this.getDefaultSettings();
    }
  }

  getDefaultSettings() {
    return {
      autoDetectPlatform: true,
      autoInjectButton: true,
      enableReadingMode: true,
      enableImageOffline: false,
      enableCodeHighlight: true,
      enableTableOfContents: true,
      exportFormat: 'markdown',
      autoSave: false,
      savePath: 'articles/',
      autoRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      maxConcurrent: 2,
      enabledPlatforms: ['csdn', 'juejin', 'cnblogs', 'jianshu', 'zhihu', 'segmentfault', 'generic'],
      customRules: [],
      exportHistory: [],
      batchQueue: [],
      mergeQueue: []
    };
  }

  async saveSettings() {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: this.settings });
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      return false;
    }
  }

  initializeManagers() {
    this.errorHandler = {
      maxRetries: this.settings.maxRetries,
      retryDelay: this.settings.retryDelay,
      
      async executeWithRetry(fn, options = {}) {
        const maxRetries = options.maxRetries ?? this.maxRetries;
        const retryDelay = options.retryDelay ?? this.retryDelay;
        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            return await fn();
          } catch (error) {
            lastError = error;
            if (attempt >= maxRetries) break;
            console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${retryDelay}ms`);
            await this.sleep(retryDelay * Math.pow(2, attempt));
          }
        }
        throw lastError;
      },

      sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      },

      isRetryableError(error) {
        const retryableMessages = [
          'NetworkError',
          'TimeoutError',
          'ConnectionError',
          'FetchError',
          'AbortError',
          'Network request failed',
          'Failed to fetch',
          'net::ERR_'
        ];

        const message = (error.message || error.name || String(error)).toLowerCase();
        return retryableMessages.some(r => message.includes(r.toLowerCase()));
      }
    };

    this.batchManager = {
      queue: [],
      processing: false,

      add(item) {
        const queueItem = {
          id: 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
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
        return queueItem;
      },

      getStatus() {
        return {
          processing: this.processing,
          queueLength: this.queue.length,
          pending: this.queue.filter(i => i.status === 'pending').length,
          processing: this.queue.filter(i => i.status === 'processing').length,
          completed: this.queue.filter(i => i.status === 'completed').length,
          failed: this.queue.filter(i => i.status === 'failed').length
        };
      },

      async process(options = {}) {
        if (this.processing) {
          return { success: false, error: 'Already processing' };
        }

        this.processing = true;
        const concurrent = options.concurrent ?? 2;
        const pendingItems = this.queue.filter(item => item.status === 'pending');
        const results = [];
        const errors = [];

        const processItem = async (item) => {
          item.status = 'processing';
          item.startedAt = Date.now();

          try {
            const result = await this.executeWithRetry(async () => {
              return await this.processBatchItem(item);
            });

            item.status = 'completed';
            item.result = result;
            item.completedAt = Date.now();
            results.push({ item, result });

          } catch (error) {
            item.status = 'failed';
            item.error = error.message;
            item.completedAt = Date.now();
            errors.push({ item, error });
          }

          return item;
        };

        const workers = [];
        for (let i = 0; i < concurrent; i++) {
          workers.push(this.runWorker(pendingItems, processItem));
        }

        await Promise.all(workers);
        this.processing = false;

        return {
          success: true,
          total: pendingItems.length,
          completed: results.length,
          failed: errors.length,
          results,
          errors
        };
      },

      async runWorker(items, processItem) {
        for (const item of items) {
          if (item.status === 'pending') {
            await processItem(item);
          }
        }
      },

      async processBatchItem(item) {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Processing timeout'));
          }, 30000);

          chrome.tabs.query({ url: item.url }, async (tabs) => {
            clearTimeout();

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

                resolve({
                  tabId: tabs[0].id,
                  ...results[0]?.result
                });
              } catch (error) {
                reject(error);
              }
            } else {
              resolve({
                url: item.url,
                title: item.title,
                needsTab: true
              });
            }
          });
        });
      },

      clear() {
        if (this.processing) return false;
        this.queue = [];
        return true;
      },

      executeWithRetry: this.errorHandler.executeWithRetry.bind(this.errorHandler),
      sleep: this.errorHandler.sleep.bind(this.errorHandler)
    };
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });
  }

  async handleMessage(request, sender, sendResponse) {
    const { action, data } = request;

    try {
      switch (action) {
        case MESSAGES.GET_SETTINGS:
          sendResponse({ success: true, data: this.settings });
          break;

        case MESSAGES.UPDATE_SETTINGS:
          this.settings = { ...this.settings, ...data };
          await this.saveSettings();
          sendResponse({ success: true });
          break;

        case MESSAGES.DETECT_PLATFORM:
          const platform = this.detectPlatform(data.url);
          sendResponse({ success: true, data: platform });
          break;

        case MESSAGES.SAVE_FILE:
          const saveResult = await this.saveFile(data);
          sendResponse({ success: true, data: saveResult });
          break;

        case MESSAGES.ADD_TO_BATCH:
          const batchItem = this.batchManager.add(data);
          await this.saveBatchQueue();
          sendResponse({ success: true, data: batchItem });
          break;

        case MESSAGES.PROCESS_BATCH:
          const processResult = await this.batchManager.process(data);
          await this.saveBatchQueue();
          sendResponse({ success: true, data: processResult });
          break;

        case MESSAGES.GET_BATCH_STATUS:
          const status = this.batchManager.getStatus();
          sendResponse({ success: true, data: status });
          break;

        case MESSAGES.GET_HISTORY:
          const history = await this.getExportHistory(data);
          sendResponse({ success: true, data: history });
          break;

        case MESSAGES.CLEAR_HISTORY:
          await this.clearHistory();
          sendResponse({ success: true });
          break;

        case MESSAGES.SCHEDULE_PARSE:
          await this.scheduleParse(data);
          sendResponse({ success: true });
          break;

        case MESSAGES.CANCEL_SCHEDULE:
          await this.cancelSchedule(data);
          sendResponse({ success: true });
          break;

        case MESSAGES.GET_SCHEDULED:
          const scheduled = await this.getScheduledTasks();
          sendResponse({ success: true, data: scheduled });
          break;

        default:
          sendResponse({ success: false, error: `Unknown action: ${action}` });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  detectPlatform(url) {
    for (const [key, rule] of Object.entries(PLATFORM_RULES)) {
      for (const pattern of rule.patterns) {
        if (url.includes(pattern)) {
          return { key, ...rule };
        }
      }
    }
    return { key: 'generic', ...PLATFORM_RULES.generic };
  }

  async saveFile(data) {
    const { content, filename, format } = data;
    let blob, mimeType, extension;

    switch (format) {
      case 'markdown':
        mimeType = 'text/markdown';
        extension = '.md';
        blob = new Blob([content], { type: mimeType });
        break;
      case 'html':
        mimeType = 'text/html';
        extension = '.html';
        blob = new Blob([content], { type: mimeType });
        break;
      case 'txt':
        mimeType = 'text/plain';
        extension = '.txt';
        blob = new Blob([content], { type: mimeType });
        break;
      default:
        mimeType = 'text/markdown';
        extension = '.md';
        blob = new Blob([content], { type: mimeType });
    }

    const url = URL.createObjectURL(blob);
    const finalFilename = this.sanitizeFilename(filename) + extension;

    try {
      const downloadId = await chrome.downloads.download({
        url: url,
        filename: this.settings.savePath + finalFilename,
        saveAs: !this.settings.autoSave
      });

      await this.addToHistory({
        title: filename,
        format: format,
        timestamp: Date.now(),
        filename: finalFilename,
        downloadId: downloadId
      });

      return {
        success: true,
        downloadId,
        filename: finalFilename
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  sanitizeFilename(name) {
    return name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/[\x00-\x1F\x80-\x9F]/g, '')
      .substring(0, 200);
  }

  async addToHistory(record) {
    const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
    const history = result[STORAGE_KEYS.HISTORY] || [];

    history.unshift({ ...record, id: Date.now() });

    if (history.length > 100) {
      history.splice(100);
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: history });
  }

  async getExportHistory(options = {}) {
    const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
    let history = result[STORAGE_KEYS.HISTORY] || [];

    if (options.format) {
      history = history.filter(item => item.format === options.format);
    }

    if (options.startDate) {
      history = history.filter(item => item.timestamp >= options.startDate);
    }

    if (options.endDate) {
      history = history.filter(item => item.timestamp <= options.endDate);
    }

    if (options.limit) {
      history = history.slice(0, options.limit);
    }

    return history;
  }

  async clearHistory() {
    await chrome.storage.local.remove(STORAGE_KEYS.HISTORY);
  }

  async saveBatchQueue() {
    try {
      await chrome.storage.local.set({ 
        [STORAGE_KEYS.BATCH_QUEUE]: this.batchManager.queue 
      });
    } catch (error) {
      console.error('Failed to save batch queue:', error);
    }
  }

  async loadBatchQueue() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.BATCH_QUEUE);
      if (result[STORAGE_KEYS.BATCH_QUEUE]) {
        this.batchManager.queue = result[STORAGE_KEYS.BATCH_QUEUE];
      }
    } catch (error) {
      console.error('Failed to load batch queue:', error);
    }
  }

  setupContextMenu() {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'extract-article',
        title: '提取当前文章',
        contexts: ['page', 'selection']
      });

      chrome.contextMenus.create({
        id: 'copy-markdown',
        title: '复制为 Markdown',
        contexts: ['selection', 'page']
      });

      chrome.contextMenus.create({
        id: 'save-markdown',
        title: '保存为 Markdown 文件',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'enable-reading-mode',
        title: '启用阅读模式',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'add-to-batch',
        title: '添加到批量采集队列',
        contexts: ['page', 'link']
      });

      chrome.contextMenus.create({
        id: 'separator-1',
        type: 'separator',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'export-options',
        title: '导出选项',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'schedule-later',
        title: '稍后解析',
        contexts: ['page']
      });
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });
  }

  handleContextMenuClick(info, tab) {
    switch (info.menuItemId) {
      case 'extract-article':
        this.sendMessageToTab(tab.id, { 
          action: MESSAGES.PARSE_ARTICLE,
          data: { url: tab.url, title: tab.title }
        });
        break;

      case 'copy-markdown':
        this.sendMessageToTab(tab.id, { 
          action: MESSAGES.COPY_TO_CLIPBOARD 
        });
        break;

      case 'save-markdown':
        this.sendMessageToTab(tab.id, { 
          action: MESSAGES.EXPORT_MARKDOWN,
          data: { format: 'markdown' }
        });
        break;

      case 'enable-reading-mode':
        this.sendMessageToTab(tab.id, { 
          action: MESSAGES.ENABLE_READING_MODE 
        });
        break;

      case 'add-to-batch':
        const url = info.linkUrl || info.pageUrl || tab.url;
        const title = tab.title || url;
        this.batchManager.add({
          url: url,
          title: title,
          platform: this.detectPlatform(url).key
        });
        this.saveBatchQueue();
        break;

      case 'export-options':
        chrome.runtime.openOptionsPage();
        break;

      case 'schedule-later':
        this.scheduleParse({
          url: tab.url,
          title: tab.title,
          delayMinutes: 30
        });
        break;
    }
  }

  sendMessageToTab(tabId, message) {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Message to tab failed:', chrome.runtime.lastError);
      }
    });
  }

  async scheduleParse(data) {
    const { url, title, delayMinutes = 30 } = data;
    const scheduledTime = Date.now() + (delayMinutes * 60 * 1000);

    const alarmName = `parse_${Date.now()}`;
    
    await chrome.alarms.create(alarmName, {
      when: scheduledTime
    });

    const result = await chrome.storage.local.get('scheduled_tasks');
    const scheduledTasks = result.scheduled_tasks || [];

    scheduledTasks.push({
      id: alarmName,
      url: url,
      title: title,
      scheduledTime: scheduledTime,
      delayMinutes: delayMinutes,
      createdAt: Date.now()
    });

    await chrome.storage.local.set({ scheduled_tasks: scheduledTasks });

    console.log(`Scheduled parse for: ${url} at ${new Date(scheduledTime).toLocaleString()}`);
  }

  async cancelSchedule(alarmName) {
    await chrome.alarms.clear(alarmName);

    const result = await chrome.storage.local.get('scheduled_tasks');
    let scheduledTasks = result.scheduled_tasks || [];
    scheduledTasks = scheduledTasks.filter(task => task.id !== alarmName);
    
    await chrome.storage.local.set({ scheduled_tasks: scheduledTasks });
  }

  async getScheduledTasks() {
    const result = await chrome.storage.local.get('scheduled_tasks');
    return result.scheduled_tasks || [];
  }

  setupAlarmListeners() {
    chrome.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm.name.startsWith('parse_')) {
        await this.executeScheduledParse(alarm.name);
      }
    });
  }

  async executeScheduledParse(alarmName) {
    console.log('Executing scheduled parse:', alarmName);

    const result = await chrome.storage.local.get('scheduled_tasks');
    const scheduledTasks = result.scheduled_tasks || [];
    const task = scheduledTasks.find(t => t.id === alarmName);

    if (!task) {
      console.warn('Scheduled task not found:', alarmName);
      return;
    }

    try {
      const tabs = await chrome.tabs.query({ url: task.url });
      
      if (tabs.length > 0) {
        this.sendMessageToTab(tabs[0].id, {
          action: MESSAGES.PARSE_ARTICLE,
          data: { scheduled: true }
        });
      } else {
        console.log('Tab not open, creating new tab for:', task.url);
        const newTab = await chrome.tabs.create({
          url: task.url,
          active: false
        });

        setTimeout(() => {
          this.sendMessageToTab(newTab.id, {
            action: MESSAGES.PARSE_ARTICLE,
            data: { scheduled: true }
          });
        }, 5000);
      }
    } catch (error) {
      console.error('Scheduled parse failed:', error);
    }

    const updatedTasks = scheduledTasks.filter(t => t.id !== alarmName);
    await chrome.storage.local.set({ scheduled_tasks: updatedTasks });
    await chrome.alarms.clear(alarmName);
  }
}

const backgroundService = new BackgroundService();
