importScripts('../core/constants.js');

var BackgroundService = function() {
  this.settings = null;
  this.batchManager = null;
  this.errorHandler = null;
  this.init();
};

BackgroundService.prototype.init = function() {
  var self = this;
  this.loadSettings().then(function() {
    self.initializeManagers();
    self.setupMessageListeners();
    self.setupContextMenu();
    self.setupAlarmListeners();
    console.log('Smart Article Extractor: Background service initialized');
  }).catch(function(error) {
    console.error('Smart Article Extractor: Initialization failed', error);
  });
};

BackgroundService.prototype.loadSettings = function() {
  var self = this;
  return new Promise(function(resolve) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(STORAGE_KEYS.SETTINGS, function(result) {
        if (chrome.runtime.lastError) {
          console.warn('Failed to load settings, using defaults');
          self.settings = self.getDefaultSettings();
        } else {
          self.settings = self.extendObject(self.getDefaultSettings(), result[STORAGE_KEYS.SETTINGS] || {});
        }
        resolve();
      });
    } else {
      self.settings = self.getDefaultSettings();
      resolve();
    }
  });
};

BackgroundService.prototype.getDefaultSettings = function() {
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
};

BackgroundService.prototype.extendObject = function(target, source) {
  var result = {};
  for (var key in target) {
    if (target.hasOwnProperty(key)) {
      result[key] = target[key];
    }
  }
  for (var key in source) {
    if (source.hasOwnProperty(key)) {
      result[key] = source[key];
    }
  }
  return result;
};

BackgroundService.prototype.saveSettings = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      var data = {};
      data[STORAGE_KEYS.SETTINGS] = self.settings;
      chrome.storage.local.set(data, function() {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(true);
        }
      });
    } else {
      resolve(false);
    }
  });
};

