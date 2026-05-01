(function(window, $) {
    'use strict';

    const _log = {
        debug: function() { 
            if (window.Logger) window.Logger.debug.apply(window.Logger, arguments);
            else console.log('[ChromeCopy local Debug]', ...arguments);
        },
        info: function() { 
            if (window.Logger) window.Logger.info.apply(window.Logger, arguments);
            else console.info('[ChromeCopy local Info]', ...arguments);
        },
        error: function() { 
            if (window.Logger) window.Logger.error.apply(window.Logger, arguments);
            else console.error('[ChromeCopy local Error]', ...arguments);
        }
    };

    _log.info('local.js loaded');

    function inject(jsPath) {
        _log.info('inject called, jsPath:', jsPath);
        
        try {
            jsPath = jsPath || 'js/export/local1.js';
            var temp = document.createElement('script');
            temp.setAttribute('type', 'text/javascript');
            
            try {
                temp.src = chrome.extension.getURL(jsPath);
            } catch (e) {
                _log.error('Failed to get extension URL:', e);
                return;
            }
            
            document.head.appendChild(temp);
            _log.info('Injected script:', temp.src);
        } catch (e) {
            _log.error('Error in inject:', e);
        }
    }

    function exportArticle() {
        _log.info('local exportArticle called');
        
        try {
            if (window.ExportManager) {
                _log.info('Using ExportManager for local');
                
                window.ExportManager.exportArticle(
                    'h1, .title, .article-title, .post-title',
                    [
                        'article',
                        '.article-content',
                        '.post-content',
                        '.entry-content',
                        '#article-content',
                        '.content'
                    ],
                    'local'
                );
                return;
            }
            
            _log.warn('ExportManager not available, using fallback inject');
            inject("js/export/local1.js");
        } catch (e) {
            _log.error('Error in exportArticle:', e);
            _log.error('Error details:', {
                message: e.message,
                name: e.name,
                stack: e.stack
            });
        }
    }

    function bindExportButton() {
        _log.debug('bindExportButton called');
        
        try {
            const $button = $('#importButton');
            
            if ($button.length > 0) {
                _log.info('Found importButton, binding click event directly');
                $button.off('click').on('click', exportArticle);
            } else {
                _log.debug('importButton not found yet, using event delegation');
            }
            
            $(document).off('click', '#importButton').on('click', '#importButton', function(event) {
                _log.info('importButton clicked (event delegation)');
                event.preventDefault();
                exportArticle();
            });
            
            _log.info('Export button binding complete');
            
        } catch (e) {
            _log.error('Error in bindExportButton:', e);
        }
    }

    function init() {
        _log.info('local.js init called');
        
        try {
            if (typeof $ === 'undefined') {
                _log.error('jQuery not available!');
                return;
            }
            
            bindExportButton();
            
            if (document.readyState === 'complete' || document.readyState === 'interactive') {
                _log.debug('Document already ready, checking button again');
                setTimeout(bindExportButton, 100);
                setTimeout(bindExportButton, 500);
                setTimeout(bindExportButton, 1000);
            } else {
                $(document).ready(function() {
                    _log.debug('Document ready, checking button');
                    setTimeout(bindExportButton, 100);
                });
            }
            
        } catch (e) {
            _log.error('Error during local init:', e);
        }
    }

    window.localExport = exportArticle;

    try {
        init();
    } catch (e) {
        _log.error('Critical error in local.js:', e);
    }

})(window, window.jQuery || window.$);
