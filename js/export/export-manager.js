(function(window) {
    'use strict';

    const log = window.Logger || {
        debug: function() {},
        info: function() {},
        warn: function() { console.warn.apply(console, arguments); },
        error: function() { console.error.apply(console, arguments); }
    };

    const ExportManager = {
        config: {
            aiSummary: false,
            aiSimplify: false,
            adFilter: true,
            keepFormat: true,
            autoCopy: true
        },

        _initialized: false,

        init: function(callback) {
            const self = this;
            
            log.info('ExportManager.init() called');
            log.debug('Current config:', this.config);

            try {
                chrome.storage.sync.get({
                    aiSummary: 'off',
                    aiSimplify: 'off',
                    adFilter: 'on',
                    keepFormat: 'on',
                    autoCopy: 'on'
                }, function(data) {
                    try {
                        log.info('chrome.storage.sync.get callback executed');
                        log.debug('Storage data:', data);

                        self.config.aiSummary = data.aiSummary === 'on';
                        self.config.aiSimplify = data.aiSimplify === 'on';
                        self.config.adFilter = data.adFilter === 'on';
                        self.config.keepFormat = data.keepFormat === 'on';
                        self.config.autoCopy = data.autoCopy === 'on';

                        log.info('ExportManager config loaded:', self.config);
                        self._initialized = true;

                        if (callback) {
                            try {
                                callback();
                            } catch (e) {
                                log.error('Error in ExportManager.init callback:', e);
                            }
                        }
                    } catch (e) {
                        log.error('Error processing storage data:', e);
                        self._initialized = true;
                        if (callback) callback();
                    }
                });
            } catch (e) {
                log.error('Error calling chrome.storage.sync.get:', e);
                log.error('Error details:', {
                    message: e.message,
                    name: e.name,
                    stack: e.stack
                });
                this._initialized = true;
                if (callback) {
                    try {
                        callback();
                    } catch (cbErr) {
                        log.error('Error in fallback callback:', cbErr);
                    }
                }
            }
        },

        processContent: function(html, title, platform) {
            log.group('ExportManager.processContent');
            log.info('Processing content for platform:', platform);
            log.debug('Title:', title);
            log.debug('HTML length:', html ? html.length : 0);

            let processedHtml = html;
            let processedTitle = title || '';
            let summary = '';
            let keywords = [];
            let metadata = {};

            try {
                if (this.config.adFilter && window.ContentEnhancer) {
                    log.info('Applying ad filter via ContentEnhancer');
                    try {
                        const $cleaned = $('<div>').html(processedHtml);
                        window.ContentEnhancer.enhanceContent($cleaned, platform);
                        processedHtml = $cleaned.html();
                        log.info('Content enhanced, new length:', processedHtml ? processedHtml.length : 0);
                    } catch (e) {
                        log.error('Error during content enhancement:', e);
                    }
                } else {
                    log.debug('Ad filter disabled or ContentEnhancer not available');
                    log.debug('adFilter config:', this.config.adFilter);
                    log.debug('ContentEnhancer available:', !!window.ContentEnhancer);
                }

                log.info('Converting HTML to Markdown...');
                let markdown = this.htmlToMarkdown(processedHtml);
                log.info('Markdown conversion complete, length:', markdown ? markdown.length : 0);

                if (window.ContentEnhancer) {
                    log.info('Processing Markdown with ContentEnhancer...');
                    try {
                        markdown = window.ContentEnhancer.processMarkdown(markdown, {
                            removeNoise: true,
                            removeEmptyLines: true
                        });
                        log.info('Markdown processed, length:', markdown ? markdown.length : 0);
                    } catch (e) {
                        log.error('Error during markdown processing:', e);
                    }
                }

                if (this.config.aiSummary && window.ChineseSummarizer && markdown) {
                    log.info('Generating AI summary...');
                    try {
                        const plainText = this.markdownToPlainText(markdown);
                        log.debug('Plain text length for summarization:', plainText.length);

                        const summaryResult = window.ChineseSummarizer.summarize(
                            plainText, 
                            processedTitle,
                            {
                                maxSentences: 5,
                                summaryRatio: 0.2
                            }
                        );

                        log.info('Summary generated:', summaryResult);
                        
                        summary = summaryResult.summary;
                        keywords = summaryResult.keywords || [];
                        metadata = {
                            originalLength: summaryResult.originalLength,
                            summaryLength: summaryResult.summaryLength,
                            compressionRatio: summaryResult.compressionRatio
                        };

                        if (window.ContentEnhancer && summary) {
                            log.info('Inserting summary into markdown...');
                            markdown = window.ContentEnhancer.insertSummary(markdown, summary, keywords);
                        }
                    } catch (e) {
                        log.error('Error during AI summarization:', e);
                        log.error('Summary error details:', {
                            message: e.message,
                            name: e.name,
                            stack: e.stack
                        });
                    }
                } else {
                    log.debug('AI summary skipped:', {
                        aiSummaryEnabled: this.config.aiSummary,
                        ChineseSummarizerAvailable: !!window.ChineseSummarizer,
                        hasMarkdown: !!markdown
                    });
                }

                if (this.config.aiSimplify && window.ChineseSummarizer && markdown) {
                    log.info('Applying AI simplification...');
                    try {
                        const plainText = this.markdownToPlainText(markdown);
                        const simplified = window.ChineseSummarizer.smartSimplify(plainText, {
                            maxLength: 3000,
                            removeRedundant: true,
                            removeDuplicate: true
                        });
                        
                        log.info('Content simplified, original:', plainText.length, 'simplified:', simplified.length);
                        
                        if (simplified.length < plainText.length * 0.8) {
                            const simpleMarkdown = '# ' + processedTitle + '\n\n' + simplified;
                            markdown = simpleMarkdown + '\n\n---\n\n' + markdown;
                            log.info('Simplified version inserted');
                        }
                    } catch (e) {
                        log.error('Error during AI simplification:', e);
                    }
                }

                if (processedTitle) {
                    if (!markdown.startsWith('# ')) {
                        log.info('Prepending title to markdown');
                        markdown = '# ' + processedTitle + '\n\n' + markdown;
                    }
                }

                const result = {
                    markdown: markdown,
                    summary: summary,
                    keywords: keywords,
                    metadata: metadata,
                    title: processedTitle
                };

                log.info('Content processing complete');
                log.debug('Final result:', {
                    markdownLength: result.markdown ? result.markdown.length : 0,
                    hasSummary: !!result.summary,
                    keywordCount: result.keywords ? result.keywords.length : 0
                });

                log.groupEnd();
                return result;

            } catch (e) {
                log.error('Unexpected error in processContent:', e);
                log.error('Error stack:', e.stack);
                log.groupEnd();
                
                return {
                    markdown: this.htmlToMarkdown(processedHtml),
                    summary: '',
                    keywords: [],
                    metadata: {},
                    title: processedTitle
                };
            }
        },

        htmlToMarkdown: function(html) {
            log.debug('htmlToMarkdown called, HTML length:', html ? html.length : 0);
            
            if (!html) {
                log.warn('htmlToMarkdown: empty HTML provided');
                return '';
            }

            if (window.TurndownService) {
                log.info('Using TurndownService for conversion');
                try {
                    const turndownService = new window.TurndownService({
                        headingStyle: 'atx',
                        codeBlockStyle: 'fenced',
                        bulletListMarker: '-',
                        emDelimiter: '*'
                    });

                    turndownService.addRule('codeBlock', {
                        filter: ['pre'],
                        replacement: function(content, node) {
                            const language = node.getAttribute('data-lang') || 
                                           node.getAttribute('language') || 
                                           '';
                            return '\n```' + language + '\n' + 
                                   node.textContent + 
                                   '\n```\n';
                        }
                    });

                    turndownService.addRule('inlineCode', {
                        filter: ['code'],
                        replacement: function(content) {
                            return '`' + content + '`';
                        }
                    });

                    turndownService.addRule('table', {
                        filter: ['table'],
                        replacement: function(content, node) {
                            try {
                                let result = '\n';
                                const $table = $(node);
                                const rows = $table.find('tr');
                                
                                if (rows.length > 0) {
                                    const headerCells = $(rows[0]).find('th, td');
                                    const headers = headerCells.map(function() {
                                        return $(this).text().trim();
                                    }).get();
                                    
                                    result += '| ' + headers.join(' | ') + ' |\n';
                                    result += '| ' + headers.map(function() { return '---'; }).join(' | ') + ' |\n';
                                    
                                    for (let i = 1; i < rows.length; i++) {
                                        const cells = $(rows[i]).find('td, th');
                                        const cellTexts = cells.map(function() {
                                            return $(this).text().trim();
                                        }).get();
                                        result += '| ' + cellTexts.join(' | ') + ' |\n';
                                    }
                                }
                                
                                return result + '\n';
                            } catch (e) {
                                log.error('Error processing table:', e);
                                return '\n' + node.textContent + '\n';
                            }
                        }
                    });

                    const markdown = turndownService.turndown(html);
                    log.info('Turndown conversion successful, length:', markdown.length);
                    return markdown;
                } catch (e) {
                    log.error('Turndown conversion error:', e);
                    log.error('Falling back to simpleHtmlToMarkdown');
                    return this.simpleHtmlToMarkdown(html);
                }
            }

            log.warn('TurndownService not available, using simpleHtmlToMarkdown');
            return this.simpleHtmlToMarkdown(html);
        },

        simpleHtmlToMarkdown: function(html) {
            if (!html) return '';
            
            log.debug('simpleHtmlToMarkdown called');
            
            let markdown = html;
            
            try {
                markdown = markdown.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
                markdown = markdown.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
                markdown = markdown.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
                markdown = markdown.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n');
                markdown = markdown.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '##### $1\n\n');
                markdown = markdown.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '###### $1\n\n');
                
                markdown = markdown.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
                markdown = markdown.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
                markdown = markdown.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
                markdown = markdown.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
                
                markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
                markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)');
                markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![image]($1)');
                
                markdown = markdown.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');
                markdown = markdown.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
                
                markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, function(match, content) {
                    return '\n' + content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n') + '\n';
                });
                markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, function(match, content) {
                    let index = 1;
                    return '\n' + content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, function() {
                        return index++ + '. ' + arguments[1] + '\n';
                    }) + '\n';
                });
                
                markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
                markdown = markdown.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
                markdown = markdown.replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, '$1\n');
                markdown = markdown.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1');
                
                markdown = markdown.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
                markdown = markdown.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
                markdown = markdown.replace(/<[^>]+>/g, '');
                
                markdown = markdown.replace(/\n{3,}/g, '\n\n');
                markdown = markdown.trim();
            } catch (e) {
                log.error('Error in simpleHtmlToMarkdown:', e);
            }
            
            return markdown;
        },

        markdownToPlainText: function(markdown) {
            if (!markdown) return '';
            
            log.debug('markdownToPlainText called, length:', markdown.length);
            
            let text = markdown;
            
            try {
                text = text.replace(/^#+\s+/gm, '');
                text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
                text = text.replace(/\*([^*]+)\*/g, '$1');
                text = text.replace(/`([^`]+)`/g, '$1');
                text = text.replace(/```[\s\S]*?```/g, '');
                text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
                text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
                text = text.replace(/^[-*+]\s+/gm, '');
                text = text.replace(/^\d+\.\s+/gm, '');
                text = text.replace(/^\|.+\|$/gm, '');
                text = text.replace(/^---+$/gm, '');
                text = text.replace(/[#*`_\[\]()!|]/g, '');
                text = text.replace(/\n{3,}/g, '\n\n');
                text = text.trim();
            } catch (e) {
                log.error('Error in markdownToPlainText:', e);
            }
            
            return text;
        },

        copyToClipboard: function(text, callback) {
            log.info('copyToClipboard called, text length:', text ? text.length : 0);
            
            const self = this;
            
            if (!this.config.autoCopy) {
                log.info('autoCopy is disabled');
                if (callback) callback(false, '自动复制已禁用');
                return;
            }

            try {
                const $textarea = $('<textarea>', {
                    name: 'content',
                    style: 'position: absolute; top: 0; left: 0; opacity: 0; z-index: -10; width: 1px; height: 1px;'
                }).text(text);
                
                $('body').append($textarea);
                $textarea[0].select();
                
                const isSuccess = document.execCommand('copy');
                $textarea.remove();
                
                log.info('Copy to clipboard result:', isSuccess ? 'success' : 'failed');
                
                if (callback) {
                    if (isSuccess) {
                        callback(true, '已复制到剪贴板');
                    } else {
                        callback(false, '复制失败，请重试');
                    }
                }
            } catch (e) {
                log.error('Clipboard copy error:', e);
                if (callback) callback(false, '复制异常: ' + e.message);
            }
        },

        showNotification: function(message, type) {
            log.debug('showNotification called:', message, 'type:', type);
            
            type = type || 'info';
            
            const bgColors = {
                success: '#27ae60',
                error: '#e74c3c',
                warning: '#f39c12',
                info: '#3498db'
            };

            try {
                const $existing = $('.export-notification');
                if ($existing.length > 0) {
                    $existing.remove();
                }

                const $notification = $('<div>', {
                    class: 'export-notification',
                    css: {
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '14px',
                        fontWeight: '500',
                        zIndex: '999999',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        transform: 'translateX(120%)',
                        transition: 'transform 0.3s ease',
                        backgroundColor: bgColors[type] || bgColors.info,
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                    }
                }).text('[文章复制工具] ' + message);

                $('body').append($notification);

                setTimeout(function() {
                    $notification.css('transform', 'translateX(0)');
                }, 10);

                setTimeout(function() {
                    $notification.css('transform', 'translateX(120%)');
                    setTimeout(function() {
                        $notification.remove();
                    }, 300);
                }, 4000);
            } catch (e) {
                log.error('Error showing notification:', e);
                alert('[文章复制工具] ' + message);
            }
        },

        exportArticle: function(titleSelector, contentSelectors, platform) {
            log.group('ExportManager.exportArticle');
            log.info('Exporting article from platform:', platform);
            log.debug('Title selector:', titleSelector);
            log.debug('Content selectors:', contentSelectors);

            const self = this;
            
            try {
                this.init(function() {
                    log.info('ExportManager initialized, starting export process...');
                    
                    let title = '';
                    let content = '';

                    try {
                        if (titleSelector) {
                            const $title = $(titleSelector).first();
                            if ($title.length > 0) {
                                title = $title.text().trim();
                                log.info('Found title:', title);
                            } else {
                                log.warn('Title selector found no elements:', titleSelector);
                            }
                        }

                        if (!title && window.ContentEnhancer) {
                            log.info('Trying ContentEnhancer.extractTitle...');
                            title = window.ContentEnhancer.extractTitle($, platform);
                            log.info('Title from ContentEnhancer:', title);
                        }

                        if (contentSelectors && contentSelectors.length > 0) {
                            for (let i = 0; i < contentSelectors.length; i++) {
                                const selector = contentSelectors[i];
                                log.debug('Trying content selector:', selector);
                                
                                const $content = $(selector).first();
                                if ($content.length > 0) {
                                    content = $content.html();
                                    log.info('Content found with selector:', selector, 'length:', content ? content.length : 0);
                                    
                                    if (content && content.length > 50) {
                                        break;
                                    }
                                }
                            }
                        }

                        if (!content || content.length < 50) {
                            log.warn('No content found with standard selectors');
                            
                            if (window.ContentEnhancer) {
                                log.info('Trying ContentEnhancer.extractContent...');
                                content = window.ContentEnhancer.extractContent($, platform);
                                log.info('Content from ContentEnhancer length:', content ? content.length : 0);
                            }
                        }

                        if (!content || content.length < 50) {
                            log.error('Failed to extract article content');
                            self.showNotification('未能提取到文章内容', 'error');
                            log.groupEnd();
                            return;
                        }

                        log.info('Processing extracted content...');
                        const result = self.processContent(content, title, platform);

                        if (!result.markdown || result.markdown.trim().length === 0) {
                            log.error('Content processing returned empty markdown');
                            self.showNotification('内容处理失败', 'error');
                            log.groupEnd();
                            return;
                        }

                        log.info('Copying to clipboard...');
                        self.copyToClipboard(result.markdown, function(success, message) {
                            if (success) {
                                let info = message;
                                if (result.metadata && result.metadata.compressionRatio) {
                                    info += ' (压缩率: ' + result.metadata.compressionRatio + '%)';
                                }
                                self.showNotification(info, 'success');
                                log.info('Export completed successfully!');
                            } else {
                                self.showNotification(message, 'error');
                                log.error('Export failed:', message);
                            }
                        });

                        log.debug('Export result:', {
                            title: result.title,
                            summaryLength: result.summary ? result.summary.length : 0,
                            keywordCount: result.keywords ? result.keywords.length : 0,
                            markdownLength: result.markdown ? result.markdown.length : 0
                        });

                    } catch (e) {
                        log.error('Error during export process:', e);
                        log.error('Error details:', {
                            message: e.message,
                            name: e.name,
                            stack: e.stack
                        });
                        self.showNotification('导出过程中发生错误: ' + e.message, 'error');
                    }
                    
                    log.groupEnd();
                });
            } catch (e) {
                log.error('Unexpected error in exportArticle:', e);
                log.error('Error stack:', e.stack);
                this.showNotification('导出失败: ' + e.message, 'error');
                log.groupEnd();
            }
        }
    };

    window.ExportManager = ExportManager;
    log.info('ExportManager registered to window');

})(window);