BackgroundService.prototype.initializeManagers = function() {
  var self = this;
  
  this.errorHandler = {
    maxRetries: this.settings.maxRetries,
    retryDelay: this.settings.retryDelay,
    
    executeWithRetry: function(fn, options) {
      var maxRetries = (options && options.maxRetries !== undefined) ? options.maxRetries : this.maxRetries;
      var retryDelay = (options && options.retryDelay !== undefined) ? options.retryDelay : this.retryDelay;
      var lastError = null;

      return new Promise(function(resolve, reject) {
        var attempt = 0;
        
        function tryExecute() {
          Promise.resolve(fn()).then(function(result) {
            resolve(result);
          }).catch(function(error) {
            lastError = error;
            if (attempt >= maxRetries) {
              reject(lastError);
              return;
            }
            attempt++;
            console.log('Retry attempt ' + attempt + '/' + maxRetries + ' after ' + (retryDelay * Math.pow(2, attempt - 1)) + 'ms');
            setTimeout(tryExecute, retryDelay * Math.pow(2, attempt - 1));
          });
        }
        
        tryExecute();
      });
    },

    sleep: function(ms) {
      return new Promise(function(resolve) {
        setTimeout(resolve, ms);
      });
    },

    isRetryableError: function(error) {
      var retryableMessages = [
        'NetworkError',
        'TimeoutError',
        'ConnectionError',
        'FetchError',
        'AbortError',
        'Network request failed',
        'Failed to fetch',
        'net::ERR_'
      ];

      var message = '';
      if (error) {
        if (error.message) message = error.message;
        else if (error.name) message = error.name;
        else message = String(error);
      }
      message = message.toLowerCase();
      
      for (var i = 0; i < retryableMessages.length; i++) {
        if (message.indexOf(retryableMessages[i].toLowerCase()) !== -1) {
          return true;
        }
      }
      return false;
    }
  };

  this.batchManager = {
    queue: [],
    processing: false,
    errorHandler: self.errorHandler,

    add: function(item) {
      var queueItem = {
        id: 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        url: item.url,
        title: item.title,
        platform: item.platform,
        metadata: item.metadata,
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

    getStatus: function() {
      var pending = 0;
      var processing = 0;
      var completed = 0;
      var failed = 0;
      
      for (var i = 0; i < this.queue.length; i++) {
        var item = this.queue[i];
        if (item.status === 'pending') pending++;
        else if (item.status === 'processing') processing++;
        else if (item.status === 'completed') completed++;
        else if (item.status === 'failed') failed++;
      }
      
      return {
        processing: this.processing,
        queueLength: this.queue.length,
        pending: pending,
        processing: processing,
        completed: completed,
        failed: failed
      };
    },

    process: function(options) {
      var self = this;
      if (this.processing) {
        return Promise.resolve({ success: false, error: 'Already processing' });
      }

      this.processing = true;
      var concurrent = (options && options.concurrent !== undefined) ? options.concurrent : 2;
      var pendingItems = [];
      
      for (var i = 0; i < this.queue.length; i++) {
        if (this.queue[i].status === 'pending') {
          pendingItems.push(this.queue[i]);
        }
      }
      
      var results = [];
      var errors = [];

      var processItem = function(item) {
        return new Promise(function(resolve) {
          item.status = 'processing';
          item.startedAt = Date.now();

          self.errorHandler.executeWithRetry(function() {
            return self.processBatchItem(item);
          }).then(function(result) {
            item.status = 'completed';
            item.result = result;
            item.completedAt = Date.now();
            results.push({ item: item, result: result });
            resolve(item);
          }).catch(function(error) {
            item.status = 'failed';
            item.error = error ? error.message : 'Unknown error';
            item.completedAt = Date.now();
            errors.push({ item: item, error: error });
            resolve(item);
          });
        });
      };

      var runWorkers = function() {
        return new Promise(function(resolve) {
          var completed = 0;
          var totalItems = pendingItems.length;
          var currentIndex = 0;
          
          function next() {
            if (currentIndex >= totalItems) {
              if (completed >= totalItems) {
                resolve();
              }
              return;
            }
            
            var item = pendingItems[currentIndex];
            currentIndex++;
            
            processItem(item).then(function() {
              completed++;
              next();
            });
          }
          
          for (var i = 0; i < concurrent && i < totalItems; i++) {
            next();
          }
        });
      };

      return runWorkers().then(function() {
        self.processing = false;
        return {
          success: true,
          total: pendingItems.length,
          completed: results.length,
          failed: errors.length,
          results: results,
          errors: errors
        };
      });
    },

    processBatchItem: function(item) {
      var self = this;
      return new Promise(function(resolve, reject) {
        var timeout = setTimeout(function() {
          reject(new Error('Processing timeout'));
        }, 30000);

        if (typeof chrome === 'undefined' || !chrome.tabs) {
          clearTimeout(timeout);
          resolve({
            url: item.url,
            title: item.title,
            needsTab: true
          });
          return;
        }

        chrome.tabs.query({ url: item.url }, function(tabs) {
          clearTimeout(timeout);

          if (tabs.length > 0 && typeof chrome.scripting !== 'undefined') {
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
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else if (results && results.length > 0) {
                resolve({
                  tabId: tabs[0].id,
                  title: results[0].result ? results[0].result.title : '',
                  url: results[0].result ? results[0].result.url : '',
                  html: results[0].result ? results[0].result.html : ''
                });
              } else {
                resolve({
                  tabId: tabs[0].id,
                  url: item.url,
                  title: item.title
                });
              }
            });
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

    clear: function() {
      if (this.processing) return false;
      this.queue = [];
      return true;
    }
  };
};

BackgroundService.prototype.setupMessageListeners = function() {
  var self = this;
  
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      self.handleMessage(request, sender, sendResponse);
      return true;
    });
  }
};

BackgroundService.prototype.handleMessage = function(request, sender, sendResponse) {
  var self = this;
  var action = request.action;
  var data = request.data;

  var sendError = function(msg) {
    sendResponse({ success: false, error: msg });
  };

  var sendSuccess = function(result) {
    sendResponse({ success: true, data: result });
  };

  switch (action) {
    case MESSAGES.GET_SETTINGS:
      sendSuccess(this.settings);
      break;

    case MESSAGES.UPDATE_SETTINGS:
      this.settings = this.extendObject(this.settings, data || {});
      this.saveSettings().then(function() {
        sendSuccess();
      }).catch(function(err) {
        sendError(err.message);
      });
      break;

    case MESSAGES.DETECT_PLATFORM:
      sendSuccess(this.detectPlatform(data ? data.url : ''));
      break;

    case MESSAGES.SAVE_FILE:
      this.saveFile(data).then(function(result) {
        sendSuccess(result);
      }).catch(function(err) {
        sendError(err.message);
      });
      break;

    case MESSAGES.ADD_TO_BATCH:
      var batchItem = this.batchManager.add(data);
      this.saveBatchQueue().then(function() {
        sendSuccess(batchItem);
      }).catch(function() {
        sendSuccess(batchItem);
      });
      break;

    case MESSAGES.PROCESS_BATCH:
      this.batchManager.process(data || {}).then(function(result) {
        self.saveBatchQueue();
        sendSuccess(result);
      });
      break;

    case MESSAGES.GET_BATCH_STATUS:
      sendSuccess(this.batchManager.getStatus());
      break;

    case MESSAGES.GET_HISTORY:
      this.getExportHistory(data).then(function(history) {
        sendSuccess(history);
      });
      break;

    case MESSAGES.CLEAR_HISTORY:
      this.clearHistory().then(function() {
        sendSuccess();
      });
      break;

    case MESSAGES.SCHEDULE_PARSE:
      this.scheduleParse(data).then(function() {
        sendSuccess();
      }).catch(function(err) {
        sendError(err.message);
      });
      break;

    case MESSAGES.CANCEL_SCHEDULE:
      this.cancelSchedule(data).then(function() {
        sendSuccess();
      }).catch(function(err) {
        sendError(err.message);
      });
      break;

    case MESSAGES.GET_SCHEDULED:
      this.getScheduledTasks().then(function(tasks) {
        sendSuccess(tasks);
      });
      break;

    default:
      sendError('Unknown action: ' + action);
  }
};

BackgroundService.prototype.detectPlatform = function(url) {
  for (var key in PLATFORM_RULES) {
    if (PLATFORM_RULES.hasOwnProperty(key)) {
      var rule = PLATFORM_RULES[key];
      for (var i = 0; i < rule.patterns.length; i++) {
        if (url.indexOf(rule.patterns[i]) !== -1) {
          return { key: key, name: rule.name, patterns: rule.patterns };
        }
      }
    }
  }
  return { key: 'generic', name: PLATFORM_RULES.generic.name, patterns: [] };
};

BackgroundService.prototype.saveFile = function(data) {
  var self = this;
  return new Promise(function(resolve, reject) {
    var content = data ? data.content : '';
    var filename = data ? data.filename : 'untitled';
    var format = data ? data.format : 'markdown';
    
    var extension = '';
    var mimeType = '';
    
    switch (format) {
      case 'markdown':
        mimeType = 'text/markdown';
        extension = '.md';
        break;
      case 'html':
        mimeType = 'text/html';
        extension = '.html';
        break;
      case 'txt':
        mimeType = 'text/plain';
        extension = '.txt';
        break;
      default:
        mimeType = 'text/markdown';
        extension = '.md';
    }

    var finalFilename = self.sanitizeFilename(filename) + extension;
    var savePath = self.settings.savePath || 'articles/';
    var fullPath = savePath + finalFilename;

    if (typeof chrome !== 'undefined' && chrome.downloads) {
      var blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url: url,
        filename: fullPath,
        saveAs: !self.settings.autoSave
      }, function(downloadId) {
        URL.revokeObjectURL(url);
        
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          self.addToHistory({
            title: filename,
            format: format,
            timestamp: Date.now(),
            filename: finalFilename,
            downloadId: downloadId
          }).then(function() {
            resolve({
              success: true,
              downloadId: downloadId,
              filename: finalFilename
            });
          });
        }
      });
    } else {
      reject(new Error('Downloads API not available'));
    }
  });
};

