(function(window) {
    'use strict';

    const Logger = {
        _prefix: '[ChromeCopy]',
        _enableDebug: true,
        
        LEVELS: {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3
        },

        _currentLevel: 0,

        _formatTime: function() {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const ms = String(now.getMilliseconds()).padStart(3, '0');
            return `${hours}:${minutes}:${seconds}.${ms}`;
        },

        _formatMessage: function(level, ...args) {
            const time = this._formatTime();
            const levelStr = level.toUpperCase().padEnd(5, ' ');
            const messages = args.map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg, null, 2);
                    } catch (e) {
                        return String(arg);
                    }
                }
                return String(arg);
            }).join(' ');
            
            return `${this._prefix} [${time}] [${levelStr}] ${messages}`;
        },

        debug: function(...args) {
            if (this._currentLevel > this.LEVELS.DEBUG) return;
            console.log(this._formatMessage('debug', ...args));
        },

        info: function(...args) {
            if (this._currentLevel > this.LEVELS.INFO) return;
            console.info(this._formatMessage('info', ...args));
        },

        warn: function(...args) {
            if (this._currentLevel > this.LEVELS.WARN) return;
            console.warn(this._formatMessage('warn', ...args));
        },

        error: function(...args) {
            console.error(this._formatMessage('error', ...args));
            if (args.length > 0 && args[0] instanceof Error) {
                const err = args[0];
                console.error(this._formatMessage('error', 'Stack:'), err.stack);
                if (err.message) {
                    console.error(this._formatMessage('error', 'Message:'), err.message);
                }
                if (err.name) {
                    console.error(this._formatMessage('error', 'Name:'), err.name);
                }
            }
        },

        group: function(label) {
            console.group(this._prefix + ' ' + label);
        },

        groupEnd: function() {
            console.groupEnd();
        },

        table: function(data, columns) {
            console.table(data, columns);
        },

        setLevel: function(level) {
            if (typeof level === 'number') {
                this._currentLevel = level;
            } else if (typeof level === 'string') {
                this._currentLevel = this.LEVELS[level.toUpperCase()] || 0;
            }
            this.info('Log level set to:', level);
        }
    };

    const ErrorHandler = {
        _initialized: false,
        _errorCount: 0,
        _maxErrors: 100,
        _errors: [],

        init: function() {
            if (this._initialized) return;
            
            const self = this;
            
            window.onerror = function(message, source, lineno, colno, error) {
                self._handleError({
                    type: 'uncaught',
                    message: message,
                    source: source,
                    lineno: lineno,
                    colno: colno,
                    error: error,
                    timestamp: new Date().toISOString()
                });
                return false;
            };

            window.addEventListener('unhandledrejection', function(event) {
                event.preventDefault();
                
                let reason = event.reason;
                let errorObj = null;
                let reasonStr = 'Unknown';

                if (reason instanceof Error) {
                    errorObj = reason;
                    reasonStr = reason.message || reason.name;
                } else if (typeof reason === 'object') {
                    try {
                        reasonStr = JSON.stringify(reason);
                    } catch (e) {
                        reasonStr = String(reason);
                    }
                } else {
                    reasonStr = String(reason);
                }

                self._handleError({
                    type: 'unhandledrejection',
                    message: 'Unhandled Promise Rejection: ' + reasonStr,
                    reason: reason,
                    error: errorObj,
                    timestamp: new Date().toISOString()
                });
            });

            this._initialized = true;
            Logger.info('ErrorHandler initialized successfully');
        },

        _handleError: function(errorInfo) {
            this._errorCount++;
            
            const errorRecord = {
                id: this._errorCount,
                ...errorInfo
            };
            
            this._errors.push(errorRecord);
            
            if (this._errors.length > this._maxErrors) {
                this._errors.shift();
            }

            Logger.group('Error #' + this._errorCount);
            
            Logger.error('Error Type:', errorInfo.type);
            
            if (errorInfo.message) {
                Logger.error('Message:', errorInfo.message);
            }
            
            if (errorInfo.source) {
                Logger.error('Source:', errorInfo.source);
                if (errorInfo.lineno) {
                    Logger.error('Line:', errorInfo.lineno);
                }
                if (errorInfo.colno) {
                    Logger.error('Column:', errorInfo.colno);
                }
            }
            
            if (errorInfo.error && errorInfo.error instanceof Error) {
                Logger.error('Error Object:', errorInfo.error);
                Logger.error('Stack:', errorInfo.error.stack);
            }
            
            if (errorInfo.reason) {
                Logger.error('Reason:', errorInfo.reason);
                if (errorInfo.reason instanceof Error) {
                    Logger.error('Reason Stack:', errorInfo.reason.stack);
                }
            }
            
            Logger.error('Timestamp:', errorInfo.timestamp);
            
            Logger.groupEnd();

            if (errorInfo.type === 'unhandledrejection') {
                this._showUserNotification(
                    '遇到一个错误，已记录详细日志。请打开开发者工具查看 Console。',
                    'warning'
                );
            }
        },

        _showUserNotification: function(message, type) {
            try {
                if (window.ExportManager && window.ExportManager.showNotification) {
                    window.ExportManager.showNotification(message, type);
                } else {
                    if (type === 'error' && this._errorCount <= 3) {
                        alert('[文章复制工具] ' + message);
                    }
                }
            } catch (e) {
                Logger.error('Failed to show user notification:', e);
            }
        },

        getErrors: function() {
            return [...this._errors];
        },

        getLastError: function() {
            return this._errors.length > 0 ? this._errors[this._errors.length - 1] : null;
        },

        clearErrors: function() {
            this._errors = [];
            this._errorCount = 0;
            Logger.info('Error history cleared');
        },

        wrapFunction: function(fn, context, errorMessage) {
            const self = this;
            return function(...args) {
                try {
                    return fn.apply(context || this, args);
                } catch (e) {
                    self._handleError({
                        type: 'caught',
                        message: errorMessage || 'Function execution error',
                        error: e,
                        args: args,
                        timestamp: new Date().toISOString()
                    });
                    throw e;
                }
            };
        },

        wrapAsync: function(promise, errorMessage) {
            const self = this;
            return promise.catch(function(reason) {
                self._handleError({
                    type: 'async_caught',
                    message: errorMessage || 'Async operation error',
                    reason: reason,
                    error: reason instanceof Error ? reason : null,
                    timestamp: new Date().toISOString()
                });
                throw reason;
            });
        },

        safeExecute: function(fn, fallback, errorMessage) {
            try {
                return fn();
            } catch (e) {
                this._handleError({
                    type: 'safe_execute',
                    message: errorMessage || 'Safe execute error',
                    error: e,
                    timestamp: new Date().toISOString()
                });
                if (typeof fallback === 'function') {
                    return fallback(e);
                }
                return fallback;
            }
        }
    };

    const ModuleLoader = {
        _loadedModules: new Set(),
        _loadingPromises: {},
        _timeout: 10000,

        loadScript: function(src) {
            const self = this;
            
            if (this._loadedModules.has(src)) {
                Logger.debug('Module already loaded:', src);
                return Promise.resolve(true);
            }

            if (this._loadingPromises[src]) {
                Logger.debug('Module already loading, waiting:', src);
                return this._loadingPromises[src];
            }

            this._loadingPromises[src] = new Promise(function(resolve, reject) {
                const timeoutId = setTimeout(function() {
                    const error = new Error('Module load timeout: ' + src);
                    Logger.error(error);
                    reject(error);
                    delete self._loadingPromises[src];
                }, self._timeout);

                const script = document.createElement('script');
                script.type = 'text/javascript';
                script.src = chrome.extension.getURL(src);
                
                script.onload = function() {
                    clearTimeout(timeoutId);
                    self._loadedModules.add(src);
                    Logger.info('Module loaded successfully:', src);
                    resolve(true);
                    delete self._loadingPromises[src];
                };
                
                script.onerror = function(event) {
                    clearTimeout(timeoutId);
                    const error = new Error('Failed to load module: ' + src);
                    Logger.error(error, 'Event:', event);
                    reject(error);
                    delete self._loadingPromises[src];
                };

                document.head.appendChild(script);
                Logger.debug('Started loading module:', src);
            });

            return this._loadingPromises[src];
        },

        loadScripts: function(sources) {
            const self = this;
            const promises = sources.map(function(src) {
                return self.loadScript(src);
            });
            return Promise.all(promises);
        },

        waitForModule: function(moduleName, timeout = 5000) {
            const self = this;
            const startTime = Date.now();
            
            return new Promise(function(resolve, reject) {
                function check() {
                    if (window[moduleName]) {
                        Logger.debug('Module available:', moduleName);
                        resolve(window[moduleName]);
                        return;
                    }
                    
                    if (Date.now() - startTime > timeout) {
                        const error = new Error('Timeout waiting for module: ' + moduleName);
                        Logger.error(error);
                        reject(error);
                        return;
                    }
                    
                    setTimeout(check, 100);
                }
                
                check();
            });
        },

        isLoaded: function(src) {
            return this._loadedModules.has(src);
        },

        getLoadedModules: function() {
            return Array.from(this._loadedModules);
        }
    };

    window.Logger = Logger;
    window.ErrorHandler = ErrorHandler;
    window.ModuleLoader = ModuleLoader;

    ErrorHandler.init();
    Logger.info('=== ChromeCopy Extension Initialized ===');
    Logger.info('Logger, ErrorHandler, and ModuleLoader are ready');

})(window);
