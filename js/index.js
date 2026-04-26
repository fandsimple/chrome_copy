$(document).ready(function() {
    'use strict';

    const _log = {
        debug: function() { console.log('[ChromeCopy Popup Debug]', ...arguments); },
        info: function() { console.info('[ChromeCopy Popup Info]', ...arguments); },
        warn: function() { console.warn('[ChromeCopy Popup Warn]', ...arguments); },
        error: function() { console.error('[ChromeCopy Popup Error]', ...arguments); }
    };

    _log.info('Popup page initialized');
    _log.info('Document ready state:', document.readyState);

    window.onerror = function(message, source, lineno, colno, error) {
        _log.error('Global error caught in popup!');
        _log.error('Message:', message);
        _log.error('Source:', source);
        _log.error('Line:', lineno);
        _log.error('Column:', colno);
        if (error) {
            _log.error('Error:', error);
            _log.error('Stack:', error.stack);
        }
        return false;
    };

    window.addEventListener('unhandledrejection', function(event) {
        _log.error('Unhandled Promise Rejection in popup!');
        _log.error('Event:', event);
        _log.error('Reason:', event.reason);
        
        if (event.reason instanceof Error) {
            _log.error('Error message:', event.reason.message);
            _log.error('Error stack:', event.reason.stack);
        }
        
        event.preventDefault();
    });

    const ConfigManager = {
        defaults: {
            csdnFlag: 'off',
            juejinFlag: 'off',
            bokeyuanFlag: 'off',
            jianshuFlag: 'off',
            dgstackFlag: 'off',
            bdwkFlag: 'off',
            aiSummary: 'off',
            aiSimplify: 'off',
            adFilter: 'on',
            keepFormat: 'on',
            autoCopy: 'on'
        },

        get: function(key, callback) {
            const self = this;
            const defaultVal = this.defaults[key];
            
            _log.debug('ConfigManager.get called, key:', key, 'default:', defaultVal);
            
            try {
                chrome.storage.sync.get({ [key]: defaultVal }, function(data) {
                    _log.debug('ConfigManager.get callback, data:', data);
                    
                    try {
                        if (callback) {
                            callback(data[key]);
                        }
                    } catch (e) {
                        _log.error('Error in ConfigManager.get callback:', e);
                        _log.error('Error details:', {
                            message: e.message,
                            name: e.name,
                            stack: e.stack
                        });
                    }
                });
            } catch (e) {
                _log.error('Error calling chrome.storage.sync.get:', e);
                _log.error('Error details:', {
                    message: e.message,
                    name: e.name,
                    stack: e.stack
                });
                
                if (callback) {
                    try {
                        callback(defaultVal);
                    } catch (cbErr) {
                        _log.error('Error in fallback callback:', cbErr);
                    }
                }
            }
        },

        set: function(key, value, callback) {
            _log.info('ConfigManager.set called, key:', key, 'value:', value);
            
            try {
                chrome.storage.sync.set({ [key]: value }, function() {
                    _log.info('ConfigManager.set completed, key:', key, 'value:', value);
                    
                    if (chrome.runtime.lastError) {
                        _log.error('chrome.storage.sync.set error:', chrome.runtime.lastError);
                    }
                    
                    if (callback) {
                        try {
                            callback();
                        } catch (e) {
                            _log.error('Error in ConfigManager.set callback:', e);
                        }
                    }
                });
            } catch (e) {
                _log.error('Error calling chrome.storage.sync.set:', e);
                _log.error('Error details:', {
                    message: e.message,
                    name: e.name,
                    stack: e.stack
                });
            }
        },

        toggle: function(key, callback) {
            const self = this;
            this.get(key, function(currentValue) {
                const newValue = currentValue === 'on' ? 'off' : 'on';
                self.set(key, newValue, function() {
                    if (callback) {
                        try {
                            callback(newValue);
                        } catch (e) {
                            _log.error('Error in toggle callback:', e);
                        }
                    }
                });
            });
        },

        getAll: function(callback) {
            _log.debug('ConfigManager.getAll called');
            
            try {
                chrome.storage.sync.get(this.defaults, function(data) {
                    _log.debug('ConfigManager.getAll callback, data:', data);
                    
                    if (chrome.runtime.lastError) {
                        _log.error('chrome.storage.sync.get error:', chrome.runtime.lastError);
                    }
                    
                    if (callback) {
                        try {
                            callback(data);
                        } catch (e) {
                            _log.error('Error in getAll callback:', e);
                        }
                    }
                });
            } catch (e) {
                _log.error('Error calling chrome.storage.sync.getAll:', e);
                
                if (callback) {
                    try {
                        callback({ ...this.defaults });
                    } catch (cbErr) {
                        _log.error('Error in fallback callback:', cbErr);
                    }
                }
            }
        }
    };

    const UIManager = {
        _initialized: false,

        init: function() {
            _log.info('UIManager.init called');
            
            try {
                this.loadAllSettings();
                this.bindEvents();
                this._initialized = true;
                _log.info('UIManager initialized successfully');
            } catch (e) {
                _log.error('Error during UIManager.init:', e);
                _log.error('Error details:', {
                    message: e.message,
                    name: e.name,
                    stack: e.stack
                });
                
                this.showNotification('初始化出错: ' + e.message, 'error');
            }
        },

        loadAllSettings: function() {
            const self = this;
            
            _log.info('UIManager.loadAllSettings called');
            
            try {
                ConfigManager.getAll(function(settings) {
                    _log.info('Loaded settings:', settings);
                    
                    try {
                        Object.keys(settings).forEach(function(key) {
                            const value = settings[key];
                            const elementId = key.replace('Flag', '');
                            const $element = $('#' + elementId);
                            
                            _log.debug('Processing setting:', key, 'value:', value, 'elementId:', elementId);
                            
                            if ($element.length > 0) {
                                _log.debug('Found element for:', elementId);
                                
                                if (value === 'on') {
                                    $element.prop('checked', true);
                                    _log.debug('Set checked: true for:', elementId);
                                } else {
                                    $element.prop('checked', false);
                                    _log.debug('Set checked: false for:', elementId);
                                }
                            } else {
                                _log.warn('No element found for id:', elementId);
                            }
                        });
                        
                        _log.info('All settings loaded successfully');
                    } catch (e) {
                        _log.error('Error processing settings:', e);
                    }
                });
            } catch (e) {
                _log.error('Error in loadAllSettings:', e);
            }
        },

        bindEvents: function() {
            const self = this;
            
            _log.info('UIManager.bindEvents called');

            const platformIds = ['csdn', 'juejin', 'bokeyuan', 'jianshu', 'dgstack', 'bdwk'];
            const featureIds = ['aiSummary', 'aiSimplify', 'adFilter', 'keepFormat', 'autoCopy'];

            _log.debug('Binding platform events for:', platformIds);
            _log.debug('Binding feature events for:', featureIds);

            platformIds.forEach(function(id) {
                const storageKey = id + 'Flag';
                const $element = $('#' + id);
                
                _log.debug('Processing platform:', id, 'storageKey:', storageKey);
                
                if ($element.length === 0) {
                    _log.warn('No element found for platform:', id);
                    return;
                }
                
                try {
                    ConfigManager.get(storageKey, function(value) {
                        _log.debug('Got value for', storageKey, ':', value);
                        $element.prop('checked', value === 'on');
                    });
                } catch (e) {
                    _log.error('Error getting config for', id, ':', e);
                }

                $element.on('change', function() {
                    const isChecked = $(this).is(':checked');
                    _log.info('Platform toggle changed:', id, 'checked:', isChecked);
                    
                    try {
                        ConfigManager.set(storageKey, isChecked ? 'on' : 'off');
                        self.showToast(isChecked ? '已启用' : '已禁用', self.getPlatformName(id));
                    } catch (e) {
                        _log.error('Error setting config for', id, ':', e);
                        self.showNotification('设置保存失败: ' + e.message, 'error');
                    }
                });
            });

            featureIds.forEach(function(id) {
                const $element = $('#' + id);
                
                _log.debug('Processing feature:', id);
                
                if ($element.length === 0) {
                    _log.warn('No element found for feature:', id);
                    return;
                }
                
                try {
                    ConfigManager.get(id, function(value) {
                        _log.debug('Got value for', id, ':', value);
                        $element.prop('checked', value === 'on');
                    });
                } catch (e) {
                    _log.error('Error getting config for', id, ':', e);
                }

                $element.on('change', function() {
                    const isChecked = $(this).is(':checked');
                    _log.info('Feature toggle changed:', id, 'checked:', isChecked);
                    
                    try {
                        ConfigManager.set(id, isChecked ? 'on' : 'off');
                        self.showToast(isChecked ? '已启用' : '已禁用', self.getFeatureName(id));
                    } catch (e) {
                        _log.error('Error setting config for', id, ':', e);
                        self.showNotification('设置保存失败: ' + e.message, 'error');
                    }
                });
            });
            
            _log.info('All events bound successfully');
        },

        getPlatformName: function(id) {
            const names = {
                csdn: 'CSDN',
                juejin: '掘金',
                bokeyuan: '博客园',
                jianshu: '简书',
                dgstack: '逗哥架构',
                bdwk: '百度文库'
            };
            return names[id] || id;
        },

        getFeatureName: function(id) {
            const names = {
                aiSummary: '自动生成摘要',
                aiSimplify: '智能内容精简',
                adFilter: '广告内容过滤',
                keepFormat: '保留原文格式',
                autoCopy: '自动复制到剪贴板'
            };
            return names[id] || id;
        },

        showToast: function(action, item) {
            _log.debug('showToast called:', action, item);
            
            try {
                $('.toast-message').remove();
                
                const $toast = $('<div class="toast-message">' + action + ' ' + item + '</div>');
                
                $toast.css({
                    position: 'fixed',
                    top: '10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    zIndex: '9999',
                    opacity: '0',
                    transition: 'opacity 0.3s ease',
                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                    whiteSpace: 'nowrap'
                });
                
                $('body').append($toast);
                
                setTimeout(function() {
                    $toast.css('opacity', '1');
                }, 10);
                
                setTimeout(function() {
                    $toast.css('opacity', '0');
                    setTimeout(function() {
                        $toast.remove();
                    }, 300);
                }, 2000);
            } catch (e) {
                _log.error('Error in showToast:', e);
            }
        },

        showNotification: function(message, type) {
            _log.debug('showNotification called:', message, 'type:', type);
            
            type = type || 'info';
            
            const bgColors = {
                success: '#27ae60',
                error: '#e74c3c',
                warning: '#f39c12',
                info: '#3498db'
            };

            try {
                const $notification = $('<div>', {
                    css: {
                        position: 'fixed',
                        top: '10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '10px 20px',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: '500',
                        zIndex: '99999',
                        backgroundColor: bgColors[type] || bgColors.info,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        whiteSpace: 'nowrap'
                    }
                }).text(message);

                $('body').append($notification);

                setTimeout(function() {
                    $notification.fadeOut(300, function() {
                        $(this).remove();
                    });
                }, 3000);
            } catch (e) {
                _log.error('Error in showNotification:', e);
                alert('[文章复制工具] ' + message);
            }
        }
    };

    try {
        _log.info('Starting UIManager initialization...');
        UIManager.init();
        _log.info('Popup initialization complete');
    } catch (e) {
        _log.error('Critical error during popup initialization:', e);
        _log.error('Error details:', {
            message: e.message,
            name: e.name,
            stack: e.stack
        });
        
        try {
            alert('[文章复制工具] 初始化出错: ' + e.message);
        } catch (alertErr) {
            _log.error('Failed to show alert:', alertErr);
        }
    }
});