BackgroundService.prototype.sanitizeFilename = function(name) {
  if (!name) return 'untitled';
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/[\x00-\x1F\x80-\x9F]/g, '')
    .substring(0, 200);
};

BackgroundService.prototype.addToHistory = function(record) {
  var self = this;
  return new Promise(function(resolve) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      resolve();
      return;
    }

    chrome.storage.local.get(STORAGE_KEYS.HISTORY, function(result) {
      if (chrome.runtime.lastError) {
        console.warn('Failed to get history');
        resolve();
        return;
      }

      var history = result[STORAGE_KEYS.HISTORY] || [];
      var newRecord = {
        id: Date.now(),
        title: record.title,
        format: record.format,
        timestamp: record.timestamp,
        filename: record.filename,
        downloadId: record.downloadId
      };
      
      history.unshift(newRecord);

      if (history.length > 100) {
        history.splice(100);
      }

      var data = {};
      data[STORAGE_KEYS.HISTORY] = history;
      chrome.storage.local.set(data, function() {
        if (chrome.runtime.lastError) {
          console.warn('Failed to save history');
        }
        resolve();
      });
    });
  });
};

BackgroundService.prototype.getExportHistory = function(options) {
  var self = this;
  return new Promise(function(resolve) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      resolve([]);
      return;
    }

    chrome.storage.local.get(STORAGE_KEYS.HISTORY, function(result) {
      if (chrome.runtime.lastError) {
        resolve([]);
        return;
      }

      var history = result[STORAGE_KEYS.HISTORY] || [];
      var opts = options || {};

      if (opts.format) {
        history = history.filter(function(item) {
          return item.format === opts.format;
        });
      }

      if (opts.startDate) {
        history = history.filter(function(item) {
          return item.timestamp >= opts.startDate;
        });
      }

      if (opts.endDate) {
        history = history.filter(function(item) {
          return item.timestamp <= opts.endDate;
        });
      }

      if (opts.limit) {
        history = history.slice(0, opts.limit);
      }

      resolve(history);
    });
  });
};

