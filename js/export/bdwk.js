(function(window, $) {
    'use strict';

    const _log = {
        debug: function() { 
            if (window.Logger) window.Logger.debug.apply(window.Logger, arguments);
            else console.log('[ChromeCopy bdwk Debug]', ...arguments);
        },
        info: function() { 
            if (window.Logger) window.Logger.info.apply(window.Logger, arguments);
            else console.info('[ChromeCopy bdwk Info]', ...arguments);
        },
        error: function() { 
            if (window.Logger) window.Logger.error.apply(window.Logger, arguments);
            else console.error('[ChromeCopy bdwk Error]', ...arguments);
        }
    };

    _log.info('bdwk.js loaded');

    function exportArticle() {
        _log.info('baiduwenku exportArticle called');
        
        try {
            if (window.ExportManager) {
                _log.info('Using ExportManager for baiduwk');
                
                window.ExportManager.exportArticle(
                    'h1.title, .doc-title, .reader-title',
                    [
                        'div#reader-container',
                        '.reader-container',
                        '.doc-content',
                        '.article-content'
                    ],
                    'bdwk'
                );
                return;
            }
            
            _log.warn('ExportManager not available, using fallback (wordExport)');
            $('html').wordExport('文档下载');
            
        } catch (e) {
            _log.error('Error in exportArticle:', e);
            _log.error('Error details:', {
                message: e.message,
                name: e.name,
                stack: e.stack
            });
            
            try {
                alert('导出失败: ' + e.message);
            } catch (alertErr) {
                _log.error('Failed to show alert:', alertErr);
            }
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
        _log.info('bdwk.js init called');
        
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
            _log.error('Error during bdwk init:', e);
        }
    }

    window.bdwkExport = exportArticle;

    try {
        init();
    } catch (e) {
        _log.error('Critical error in bdwk.js:', e);
    }

})(window, window.jQuery || window.$);
