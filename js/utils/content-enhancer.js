(function(window) {
    'use strict';

    const ContentEnhancer = {
        adSelectors: [
            '[class*="ad-"]',
            '[class*="_ad_"]',
            '[class*="-ad-"]',
            '[class*="advert"]',
            '[class*="banner"]',
            '[class*="promo"]',
            '[class*="sponsor"]',
            '[id*="ad-"]',
            '[id*="_ad_"]',
            '[id*="-ad-"]',
            '[id*="advert"]',
            '[id*="banner"]',
            '[id*="google_ads"]',
            '[id*="google-ad"]',
            '.adsbygoogle',
            '.adsense',
            '.ad-wrapper',
            '.ad-container',
            '.ad-box',
            '.ad-space',
            '.ad-slot',
            '.native-ad',
            '.sponsored-content',
            '.promoted-content',
            '.partner-content',
            '.paid-content',
            'ins.adsbygoogle',
            'iframe[src*="doubleclick"]',
            'iframe[src*="googleads"]',
            'iframe[src*="adroll"]',
            'iframe[src*="media.net"]',
            'iframe[src*="taboola"]',
            'iframe[src*="outbrain"]',
            'script[src*="doubleclick"]',
            'script[src*="googleads"]',
            'script[src*="adroll"]'
        ],

        recommendSelectors: [
            '[class*="recommend"]',
            '[class*="related"]',
            '[class*="popular"]',
            '[class*="hot"]',
            '[class*="trending"]',
            '[class*="guess"]',
            '[class*="like"]',
            '[class*="suggest"]',
            '[id*="recommend"]',
            '[id*="related"]',
            '[id*="popular"]',
            '[id*="hot"]',
            '[id*="trending"]',
            '.recommend-list',
            '.related-articles',
            '.related-posts',
            '.popular-posts',
            '.hot-articles',
            '.you-may-like',
            '.guess-you-like',
            '.read-more',
            '.more-to-read',
            '.similar-posts',
            '.featured-posts',
            '.sidebar-widget',
            '.widget_recent_entries',
            '.widget_categories',
            '.widget_archive'
        ],

        noisePatterns: [
            /分享到|分享至|微信分享|微博分享|QQ空间/g,
            /点赞|喜欢|收藏|打赏|转发|评论/g,
            /关注作者|关注公众号|关注微信/g,
            /扫描二维码|扫码关注/g,
            /本文来自|原文链接|来源：|作者：/g,
            /版权声明|版权所有|未经授权/g,
            /上一篇|下一篇|返回首页/g,
            /登录后查看|登录后下载/g,
            /VIP专享|会员专属/g,
            /广告|AD|广告位/g,
            /相关推荐|相关阅读|猜你喜欢/g,
            /热门推荐|热门文章|排行榜/g,
            /为你推荐|推荐阅读/g
        ],

        platformConfigs: {
            csdn: {
                titleSelector: 'div.article-title-box h1, h1.title-article',
                contentSelectors: [
                    'div#article_content',
                    'div.article_content',
                    '.article-detail-content'
                ],
                noiseSelectors: [
                    '.article-info-box',
                    '.article-bar-top',
                    '.article-bar-bottom',
                    '.tool-box',
                    '.comment-box',
                    '.recommend-box',
                    '.second-recommend-box',
                    '.first-recommend-box',
                    '.indexSuperise',
                    '[id*="dmp_ad"]',
                    '.pulllog-box',
                    '.comment-list-container',
                    '.comment-edit-box',
                    '.more-toolbox',
                    '.article-copyright',
                    '.blog-footer-bottom',
                    '#blogColumnPayAdvert',
                    '#asideColumnAdvert',
                    '[class*="advert"]'
                ]
            },
            juejin: {
                titleSelector: 'h1.article-title, .article-title h1',
                contentSelectors: [
                    'div.article-content',
                    '.article-content-wrapper',
                    '.markdown-body'
                ],
                noiseSelectors: [
                    '.article-author',
                    '.article-meta',
                    '.article-actions',
                    '.comment-list',
                    '.comment-input',
                    '.related-articles',
                    '.recommended-articles',
                    '.sidebar',
                    '.global-component-box'
                ]
            },
            cnblogs: {
                titleSelector: '#cb_post_title_url, .postTitle a, h1.postTitle',
                contentSelectors: [
                    '#cnblogs_post_body',
                    '.postBody',
                    '.post-body',
                    '#post_detail'
                ],
                noiseSelectors: [
                    '#blog_post_info_block',
                    '#BlogPostCategory',
                    '#EntryTag',
                    '#author_profile',
                    '#comment_form',
                    '#comment_nav',
                    '.feedback_area_title',
                    '.feedbackList',
                    '.feedbackCon',
                    '.postDesc',
                    '#ad_t2',
                    '#under_post_news',
                    '#under_post_kb',
                    '#sideBar',
                    '#navigator',
                    '#footer'
                ]
            },
            jianshu: {
                titleSelector: '.title, h1.title, .article-title',
                contentSelectors: [
                    '.article',
                    '.show-content',
                    '.article-content',
                    '#js-content'
                ],
                noiseSelectors: [
                    '.author',
                    '.meta',
                    '.follow-detail',
                    '.info',
                    '.article-tag',
                    '.comment-list',
                    '.comment-input',
                    '.recommend-notes',
                    '.recommend-wrap',
                    '.note-list',
                    '.aside',
                    '#comment-main',
                    '.footer'
                ]
            }
        },

        enhanceContent: function($, platform) {
            const config = this.platformConfigs[platform] || {};
            
            if (config.noiseSelectors && config.noiseSelectors.length > 0) {
                config.noiseSelectors.forEach(selector => {
                    $(selector).remove();
                });
            }
            
            this.adSelectors.forEach(selector => {
                $(selector).remove();
            });
            
            this.recommendSelectors.forEach(selector => {
                $(selector).remove();
            });
            
            return $;
        },

        extractTitle: function($, platform) {
            const config = this.platformConfigs[platform];
            if (config && config.titleSelector) {
                const $title = $(config.titleSelector).first();
                if ($title.length > 0) {
                    let title = $title.text().trim();
                    title = this.cleanText(title);
                    return title;
                }
            }
            
            const $title = $('title').first();
            if ($title.length > 0) {
                let title = $title.text().trim();
                title = title.replace(/\s*[-|].*$/, '');
                title = this.cleanText(title);
                return title;
            }
            
            const $h1 = $('h1').first();
            if ($h1.length > 0) {
                return this.cleanText($h1.text().trim());
            }
            
            return '';
        },

        extractContent: function($, platform) {
            const config = this.platformConfigs[platform];
            let content = '';
            
            if (config && config.contentSelectors && config.contentSelectors.length > 0) {
                for (const selector of config.contentSelectors) {
                    const $content = $(selector).first();
                    if ($content.length > 0) {
                        this.enhanceContent($content, platform);
                        content = $content.html() || '';
                        if (content && content.length > 100) {
                            break;
                        }
                    }
                }
            }
            
            if (!content || content.length < 100) {
                const $article = $('article').first();
                if ($article.length > 0) {
                    this.enhanceContent($article, platform);
                    content = $article.html() || '';
                }
            }
            
            if (!content || content.length < 100) {
                const $main = $('main, #main, .main').first();
                if ($main.length > 0) {
                    this.enhanceContent($main, platform);
                    content = $main.html() || '';
                }
            }
            
            if (content) {
                content = this.cleanHtml(content);
            }
            
            return content;
        },

        cleanHtml: function(html) {
            if (!html) return '';
            
            let cleaned = html;
            
            cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
            cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
            cleaned = cleaned.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
            cleaned = cleaned.replace(/<!--[\s\S]*?-->/gi, '');
            
            cleaned = cleaned.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
            cleaned = cleaned.replace(/<embed[^>]*>/gi, '');
            cleaned = cleaned.replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '');
            
            cleaned = cleaned.replace(/on\w+="[^"]*"/gi, '');
            cleaned = cleaned.replace(/on\w+='[^']*'/gi, '');
            cleaned = cleaned.replace(/javascript:/gi, '');
            
            return cleaned;
        },

        cleanText: function(text) {
            if (!text) return '';
            
            let cleaned = text;
            
            this.noisePatterns.forEach(pattern => {
                cleaned = cleaned.replace(pattern, '');
            });
            
            cleaned = cleaned.replace(/\s+/g, ' ');
            cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
            cleaned = cleaned.trim();
            
            return cleaned;
        },

        detectPlatform: function(url) {
            if (url.indexOf('csdn.net') >= 0) return 'csdn';
            if (url.indexOf('juejin.im') >= 0 || url.indexOf('juejin.cn') >= 0) return 'juejin';
            if (url.indexOf('cnblogs.com') >= 0) return 'cnblogs';
            if (url.indexOf('jianshu.com') >= 0) return 'jianshu';
            if (url.indexOf('dgstack.cn') >= 0) return 'dgstack';
            if (url.indexOf('wenku.baidu.com') >= 0) return 'bdwk';
            return 'generic';
        },

        processMarkdown: function(markdown, options = {}) {
            if (!markdown) return markdown;
            
            let processed = markdown;
            
            if (options.removeNoise) {
                processed = processed.replace(/^[#\s]*分享[^\n]*$/gm, '');
                processed = processed.replace(/^[#\s]*点赞[^\n]*$/gm, '');
                processed = processed.replace(/^[#\s]*关注[^\n]*$/gm, '');
                processed = processed.replace(/^[#\s]*扫码[^\n]*$/gm, '');
                processed = processed.replace(/^[#\s]*广告[^\n]*$/gm, '');
                processed = processed.replace(/^[#\s]*推荐[^\n]*$/gm, '');
                processed = processed.replace(/^[#\s]*相关[^\n]*$/gm, '');
            }
            
            if (options.removeEmptyLines) {
                processed = processed.replace(/\n{3,}/g, '\n\n');
            }
            
            if (options.removeImages) {
                processed = processed.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
            }
            
            if (options.removeLinks) {
                processed = processed.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
            }
            
            return processed.trim();
        },

        insertSummary: function(markdown, summary, keywords = []) {
            if (!summary || summary.trim() === '') {
                return markdown;
            }
            
            let result = markdown;
            
            const summarySection = '\n\n## 文章摘要\n\n' + summary + '\n';
            
            let keywordSection = '';
            if (keywords && keywords.length > 0) {
                keywordSection = '\n### 关键词\n\n' + 
                    keywords.map(k => `- ${k.word}`).join('\n') + '\n';
            }
            
            const titleMatch = markdown.match(/^#\s+[^\n]+/);
            
            if (titleMatch) {
                const title = titleMatch[0];
                const rest = markdown.substring(title.length);
                result = title + summarySection + keywordSection + rest;
            } else {
                result = summarySection + keywordSection + '\n\n---\n\n' + markdown;
            }
            
            return result;
        }
    };

    window.ContentEnhancer = ContentEnhancer;

})(window);