BackgroundService.prototype.clearHistory = function() {
  return new Promise(function(resolve) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      resolve();
      return;
    }
    chrome.storage.local.remove(STORAGE_KEYS.HISTORY, function() {
      resolve();
    });
  });
};

BackgroundService.prototype.saveBatchQueue = function() {
  var self = this;
  return new Promise(function(resolve) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      resolve();
      return;
    }

    var queueData = [];
    for (var i = 0; i < this.batchManager.queue.length; i++) {
      var item = this.batchManager.queue[i];
      queueData.push({
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
      });
    }

    var data = {};
    data[STORAGE_KEYS.BATCH_QUEUE] = queueData;
    chrome.storage.local.set(data, function() {
      if (chrome.runtime.lastError) {
        console.error('Failed to save batch queue:', chrome.runtime.lastError);
      }
      resolve();
    });
  }.bind(this));
};

BackgroundService.prototype.loadBatchQueue = function() {
  var self = this;
  return new Promise(function(resolve) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      resolve();
      return;
    }

    chrome.storage.local.get(STORAGE_KEYS.BATCH_QUEUE, function(result) {
      if (chrome.runtime.lastError) {
        console.error('Failed to load batch queue:', chrome.runtime.lastError);
        resolve();
        return;
      }

      var savedQueue = result[STORAGE_KEYS.BATCH_QUEUE];
      if (savedQueue && Array.isArray(savedQueue)) {
        self.batchManager.queue = savedQueue.map(function(item) {
          return {
            id: item.id,
            url: item.url,
            title: item.title,
            platform: item.platform,
            metadata: item.metadata,
            status: item.status,
            retries: item.retries || 0,
            error: item.error,
            result: null,
            addedAt: item.addedAt,
            startedAt: item.startedAt,
            completedAt: item.completedAt
          };
        });
      }
      resolve();
    });
  });
};

