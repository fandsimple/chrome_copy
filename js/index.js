$(document).ready(function() {
    'use strict';

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
            const defaultVal = this.defaults[key];
            chrome.storage.sync.get({ [key]: defaultVal }, function(data) {
                callback(data[key]);
            });
        },

        set: function(key, value, callback) {
            chrome.storage.sync.set({ [key]: value }, function() {
                if (callback) callback();
            });
        },

        toggle: function(key, callback) {
            const self = this;
            this.get(key, function(currentValue) {
                const newValue = currentValue === 'on' ? 'off' : 'on';
                self.set(key, newValue, function() {
                    if (callback) callback(newValue);
                });
            });
        },

        getAll: function(callback) {
            chrome.storage.sync.get(this.defaults, callback);
        }
    };

    const UIManager = {
        init: function() {
            this.loadAllSettings();
            this.bindEvents();
        },

        loadAllSettings: function() {
            const self = this;
            
            ConfigManager.getAll(function(settings) {
                Object.keys(settings).forEach(function(key) {
                    const value = settings[key];
                    const $element = $('#' + key.replace('Flag', ''));
                    
                    if ($element.length > 0) {
                        if (value === 'on') {
                            $element.prop('checked', true);
                        } else {
                            $element.prop('checked', false);
                        }
                    }
                });
            });
        },

        bindEvents: function() {
            const self = this;

            const platformIds = ['csdn', 'juejin', 'bokeyuan', 'jianshu', 'dgstack', 'bdwk'];
            const featureIds = ['aiSummary', 'aiSimplify', 'adFilter', 'keepFormat', 'autoCopy'];

            platformIds.forEach(function(id) {
                const storageKey = id + 'Flag';
                const $element = $('#' + id);
                
                ConfigManager.get(storageKey, function(value) {
                    $element.prop('checked', value === 'on');
                });

                $element.on('change', function() {
                    const isChecked = $(this).is(':checked');
                    ConfigManager.set(storageKey, isChecked ? 'on' : 'off');
                    self.showToast(isChecked ? '已启用' : '已禁用', self.getPlatformName(id));
                });
            });

            featureIds.forEach(function(id) {
                const $element = $('#' + id);
                
                ConfigManager.get(id, function(value) {
                    $element.prop('checked', value === 'on');
                });

                $element.on('change', function() {
                    const isChecked = $(this).is(':checked');
                    ConfigManager.set(id, isChecked ? 'on' : 'off');
                    self.showToast(isChecked ? '已启用' : '已禁用', self.getFeatureName(id));
                });
            });
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
            const $toast = $('<div class="toast-message">' + action + ' ' + item + '</div>');
            
            $toast.css({
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0, 0, 0, 0.8)',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '4px',
                fontSize: '12px',
                zIndex: '9999',
                opacity: '0',
                transition: 'opacity 0.3s ease'
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
            }, 1500);
        }
    };

    UIManager.init();
});
