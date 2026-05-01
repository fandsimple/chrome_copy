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
    } else if (document.URL.indexOf('zhihu.com') >= 0) { // 知乎
        chrome.storage.sync.get({zhihuFlag: 'off'}, function (data) {
            if (data.zhihuFlag == 'on') {
                injectCustomJs("js/export/zhihu.js"); // 向页面中注入js文件，可以进行回调
                zhihu();
            }
        });
    } else if (document.URL.indexOf('oschina.net') >= 0) { // 开源中国
        chrome.storage.sync.get({oschinaFlag: 'off'}, function (data) {
            if (data.oschinaFlag == 'on') {
                injectCustomJs("js/export/oschina.js"); // 向页面中注入js文件，可以进行回调
                oschina();
            }
        });
    } else if (document.URL.indexOf('127.0.0.1:8000/') >= 0) { // 测试

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
}

function injectCustomJs(jsPath) { // 注入函数
    jsPath = jsPath || 'js/export/csdn.js';
    var temp = document.createElement('script');
    temp.setAttribute('type', 'text/javascript');
    temp.src = chrome.extension.getURL(jsPath);
    console.log(temp.src, '路径');
    // temp.onload = function () {
    //     // 放在页面不好看，执行完后移除掉
    //     this.parentNode.removeChild(this);
    // };
    document.head.appendChild(temp);
}

function importLib() { // 引入三方库
    injectCustomJs('js/baseJs/jquery-2.2.1.js'); // jquery
    injectCustomJs('js/baseJs/turndown.js'); // html to markdown
    injectCustomJs('js/baseJs/FileSaver.js'); // html to word
    injectCustomJs('js/baseJs/jquery.wordexport.js'); // html to word
}

window.onload = main(); // 入口函数

// 消息监听器
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'previewArticle') {
        // 获取当前页面的文章内容并转换为 Markdown
        var markdown = getArticleMarkdown();
        sendResponse({markdown: markdown});
    } else if (request.action === 'exportArticle') {
        // 执行导出操作
        exportArticle();
        sendResponse({success: true});
    } else if (request.action === 'downloadMarkdown') {
        // 下载 .md 文件
        downloadMarkdownFile();
        sendResponse({success: true});
    }
});

// 获取文章 Markdown 内容
function getArticleMarkdown() {
    var title = '';
    var content = '';
    
    if (document.URL.indexOf('csdn.net') >= 0) {
        title = '# ' + $('div.article-title-box h1').text();
        content = $('div#article_content').html();
    } else if (document.URL.indexOf('juejin.im') >= 0) {
        title = '# ' + $('.article-title').text();
        content = $('.article-content').html();
    } else if (document.URL.indexOf('cnblogs.com') >= 0) {
        title = '# ' + $('.postTitle').text();
        content = $('.postBody').html();
    } else if (document.URL.indexOf('jianshu.com') >= 0) {
        title = '# ' + $('.title').text();
        content = $('.show-content').html();
    } else if (document.URL.indexOf('dgstack.cn') >= 0) {
        title = '# ' + $('.article-header h1').text();
        content = $('.article-content').html();
    } else if (document.URL.indexOf('wenku.baidu.com') >= 0) {
        title = '# ' + $('.doc-title').text();
        content = $('.reader-page-content').html();
    } else if (document.URL.indexOf('zhihu.com') >= 0) {
        if (document.URL.indexOf('zhuanlan.zhihu.com') >= 0) {
            title = '# ' + $('h1.Post-Title').text();
            content = $('div.Post-RichTextContainer').html();
        } else if (document.URL.indexOf('/question/') >= 0) {
            title = '# ' + $('h1.QuestionHeader-title').text();
            content = $('div.QuestionAnswer-content').html();
        } else if (document.URL.indexOf('/answer/') >= 0) {
            title = '# ' + $('h1.QuestionHeader-title').text();
            content = $('div.AnswerItem-content').html();
        }
    } else if (document.URL.indexOf('oschina.net') >= 0) {
        title = '# ' + $('.article-header h1').text();
        content = $('.article-content').html();
    }
    
    var turndownService = new window.TurndownService();
    var markdown = turndownService.turndown(content);
    return title + '\n' + markdown;
}

// 下载 .md 文件
function downloadMarkdownFile() {
    var markdown = getArticleMarkdown();
    var blob = new Blob([markdown], {type: 'text/markdown;charset=utf-8;'});
    saveAs(blob, 'article.md');
}