BackgroundService.prototype.setupContextMenu = function() {
  var self = this;
  
  if (typeof chrome === 'undefined' || !chrome.contextMenus) {
    return;
  }

  chrome.contextMenus.removeAll(function() {
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

  chrome.contextMenus.onClicked.addListener(function(info, tab) {
    self.handleContextMenuClick(info, tab);
  });
};

BackgroundService.prototype.handleContextMenuClick = function(info, tab) {
  var self = this;
  
  if (typeof chrome === 'undefined' || !chrome.tabs || !tab) {
    return;
  }

  var sendMessageToTab = function(message) {
    chrome.tabs.sendMessage(tab.id, message, function(response) {
      if (chrome.runtime.lastError) {
        console.warn('Message to tab failed:', chrome.runtime.lastError);
      }
    });
  };

  switch (info.menuItemId) {
    case 'extract-article':
      sendMessageToTab({
        action: MESSAGES.PARSE_ARTICLE,
        data: { url: tab.url, title: tab.title }
      });
      break;

    case 'copy-markdown':
      sendMessageToTab({
        action: MESSAGES.COPY_TO_CLIPBOARD
      });
      break;

    case 'save-markdown':
      sendMessageToTab({
        action: MESSAGES.EXPORT_MARKDOWN,
        data: { format: 'markdown' }
      });
      break;

    case 'enable-reading-mode':
      sendMessageToTab({
        action: MESSAGES.ENABLE_READING_MODE
      });
      break;

    case 'add-to-batch':
      var url = info.linkUrl || info.pageUrl || tab.url;
      var title = tab.title || url;
      self.batchManager.add({
        url: url,
        title: title,
        platform: self.detectPlatform(url).key
      });
      self.saveBatchQueue();
      break;

    case 'export-options':
      if (chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      }
      break;

    case 'schedule-later':
      self.scheduleParse({
        url: tab.url,
        title: tab.title,
        delayMinutes: 30
      });
      break;
  }
};

BackgroundService.prototype.scheduleParse = function(data) {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (typeof chrome === 'undefined' || !chrome.alarms) {
      reject(new Error('Alarms API not available'));
      return;
    }

    var url = data ? data.url : '';
    var title = data ? data.title : '';
    var delayMinutes = (data && data.delayMinutes !== undefined) ? data.delayMinutes : 30;
    var scheduledTime = Date.now() + (delayMinutes * 60 * 1000);

    var alarmName = 'parse_' + Date.now();
    
    chrome.alarms.create(alarmName, {
      when: scheduledTime
    });

    self.getScheduledTasks().then(function(scheduledTasks) {
      scheduledTasks.push({
        id: alarmName,
        url: url,
        title: title,
        scheduledTime: scheduledTime,
        delayMinutes: delayMinutes,
        createdAt: Date.now()
      });

      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        var storeData = {};
        storeData['scheduled_tasks'] = scheduledTasks;
        chrome.storage.local.set(storeData, function() {
          console.log('Scheduled parse for: ' + url + ' at ' + new Date(scheduledTime).toLocaleString());
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
};

BackgroundService.prototype.cancelSchedule = function(alarmName) {
  var self = this;
  return new Promise(function(resolve, reject) {
    if (typeof chrome === 'undefined' || !chrome.alarms) {
      reject(new Error('Alarms API not available'));
      return;
    }

    chrome.alarms.clear(alarmName, function() {
      self.getScheduledTasks().then(function(scheduledTasks) {
        var updatedTasks = [];
        for (var i = 0; i < scheduledTasks.length; i++) {
          if (scheduledTasks[i].id !== alarmName) {
            updatedTasks.push(scheduledTasks[i]);
          }
        }

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          var storeData = {};
          storeData['scheduled_tasks'] = updatedTasks;
          chrome.storage.local.set(storeData, function() {
            resolve();
          });
        } else {
          resolve();
        }
      });
    });
  });
};

BackgroundService.prototype.getScheduledTasks = function() {
  return new Promise(function(resolve) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      resolve([]);
      return;
    }

    chrome.storage.local.get('scheduled_tasks', function(result) {
      if (chrome.runtime.lastError) {
        resolve([]);
        return;
      }
      resolve(result['scheduled_tasks'] || []);
    });
  });
};

BackgroundService.prototype.setupAlarmListeners = function() {
  var self = this;
  
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    return;
  }

  chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name && alarm.name.indexOf('parse_') === 0) {
      self.executeScheduledParse(alarm.name);
    }
  });
};

BackgroundService.prototype.executeScheduledParse = function(alarmName) {
  var self = this;
  
  console.log('Executing scheduled parse:', alarmName);

  this.getScheduledTasks().then(function(scheduledTasks) {
    var task = null;
    for (var i = 0; i < scheduledTasks.length; i++) {
      if (scheduledTasks[i].id === alarmName) {
        task = scheduledTasks[i];
        break;
      }
    }

    if (!task) {
      console.warn('Scheduled task not found:', alarmName);
      return;
    }

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ url: task.url }, function(tabs) {
        if (tabs.length > 0 && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: MESSAGES.PARSE_ARTICLE,
            data: { scheduled: true }
          }, function(response) {
            if (chrome.runtime.lastError) {
              console.warn('Message to tab failed:', chrome.runtime.lastError);
            }
          });
        } else {
          console.log('Tab not open, creating new tab for:', task.url);
          chrome.tabs.create({
            url: task.url,
            active: false
          }, function(newTab) {
            setTimeout(function() {
              if (newTab && newTab.id) {
                chrome.tabs.sendMessage(newTab.id, {
                  action: MESSAGES.PARSE_ARTICLE,
                  data: { scheduled: true }
                }, function(response) {
                  if (chrome.runtime.lastError) {
                    console.warn('Message to tab failed:', chrome.runtime.lastError);
                  }
                });
              }
            }, 5000);
          });
        }
      });
    }

    var updatedTasks = [];
    for (var i = 0; i < scheduledTasks.length; i++) {
      if (scheduledTasks[i].id !== alarmName) {
        updatedTasks.push(scheduledTasks[i]);
      }
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      var storeData = {};
      storeData['scheduled_tasks'] = updatedTasks;
      chrome.storage.local.set(storeData, function() {});
    }

    if (typeof chrome !== 'undefined' && chrome.alarms) {
      chrome.alarms.clear(alarmName, function() {});
    }
  }).catch(function(error) {
    console.error('Scheduled parse failed:', error);
  });
};

var backgroundService = new BackgroundService();
