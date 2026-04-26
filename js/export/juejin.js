(function(window, $) {
    'use strict';

    const _log = {
        debug: function() { 
            if (window.Logger) window.Logger.debug.apply(window.Logger, arguments);
            else console.log('[ChromeCopy juejin Debug]', ...arguments);
        },
        info: function() { 
            if (window.Logger) window.Logger.info.apply(window.Logger, arguments);
            else console.info('[ChromeCopy juejin Info]', ...arguments);
        },
        error: function() { 
            if (window.Logger) window.Logger.error.apply(window.Logger, arguments);
            else console.error('[ChromeCopy juejin Error]', ...arguments);
        }
    };

    _log.info('juejin.js loaded');

    function exportArticle() {
        _log.info('juejin exportArticle called');
        
        try {
            if (window.ExportManager) {
                _log.info('Using ExportManager for juejin');
                
                window.ExportManager.exportArticle(
                    'h1.article-title, .article-title h1, .title',
                    [
                        'div.article-content',
                        '.article-content-wrapper',
                        '.markdown-body',
                        '.article-detail',
                        '.article-content'
                    ],
                    'juejin'
                );
                return;
            }
            
            _log.warn('ExportManager not available, using fallback');
            
            var title = '# ' +  $('h1.article-title').text();
            var content = $('div.article-content').html();
            var turndownService = new window.TurndownService();
            var markdown = turndownService.turndown(content);
            markdown = title + '\n' + markdown;
            
            var $textarea_content = $('<textarea name="content" id="" cols="30" rows="10" style="position: absolute;top: 0;left: 0;opacity: 0;z-index: -10;">' + markdown + '</textarea>');
            $('body').append($textarea_content);
            $textarea_content.select();
            var isSuccess = document.execCommand('copy');
            $textarea_content.remove();
            
            if(isSuccess){
                alert('导出文章到粘贴板成功！！！');
            }else {
                alert('导出文章内容失败，请重试！！！');
            }
            _log.debug('Exported markdown length:', markdown.length);
            
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
        _log.info('juejin.js init called');
        
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
            _log.error('Error during juejin init:', e);
        }
    }

    window.juejinExport = exportArticle;

    try {
        init();
    } catch (e) {
        _log.error('Critical error in juejin.js:', e);
    }

})(window, window.jQuery || window.$);
