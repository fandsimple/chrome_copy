(function(window) {
    'use strict';

    const ExportManager = {
        config: {
            aiSummary: false,
            aiSimplify: false,
            adFilter: true,
            keepFormat: true,
            autoCopy: true
        },

        init: function(callback) {
            const self = this;
            
            chrome.storage.sync.get({
                aiSummary: 'off',
                aiSimplify: 'off',
                adFilter: 'on',
                keepFormat: 'on',
                autoCopy: 'on'
            }, function(data) {
                self.config.aiSummary = data.aiSummary === 'on';
                self.config.aiSimplify = data.aiSimplify === 'on';
                self.config.adFilter = data.adFilter === 'on';
                self.config.keepFormat = data.keepFormat === 'on';
                self.config.autoCopy = data.autoCopy === 'on';
                
                if (callback) callback();
            });
        },

        processContent: function(html, title, platform) {
            let processedHtml = html;
            let processedTitle = title || '';
            let summary = '';
            let keywords = [];
            let metadata = {};

            if (this.config.adFilter && window.ContentEnhancer) {
                const $cleaned = $('<div>').html(processedHtml);
                window.ContentEnhancer.enhanceContent($cleaned, platform);
                processedHtml = $cleaned.html();
            }

            let markdown = this.htmlToMarkdown(processedHtml);

            if (window.ContentEnhancer) {
                markdown = window.ContentEnhancer.processMarkdown(markdown, {
                    removeNoise: true,
                    removeEmptyLines: true
                });
            }

            if (this.config.aiSummary && window.ChineseSummarizer && markdown) {
                const plainText = this.markdownToPlainText(markdown);
                const summaryResult = window.ChineseSummarizer.summarize(
                    plainText, 
                    processedTitle,
                    {
                        maxSentences: 5,
                        summaryRatio: 0.2
                    }
                );
                
                summary = summaryResult.summary;
                keywords = summaryResult.keywords || [];
                metadata = {
                    originalLength: summaryResult.originalLength,
                    summaryLength: summaryResult.summaryLength,
                    compressionRatio: summaryResult.compressionRatio
                };

                if (window.ContentEnhancer && summary) {
                    markdown = window.ContentEnhancer.insertSummary(markdown, summary, keywords);
                }
            }

            if (this.config.aiSimplify && window.ChineseSummarizer && markdown) {
                const plainText = this.markdownToPlainText(markdown);
                const simplified = window.ChineseSummarizer.smartSimplify(plainText, {
                    maxLength: 3000,
                    removeRedundant: true,
                    removeDuplicate: true
                });
                
                if (simplified.length < plainText.length * 0.8) {
                    const simpleMarkdown = '# ' + processedTitle + '\n\n' + simplified;
                    markdown = simpleMarkdown + '\n\n---\n\n' + markdown;
                }
            }

            if (processedTitle) {
                if (!markdown.startsWith('# ')) {
                    markdown = '# ' + processedTitle + '\n\n' + markdown;
                }
            }

            return {
                markdown: markdown,
                summary: summary,
                keywords: keywords,
                metadata: metadata,
                title: processedTitle
            };
        },

        htmlToMarkdown: function(html) {
            if (!html) return '';

            if (window.TurndownService) {
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
                        }
                    });

                    return turndownService.turndown(html);
                } catch (e) {
                    console.error('Turndown conversion error:', e);
                    return this.simpleHtmlToMarkdown(html);
                }
            }

            return this.simpleHtmlToMarkdown(html);
        },

        simpleHtmlToMarkdown: function(html) {
            if (!html) return '';
            
            let markdown = html;
            
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
            
            return markdown;
        },

        markdownToPlainText: function(markdown) {
            if (!markdown) return '';
            
            let text = markdown;
            
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
            
            return text;
        },

        copyToClipboard: function(text, callback) {
            const self = this;
            
            if (!this.config.autoCopy) {
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
                
                if (callback) {
                    if (isSuccess) {
                        callback(true, '已复制到剪贴板');
                    } else {
                        callback(false, '复制失败，请重试');
                    }
                }
            } catch (e) {
                console.error('Clipboard copy error:', e);
                if (callback) callback(false, '复制异常: ' + e.message);
            }
        },

        showNotification: function(message, type) {
            type = type || 'info';
            
            const bgColors = {
                success: '#27ae60',
                error: '#e74c3c',
                warning: '#f39c12',
                info: '#3498db'
            };

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
                    backgroundColor: bgColors[type] || bgColors.info
                }
            }).text(message);

            $('body').append($notification);

            setTimeout(function() {
                $notification.css('transform', 'translateX(0)');
            }, 10);

            setTimeout(function() {
                $notification.css('transform', 'translateX(120%)');
                setTimeout(function() {
                    $notification.remove();
                }, 300);
            }, 3000);
        },

        exportArticle: function(titleSelector, contentSelectors, platform) {
            const self = this;
            
            this.init(function() {
                let title = '';
                let content = '';

                if (titleSelector) {
                    const $title = $(titleSelector).first();
                    if ($title.length > 0) {
                        title = $title.text().trim();
                    }
                }

                if (!title && window.ContentEnhancer) {
                    title = window.ContentEnhancer.extractTitle($, platform);
                }

                if (contentSelectors && contentSelectors.length > 0) {
                    for (let i = 0; i < contentSelectors.length; i++) {
                        const $content = $(contentSelectors[i]).first();
                        if ($content.length > 0) {
                            content = $content.html();
                            if (content && content.length > 50) {
                                break;
                            }
                        }
                    }
                }

                if (!content && window.ContentEnhancer) {
                    content = window.ContentEnhancer.extractContent($, platform);
                }

                if (!content || content.length < 50) {
                    self.showNotification('未能提取到文章内容', 'error');
                    return;
                }

                const result = self.processContent(content, title, platform);

                if (!result.markdown || result.markdown.trim().length === 0) {
                    self.showNotification('内容处理失败', 'error');
                    return;
                }

                self.copyToClipboard(result.markdown, function(success, message) {
                    if (success) {
                        let info = message;
                        if (result.metadata && result.metadata.compressionRatio) {
                            info += ' (压缩率: ' + result.metadata.compressionRatio + '%)';
                        }
                        self.showNotification(info, 'success');
                    } else {
                        self.showNotification(message, 'error');
                    }
                });

                console.log('Export result:', result);
            });
        }
    };

    window.ExportManager = ExportManager;

})(window);
