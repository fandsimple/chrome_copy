(function() {
    'use strict';

    const _log = {
        debug: function() {
            if (window.Logger) {
                window.Logger.debug.apply(window.Logger, arguments);
            } else {
                console.log('[ChromeCopy Debug]', ...arguments);
            }
        },
        info: function() {
            if (window.Logger) {
                window.Logger.info.apply(window.Logger, arguments);
            } else {
                console.info('[ChromeCopy Info]', ...arguments);
            }
        },
        warn: function() {
            if (window.Logger) {
                window.Logger.warn.apply(window.Logger, arguments);
            } else {
                console.warn('[ChromeCopy Warn]', ...arguments);
            }
        },
        error: function() {
            if (window.Logger) {
                window.Logger.error.apply(window.Logger, arguments);
            } else {
                console.error('[ChromeCopy Error]', ...arguments);
            }
        }
    };

    const SCRIPT_ORDER = [
        'js/utils/logger.js',
        'js/baseJs/jquery-2.2.1.js',
        'js/baseJs/turndown.js',
        'js/baseJs/FileSaver.js',
        'js/baseJs/jquery.wordexport.js',
        'js/utils/content-enhancer.js',
        'js/ai/summarizer.js',
        'js/export/export-manager.js'
    ];

    const loadedScripts = new Set();
    const scriptLoadPromises = {};

    function injectScript(jsPath) {
        return new Promise(function(resolve, reject) {
            if (loadedScripts.has(jsPath)) {
                _log.debug('Script already loaded:', jsPath);
                resolve(true);
                return;
            }

            if (scriptLoadPromises[jsPath]) {
                _log.debug('Script already loading, waiting:', jsPath);
                resolve(scriptLoadPromises[jsPath]);
                return;
            }

            const timeoutId = setTimeout(function() {
                const error = new Error('Script load timeout: ' + jsPath);
                _log.error(error);
                reject(error);
                delete scriptLoadPromises[jsPath];
            }, 15000);

            const temp = document.createElement('script');
            temp.setAttribute('type', 'text/javascript');
            
            try {
                temp.src = chrome.extension.getURL(jsPath);
            } catch (e) {
                _log.error('Failed to get extension URL for:', jsPath, e);
                clearTimeout(timeoutId);
                reject(e);
                return;
            }

            _log.debug('Starting to load script:', jsPath);

            temp.onload = function() {
                clearTimeout(timeoutId);
                loadedScripts.add(jsPath);
                _log.info('Script loaded successfully:', jsPath);
                resolve(true);
                delete scriptLoadPromises[jsPath];
            };

            temp.onerror = function(event) {
                clearTimeout(timeoutId);
                const error = new Error('Failed to load script: ' + jsPath);
                _log.error('Script load error:', jsPath, event);
                reject(error);
                delete scriptLoadPromises[jsPath];
            };

            document.head.appendChild(temp);
            scriptLoadPromises[jsPath] = new Promise(function(r) { r(temp); });
        });
    }

    function loadScriptsInOrder(scripts) {
        _log.info('Loading scripts in order...');
        
        return scripts.reduce(function(promise, script) {
            return promise.then(function() {
                return injectScript(script);
            });
        }, Promise.resolve());
    }

    function detectPlatform() {
        const url = document.URL;
        _log.debug('Detecting platform from URL:', url);
        
        if (url.indexOf('csdn.net') >= 0) {
            _log.info('Platform detected: CSDN');
            return 'csdn';
        }
        if (url.indexOf('juejin.im') >= 0 || url.indexOf('juejin.cn') >= 0) {
            _log.info('Platform detected: 掘金');
            return 'juejin';
        }
        if (url.indexOf('cnblogs.com') >= 0) {
            _log.info('Platform detected: 博客园');
            return 'cnblogs';
        }
        if (url.indexOf('jianshu.com') >= 0) {
            _log.info('Platform detected: 简书');
            return 'jianshu';
        }
        if (url.indexOf('dgstack.cn') >= 0) {
            _log.info('Platform detected: 逗哥架构');
            return 'dgstack';
        }
        if (url.indexOf('wenku.baidu.com') >= 0) {
            _log.info('Platform detected: 百度文库');
            return 'bdwk';
        }
        if (url.indexOf('127.0.0.1:8000/') >= 0) {
            _log.info('Platform detected: Local (127.0.0.1:8000)');
            return 'local';
        }
        
        _log.warn('Platform not detected for URL:', url);
        return 'unknown';
    }

    const platformConfig = {
        csdn: {
            flagKey: 'csdnFlag',
            exportScript: 'js/export/csdn.js',
            contentScript: 'js/contentJs/csdn.js',
            initFunction: 'csdn'
        },
        juejin: {
            flagKey: 'juejinFlag',
            exportScript: 'js/export/juejin.js',
            contentScript: 'js/contentJs/juejin.js',
            initFunction: 'juejin'
        },
        cnblogs: {
            flagKey: 'bokeyuanFlag',
            exportScript: 'js/export/bokeyuan.js',
            contentScript: 'js/contentJs/bokeyuan.js',
            initFunction: 'bokeyuan'
        },
        jianshu: {
            flagKey: 'jianshuFlag',
            exportScript: 'js/export/jianshu.js',
            contentScript: 'js/contentJs/jianshu.js',
            initFunction: 'jianshu'
        },
        dgstack: {
            flagKey: 'dgstackFlag',
            exportScript: 'js/export/dgstack.js',
            contentScript: 'js/contentJs/dgstack.js',
            initFunction: 'dgstack'
        },
        bdwk: {
            flagKey: 'bdwkFlag',
            exportScript: 'js/export/bdwk.js',
            contentScript: 'js/contentJs/bdwk.js',
            initFunction: 'bdwk'
        },
        local: {
            flagKey: null,
            exportScript: 'js/export/local.js',
            contentScript: 'js/contentJs/local.js',
            initFunction: null
        }
    };

    function initializePlatform(platform) {
        const config = platformConfig[platform];
        
        if (!config) {
            _log.warn('No config for platform:', platform);
            return;
        }

        _log.info('Initializing platform:', platform);

        if (config.flagKey) {
            _log.debug('Checking flag:', config.flagKey);
            
            try {
                chrome.storage.sync.get({ [config.flagKey]: 'off' }, function(data) {
                    _log.debug('Flag value for', config.flagKey, ':', data[config.flagKey]);
                    
                    if (data[config.flagKey] === 'on') {
                        _log.info('Platform enabled, loading platform scripts...');
                        loadPlatformScripts(config);
                    } else {
                        _log.info('Platform disabled, skipping initialization');
                    }
                });
            } catch (e) {
                _log.error('Error checking platform flag:', e);
                _log.error('Error details:', {
                    message: e.message,
                    name: e.name,
                    stack: e.stack
                });
            }
        } else {
            _log.info('No flag check for platform, loading scripts directly...');
            loadPlatformScripts(config);
        }
    }

    function loadPlatformScripts(config) {
        const scriptsToLoad = [];

        if (config.contentScript) {
            scriptsToLoad.push(config.contentScript);
        }
        if (config.exportScript) {
            scriptsToLoad.push(config.exportScript);
        }

        _log.info('Loading platform scripts:', scriptsToLoad);

        loadScriptsInOrder(scriptsToLoad)
            .then(function() {
                _log.info('Platform scripts loaded successfully');
                
                if (config.initFunction && window[config.initFunction]) {
                    _log.info('Calling init function:', config.initFunction);
                    try {
                        window[config.initFunction]();
                    } catch (e) {
                        _log.error('Error calling init function:', config.initFunction, e);
                    }
                }
            })
            .catch(function(error) {
                _log.error('Failed to load platform scripts:', error);
                _log.error('Error details:', {
                    message: error.message,
                    name: error.name,
                    stack: error.stack
                });
                
                _log.warn('Attempting fallback to original export logic...');
                
                if (config.exportScript) {
                    injectScript(config.exportScript).catch(function(e) {
                        _log.error('Fallback also failed:', e);
                    });
                }
            });
    }

    function main() {
        _log.info('=== ChromeCopy Extension Starting ===');
        _log.info('URL:', document.URL);
        _log.info('Document ready state:', document.readyState);

        const platform = detectPlatform();

        if (platform === 'unknown') {
            _log.info('Unknown platform, extension will not activate on this page');
            return;
        }

        loadScriptsInOrder(SCRIPT_ORDER)
            .then(function() {
                _log.info('All core scripts loaded successfully');
                initializePlatform(platform);
            })
            .catch(function(error) {
                _log.error('Failed to load core scripts:', error);
                _log.error('Error details:', {
                    message: error.message,
                    name: error.name,
                    stack: error.stack
                });
                
                _log.warn('Attempting fallback initialization...');
                
                try {
                    injectScript('js/baseJs/jquery-2.2.1.js')
                        .then(function() {
                            return injectScript('js/baseJs/turndown.js');
                        })
                        .then(function() {
                            initializePlatform(platform);
                        })
                        .catch(function(e) {
                            _log.error('Fallback initialization also failed:', e);
                        });
                } catch (e) {
                    _log.error('Critical error during fallback:', e);
                }
            });
    }

    window.addEventListener('unhandledrejection', function(event) {
        _log.error('Unhandled Promise Rejection detected!');
        _log.error('Event:', event);
        
        let reason = event.reason;
        if (reason instanceof Error) {
            _log.error('Error message:', reason.message);
            _log.error('Error stack:', reason.stack);
            _log.error('Error name:', reason.name);
        } else if (typeof reason === 'object') {
            try {
                _log.error('Reason object:', JSON.stringify(reason));
            } catch (e) {
                _log.error('Reason object (cannot stringify):', reason);
            }
        } else {
            _log.error('Reason:', String(reason));
        }
        
        event.preventDefault();
    });

    window.onerror = function(message, source, lineno, colno, error) {
        _log.error('Global error caught!');
        _log.error('Message:', message);
        _log.error('Source:', source);
        _log.error('Line:', lineno);
        _log.error('Column:', colno);
        
        if (error) {
            _log.error('Error object:', error);
            _log.error('Error stack:', error.stack);
        }
        
        return false;
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        _log.info('Document already ready, starting immediately');
        setTimeout(main, 0);
    } else {
        _log.info('Waiting for document to load...');
        document.addEventListener('DOMContentLoaded', function() {
            _log.info('DOMContentLoaded fired');
            main();
        });
        
        window.addEventListener('load', function() {
            _log.info('Window load fired');
            if (!loadedScripts.has(SCRIPT_ORDER[0])) {
                main();
            }
        });
    }

})();
