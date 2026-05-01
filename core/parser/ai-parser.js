class AIParser {
  constructor(options = {}) {
    this.options = {
      enableSemanticAnalysis: true,
      enableAdFiltering: true,
      enableStructureExtraction: true,
      enableAutoTOC: true,
      enableCodeFormatting: true,
      enableLayoutFix: true,
      ...options
    };
    this.readability = null;
    this.semanticAnalyzer = new SemanticAnalyzer();
    this.adFilter = new AdvancedAdFilter();
    this.structureExtractor = new StructureExtractor();
  }

  async parse(doc, url, customRules = null) {
    const platform = this.detectPlatform(url);
    const result = {
      platform: platform,
      url: url,
      title: '',
      author: '',
      date: '',
      content: '',
      htmlContent: '',
      tableOfContents: [],
      codeBlocks: [],
      images: [],
      links: [],
      formulas: [],
      tables: [],
      metadata: {},
      customRulesApplied: null
    };

    try {
      if (customRules) {
        result.customRulesApplied = customRules;
      }

      const readabilityResult = await this.parseWithReadability(doc.cloneNode(true), url);
      if (readabilityResult) {
        result.title = readabilityResult.title || result.title;
        result.author = readabilityResult.byline || result.author;
        result.content = readabilityResult.textContent || '';
        result.htmlContent = readabilityResult.content || '';
        result.metadata.excerpt = readabilityResult.excerpt || '';
      }

      const platformResult = this.parseWithPlatformRules(doc, platform, customRules);
      result.title = platformResult.title || result.title;
      result.author = platformResult.author || result.author;
      result.date = platformResult.date || result.date;
      if (platformResult.htmlContent) {
        result.htmlContent = platformResult.htmlContent;
      }

      if (this.options.enableAdFiltering) {
        result.htmlContent = this.adFilter.filter(result.htmlContent, platform, customRules);
      }

      if (this.options.enableStructureExtraction) {
        const structure = this.structureExtractor.extract(result.htmlContent, doc, this.options);
        result.tableOfContents = structure.toc;
        result.codeBlocks = structure.codeBlocks;
        result.images = structure.images;
        result.links = structure.links;
        result.formulas = structure.formulas;
        result.tables = structure.tables;
      }

      if (this.options.enableSemanticAnalysis) {
        result = this.semanticAnalyzer.enhance(result, doc, this.options);
      }

      if (this.options.enableAutoTOC && result.tableOfContents.length > 0) {
        result.markdownTOC = this.generateMarkdownTOC(result.tableOfContents);
      }

      if (this.options.enableCodeFormatting && result.codeBlocks.length > 0) {
        result.formattedCodeBlocks = this.formatCodeBlocks(result.codeBlocks);
      }

      if (this.options.enableLayoutFix) {
        result.htmlContent = this.fixLayout(result.htmlContent);
      }

      result.success = true;
    } catch (error) {
      result.success = false;
      result.error = error.message;
      result.errorStack = error.stack;
      console.error('AIParser error:', error);
    }

    return result;
  }

  detectPlatform(url) {
    const rules = {
      csdn: ['blog.csdn.net'],
      juejin: ['juejin.cn', 'juejin.im'],
      cnblogs: ['cnblogs.com'],
      jianshu: ['jianshu.com'],
      zhihu: ['zhihu.com', 'zhuanlan.zhihu.com'],
      segmentfault: ['segmentfault.com'],
      dgstack: ['dgstack.cn'],
      baiduwk: ['wenku.baidu.com']
    };

    for (const [platform, patterns] of Object.entries(rules)) {
      for (const pattern of patterns) {
        if (url.includes(pattern)) {
          return platform;
        }
      }
    }
    return 'generic';
  }

  async parseWithReadability(doc, url) {
    try {
      if (typeof Readability !== 'undefined') {
        const reader = new Readability(doc, { 
          charThreshold: 100,
          nbTopCandidates: 5,
          keepClasses: true
        });
        return reader.parse();
      }
      return null;
    } catch (e) {
      console.warn('Readability parse failed:', e);
      return null;
    }
  }

  parseWithPlatformRules(doc, platform, customRules) {
    const result = {
      title: '',
      author: '',
      date: '',
      htmlContent: ''
    };

    const selectors = customRules ? 
      this.getCustomSelectors(customRules) : 
      this.getPlatformSelectors(platform);

    result.title = this.selectText(doc, selectors.titleSelectors);
    result.author = this.selectText(doc, selectors.authorSelectors);
    result.date = this.selectText(doc, selectors.dateSelectors);

    const contentElement = this.selectElement(doc, selectors.contentSelectors);
    if (contentElement) {
      result.htmlContent = contentElement.innerHTML;
    }

    return result;
  }

  getCustomSelectors(customRules) {
    return {
      titleSelectors: customRules.titleSelectors || ['h1', 'title'],
      authorSelectors: customRules.authorSelectors || ['.author'],
      dateSelectors: customRules.dateSelectors || ['.date'],
      contentSelectors: customRules.contentSelectors || ['article', '.content'],
      adSelectors: customRules.adSelectors || []
    };
  }

  getPlatformSelectors(platform) {
    const defaultSelectors = {
      titleSelectors: ['h1', 'title', '.title', '.article-title'],
      authorSelectors: ['.author', '.byline', '[itemprop="author"]'],
      dateSelectors: ['.date', '.time', '[itemprop="datePublished"]'],
      contentSelectors: [
        'article', '.article-content', '.post-content',
        '.entry-content', '#content', '.main-content'
      ],
      adSelectors: [
        '.ad', '.ads', '.advertisement', '[class*="ad-"]'
      ]
    };

    const platformRules = {
      csdn: {
        titleSelectors: ['h1.title-article', 'div.article-title-box h1', '.title-article', '#articleContentId'],
        authorSelectors: ['.follow-nickName', '.name', '.user-info a', '#uid span', '.article-info-box a'],
        dateSelectors: ['.time', '.article-info-box .time', '.update-time', '.publish-time'],
        contentSelectors: ['#article_content', '#content_views', '.article_content', '.markdown_views'],
        adSelectors: [
          '.ad', '.adsbygoogle', '.advertisement',
          '#ad_layer', '[class*="ad-"]', '[id*="ad_"]',
          '.recommend-item-box', '.more-toolbox', '.second-recommend-box',
          '.feed-Side-box', '#commentBox', '.comment-box',
          '.template-box', '.blog-tags-box', '.blog-footer-bottom',
          '.csdn-side-toolbar', '.left-toolbox', '#treeSkill',
          '.article-footer', '.article-info-box .btn', '.share-box'
        ],
        codeSelectors: ['pre', 'code', '.prism-token', '.hljs', '.code-wrapper'],
        tocSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
      },
      juejin: {
        titleSelectors: ['h1.article-title', '.title', '.article-title', '.article-title-box h1'],
        authorSelectors: ['.username', '.author-name', '.user-info .name', '.article-meta .name'],
        dateSelectors: ['.time', '.meta-item .text', '.publish-time', '.article-meta .time'],
        contentSelectors: ['.article-content', '.markdown-body', '#article-root', '.entry-content'],
        adSelectors: [
          '.ad', '.advertisement', '.recommend-list',
          '.sidebar-block', '.global-component-box',
          '.author-info-block', '.comment-list',
          '.article-suspended-panel', '#comment-box',
          '.article-footer', '.article-banner', '.recommend-box'
        ],
        codeSelectors: ['pre', 'code', '.prism', '.hljs', '.token', '.code-block'],
        tocSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
      },
      cnblogs: {
        titleSelectors: ['#cb_post_title_url', '.postTitle a', '.postTitle', 'h1.postTitle'],
        authorSelectors: ['.postDesc a', '#post-date + a', '#BlogPost1_author', '.postDesc #author'],
        dateSelectors: ['#post-date', '.postDesc', '.post-date'],
        contentSelectors: ['#cnblogs_post_body', '.postBody', '#topics', '.entry-content'],
        adSelectors: [
          '.ad_text', '#ad_text_under_commentbox',
          '.cnblogs_code', '.commentform',
          '#google_ads', '.blog_comment_body',
          '#comment_form_container', '.under_post_kb',
          '.under_post_news', '.postDesc', '#blog_post_info',
          '.comment_form', '#comment_form', '.feedback_area_title'
        ],
        codeSelectors: ['pre', 'code', '.cnblogs_code', '.hljs', '.syntaxhighlighter'],
        tocSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
      },
      jianshu: {
        titleSelectors: ['h1.title', '.article-title', '._1RuRku', '.title'],
        authorSelectors: ['.author .name', '.follow-detail .name', '._2gP-m8', '.note-author'],
        dateSelectors: ['.publish-time', '.time', '._3U4Smb', '.note-time'],
        contentSelectors: ['.article', '._2rhmJa', '#__next', '.note-content'],
        adSelectors: [
          '.recommend-collection', '.note-bottom-ad',
          '.sidebar', '._1PqU57', '.comment-list',
          '._3VQjf_', '.mobile-ad', '.note-bottom',
          '.follow-btn', '.share-btn', '.report'
        ],
        codeSelectors: ['pre', 'code', '.hljs', '.prism', '.code'],
        tocSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
      },
      zhihu: {
        titleSelectors: ['h1.QuestionHeader-title', '.Post-Title', '.RichContent-title', '.Question-title'],
        authorSelectors: ['.AuthorInfo-name', '.UserLink-link', '.author-link', '.writer-name'],
        dateSelectors: ['.ContentItem-time', '.publish-time', '.time', '.created-time'],
        contentSelectors: ['.RichContent-inner', '.Post-RichText', '.QuestionAnswer-content', '.RichText'],
        adSelectors: [
          '.Pc-word-card', '.AdblockBanner',
          '.Recommendations-Main', '.CommentsV2',
          '.Question-sideColumn', '.Reward',
          '.CornerButton', '.Comments-container',
          '.AnswerItem', '.Answer-content', '.Question-mainColumn',
          '.AppBanner', '.FollowButton', '.ShareButton'
        ],
        codeSelectors: ['pre', 'code', '.highlight', '.codeblock', '.ztext-code'],
        tocSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
      },
      segmentfault: {
        titleSelectors: ['h1.article__title', '.question__title', '.h1', '.article-title'],
        authorSelectors: ['.user__name', '.author-name', '.user-info a', '.widget-avatar + a'],
        dateSelectors: ['.article__creation-time', '.time', '.created-time', '.publish-time'],
        contentSelectors: ['.article__content', '.question-content', '.answer', '.post-content'],
        adSelectors: [
          '.widget-box', '.sidebar-widget',
          '.comment-list', '.comments',
          '.relevant-articles', '#sideAd',
          '.article-sidebar', '.post-sidebar',
          '.share', '.widget-taglist', '.widget-copyright'
        ],
        codeSelectors: ['pre', 'code', '.prettyprint', '.hljs', '.syntax'],
        tocSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
      },
      dgstack: {
        titleSelectors: ['h1', '.title', '.article-title'],
        authorSelectors: ['.author', '.byline', '.meta-author'],
        dateSelectors: ['.date', '.time', '.meta-date'],
        contentSelectors: ['article', '.article-content', '.post-content', '.entry-content'],
        adSelectors: [
          '.ad', '.ads', '.advertisement',
          '[class*="ad-"]', '[id*="ad_"]',
          '.sidebar', '.widget', '.comments',
          '.related-posts', '.share-buttons'
        ],
        codeSelectors: ['pre', 'code', '.hljs', '.prism'],
        tocSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
      },
      baiduwk: {
        titleSelectors: ['h1', '.title', '.doc-title', '#docTitle'],
        authorSelectors: ['.author', '.uploader', '.doc-author'],
        dateSelectors: ['.date', '.time', '.upload-time'],
        contentSelectors: ['.reader-wrapper', '.doc-content', '#page-container', '.content'],
        adSelectors: [
          '.ad', '.ads', '.advertisement',
          '[class*="ad-"]', '[id*="ad_"]',
          '.sidebar', '.recommend', '.vip-box'
        ],
        codeSelectors: ['pre', 'code'],
        tocSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
      }
    };

    return platformRules[platform] || defaultSelectors;
  }

  selectText(doc, selectors) {
    for (const selector of selectors) {
      try {
        const element = doc.querySelector(selector);
        if (element && element.textContent.trim()) {
          return element.textContent.trim();
        }
      } catch (e) {
        continue;
      }
    }
    return '';
  }

  selectElement(doc, selectors) {
    for (const selector of selectors) {
      try {
        const element = doc.querySelector(selector);
        if (element) {
          return element;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  }

  generateMarkdownTOC(toc) {
    if (!toc || toc.length === 0) return '';

    let markdown = '## 目录\n\n';
    toc.forEach(item => {
      const indent = '  '.repeat(item.level - 1);
      const anchor = item.id || item.text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, '');
      markdown += `${indent}- [${item.text}](#${anchor})\n`;
    });
    return markdown + '\n';
  }

  formatCodeBlocks(codeBlocks) {
    return codeBlocks.map((block, index) => {
      const language = block.language || '';
      const fence = '```';
      return {
        ...block,
        formatted: `${fence}${language}\n${block.content}\n${fence}\n\n`
      };
    });
  }

  fixLayout(html) {
    if (!html) return html;

    let fixed = html;

    fixed = fixed.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
    fixed = fixed.replace(/(<p>\s*<\/p>\s*)+/gi, '');
    fixed = fixed.replace(/\n\s*\n\s*\n+/g, '\n\n');
    fixed = fixed.replace(/&nbsp;/g, ' ');
    fixed = fixed.replace(/\s{2,}/g, ' ');

    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = fixed;

      const elements = tempDiv.querySelectorAll('*');
      elements.forEach(el => {
        if (el.getAttribute('style')) {
          const style = el.getAttribute('style');
          if (style.includes('display:none') || style.includes('visibility:hidden')) {
            if (el.parentNode) {
              el.parentNode.removeChild(el);
            }
          }
        }
      });

      fixed = tempDiv.innerHTML;
    } catch (e) {
      console.warn('Layout fix error:', e);
    }

    return fixed;
  }
}

class SemanticAnalyzer {
  constructor() {
    this.techKeywords = [
      'javascript', 'js', 'typescript', 'ts', 'python', 'java', 'cpp', 'c++', 'c#',
      'php', 'ruby', 'go', 'golang', 'rust', 'swift', 'kotlin', 'dart',
      'react', 'vue', 'angular', 'svelte', 'nextjs', 'nuxt', 'nestjs',
      'node', 'nodejs', 'express', 'koa', 'django', 'flask', 'spring', 'laravel',
      'docker', 'kubernetes', 'k8s', 'devops', 'ci/cd', 'pipeline',
      'api', 'rest', 'graphql', 'grpc', 'websocket', 'http', 'https',
      '算法', '数据结构', '设计模式', '架构', '微服务', '分布式',
      '数据库', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch',
      'git', 'github', 'gitlab', 'svn', '版本控制',
      'linux', 'unix', 'windows', 'macos', '操作系统',
      '前端', '后端', '全栈', '移动端', 'web', '小程序', 'app'
    ];
    
    this.titlePatterns = [
      /^第\s*\d+\s*[章节课]/,
      /^【.*】/,
      /^\d+\.\s*\d*\s*.*/,
      /^[一二三四五六七八九十]+[、.．]/
    ];
  }

  enhance(parsedData, doc, options) {
    const result = { ...parsedData };

    const titleScore = this.calculateTitleScore(result.title);
    const contentScore = this.calculateContentScore(result.htmlContent);
    const codeDensity = this.calculateCodeDensity(result);
    const semanticScore = this.calculateSemanticScore(result);

    result.metadata = {
      ...result.metadata,
      titleScore: titleScore,
      contentScore: contentScore,
      codeDensity: codeDensity,
      semanticScore: semanticScore,
      isTechnicalArticle: this.isTechnicalArticle(result, codeDensity),
      isTutorialArticle: this.isTutorialArticle(result),
      isNewsArticle: this.isNewsArticle(result),
      estimatedReadTime: this.estimateReadTime(result.content),
      wordCount: this.countWords(result.content),
      contentCategory: this.classifyContent(result)
    };

    result.tableOfContents = this.normalizeTOC(result.tableOfContents);
    result.tableOfContents = this.enhanceTOCWithSemantics(result.tableOfContents, result.htmlContent);

    result.title = this.sanitizeTitle(result.title);
    result.author = this.sanitizeAuthor(result.author);

    return result;
  }

  calculateTitleScore(title) {
    if (!title) return 0;
    let score = 0;

    if (title.length > 5 && title.length < 100) score += 20;
    if (title.length > 10 && title.length < 50) score += 10;

    const lowerTitle = title.toLowerCase();
    for (const keyword of this.techKeywords) {
      if (lowerTitle.includes(keyword.toLowerCase())) {
        score += 10;
        break;
      }
    }

    for (const pattern of this.titlePatterns) {
      if (pattern.test(title)) {
        score += 10;
        break;
      }
    }

    if (title.includes('：') || title.includes(':') || title.includes('——')) {
      score += 5;
    }

    return Math.min(score, 100);
  }

  calculateContentScore(html) {
    if (!html) return 0;
    let score = 50;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const textContent = tempDiv.textContent || '';
    const wordCount = textContent.split(/\s+/).filter(w => w.length > 1).length;

    if (wordCount > 100) score += 10;
    if (wordCount > 500) score += 20;
    if (wordCount > 1000) score += 10;
    if (wordCount > 3000) score += 10;

    const headings = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length > 3) score += 10;

    const lists = tempDiv.querySelectorAll('ul, ol');
    if (lists.length > 2) score += 5;

    const blockquotes = tempDiv.querySelectorAll('blockquote');
    if (blockquotes.length > 0) score += 5;

    return Math.min(score, 100);
  }

  calculateCodeDensity(parsedData) {
    if (!parsedData.codeBlocks || parsedData.codeBlocks.length === 0) return 0;

    const totalCodeLength = parsedData.codeBlocks.reduce((sum, block) => {
      return sum + (block.content ? block.content.length : 0);
    }, 0);

    const totalContentLength = parsedData.content ? parsedData.content.length : 1;

    return totalCodeLength / Math.max(1, totalContentLength);
  }

  calculateSemanticScore(parsedData) {
    let score = 0;

    if (parsedData.title && parsedData.title.length > 5) score += 20;
    if (parsedData.author && parsedData.author.length > 0) score += 10;
    if (parsedData.date && parsedData.date.length > 0) score += 10;

    if (parsedData.tableOfContents && parsedData.tableOfContents.length > 0) score += 15;
    if (parsedData.codeBlocks && parsedData.codeBlocks.length > 0) score += 15;
    if (parsedData.images && parsedData.images.length > 0) score += 10;
    if (parsedData.links && parsedData.links.length > 0) score += 10;

    if (parsedData.metadata && parsedData.metadata.excerpt) score += 10;

    return Math.min(score, 100);
  }

  isTechnicalArticle(parsedData, codeDensity) {
    if (codeDensity > 0.1) return true;
    if (parsedData.codeBlocks && parsedData.codeBlocks.length > 2) return true;

    const content = (parsedData.content || '').toLowerCase();
    for (const keyword of this.techKeywords) {
      if (content.includes(keyword.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  isTutorialArticle(parsedData) {
    const title = (parsedData.title || '').toLowerCase();
    const tutorialKeywords = ['教程', '入门', '实战', '从0到1', '手把手', '详解', '完全指南', '学习笔记'];
    
    for (const keyword of tutorialKeywords) {
      if (title.includes(keyword)) return true;
    }

    if (parsedData.tableOfContents && parsedData.tableOfContents.length > 5) return true;

    return false;
  }

  isNewsArticle(parsedData) {
    const title = (parsedData.title || '').toLowerCase();
    const newsKeywords = ['快讯', '发布', '更新', '推出', '新版', '最新', '今日'];
    
    for (const keyword of newsKeywords) {
      if (title.includes(keyword)) return true;
    }

    return false;
  }

  estimateReadTime(content) {
    if (!content) return 0;
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).filter(w => w.length > 1).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  countWords(content) {
    if (!content) return 0;
    return content.split(/\s+/).filter(w => w.length > 1).length;
  }

  classifyContent(parsedData) {
    const codeDensity = this.calculateCodeDensity(parsedData);

    if (this.isTutorialArticle(parsedData)) {
      return 'tutorial';
    }
    if (this.isNewsArticle(parsedData)) {
      return 'news';
    }
    if (this.isTechnicalArticle(parsedData, codeDensity)) {
      return 'technical';
    }
    if (codeDensity > 0.2) {
      return 'code-heavy';
    }
    if (parsedData.images && parsedData.images.length > 10) {
      return 'image-heavy';
    }

    return 'general';
  }

  normalizeTOC(toc) {
    if (!toc || toc.length === 0) return toc;

    let minLevel = Math.min(...toc.map(item => item.level));
    
    return toc.map(item => ({
      ...item,
      level: item.level - minLevel + 1
    }));
  }

  enhanceTOCWithSemantics(toc, htmlContent) {
    if (!toc || toc.length === 0) return toc;

    return toc.map((item, index) => {
      const enhanced = { ...item };
      
      if (!item.id) {
        enhanced.id = `heading-${index}`;
      }

      const text = item.text || '';
      enhanced.isSectionTitle = this.isSectionTitle(text);
      enhanced.isCodeHeading = this.isCodeHeading(text);
      enhanced.isImportant = this.isImportantHeading(text);

      return enhanced;
    });
  }

  isSectionTitle(text) {
    for (const pattern of this.titlePatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }

  isCodeHeading(text) {
    const codeKeywords = ['代码', '实现', '源码', '源代码', '示例', '代码示例', '完整代码'];
    const lowerText = text.toLowerCase();
    for (const keyword of codeKeywords) {
      if (lowerText.includes(keyword)) {
        return true;
      }
    }
    return false;
  }

  isImportantHeading(text) {
    const importantKeywords = ['总结', '结论', '重要', '核心', '关键', '注意', 'warning', '重要提示'];
    const lowerText = text.toLowerCase();
    for (const keyword of importantKeywords) {
      if (lowerText.includes(keyword)) {
        return true;
      }
    }
    return false;
  }

  sanitizeTitle(title) {
    if (!title) return '';
    
    let sanitized = title.trim();
    sanitized = sanitized.replace(/\s+/g, ' ');
    sanitized = sanitized.replace(/^[#\s*]+/, '');
    sanitized = sanitized.replace(/[#\s*]+$/, '');
    
    return sanitized.trim();
  }

  sanitizeAuthor(author) {
    if (!author) return '';
    
    let sanitized = author.trim();
    sanitized = sanitized.replace(/\s+/g, ' ');
    sanitized = sanitized.replace(/^[@\s]+/, '');
    sanitized = sanitized.replace(/作者[:：\s]*/i, '');
    sanitized = sanitized.replace(/发布者[:：\s]*/i, '');
    sanitized = sanitized.replace(/转载自[:：\s]*/i, '');
    
    return sanitized.trim();
  }
}

class AdvancedAdFilter {
  constructor() {
    this.genericAdSelectors = [
      '[class*="ad-"]', '[id*="ad_"]', '[class*="ads-"]', '[id*="ads_"]',
      '.ad', '.ads', '.advertisement', '.banner-ad', '.native-ad',
      '[data-ad]', '[data-ad-unit]', '[data-ad-client]',
      '.google-auto-placed', '.adsbygoogle', '.googlead',
      '.sticky-ad', '.inline-ad', '.floating-ad', '.popup-ad',
      '[class*="promo"]', '[class*="promotion"]', '[class*="sponsor"]',
      '.recommendation', '.recommend', '[class*="recommend"]',
      '[class*="widget-ads"]', '[class*="sidebar-ad"]',
      '.ad-container', '.ad-wrapper', '.ad-box', '.ad-area',
      '[id*="google_ads"]', '[class*="google_ads"]',
      '.ad-slot', '.ad-placement', '.ad-unit',
      '[data-adsbygoogle-status]', '[aria-label*="广告"]',
      '[aria-label*="ad"]', '[aria-label*="advertisement"]'
    ];

    this.redundantSelectors = [
      '.social-share', '.share-buttons', '[class*="share"]', '[class*="social"]',
      '.like-button', '.vote-button', '.comment-button', '.follow-button',
      '.subscribe-box', '.newsletter-box', '.signup-box',
      '.related-posts', '.related-articles', '[class*="related"]', '[class*="similar"]',
      '.author-bio', '.about-author', '.author-info', '.author-card',
      '.post-navigation', '.nav-links', '[class*="navigation"]', '.prev-next',
      '.footer-widgets', '.post-footer', '.article-footer', '.entry-footer',
      '[style*="display:none"]', '[style*="display: none"]', '[style*="visibility:hidden"]',
      'noscript', 'script', 'style', 'iframe:not([src*="youtube"]):not([src*="bilibili"])',
      '.hidden', '.invisible', '.hide', '.d-none',
      '.cookie-banner', '.cookie-consent', '.gdpr', '.privacy-banner',
      '.popup', '.modal', '[class*="modal"]', '[class*="popup"]',
      '.loading', '.spinner', '[class*="loading"]', '[class*="spinner"]',
      '.tooltip', '.popover', '.dropdown-menu',
      '.breadcrumb', '.breadcrumbs', '.page-nav', '.pagination',
      '.tags', '.tag-cloud', '.categories', '.category-list',
      '.read-more', '.more-link', '.continue-reading',
      '.print-button', '.email-button', '.print-friendly',
      '.comment-form', '#comment-form', '.respond', '.reply',
      '.trackbacks', '.pingbacks', '.post-meta', '.entry-meta',
      '.edit-link', '.admin-bar', '.wp-admin-bar',
      '.search-form', '#searchform', '.search-box',
      '.calendar', '.archive', '.widget_calendar',
      '.recent-posts', '.recent-comments', '.meta-widget',
      '[class*="sidebar"]:not([class*="content"])', '[id*="sidebar"]:not([id*="content"])'
    ];

    this.adKeywords = [
      '广告', '推广', '赞助商', '推荐阅读', '相关推荐', '猜你喜欢',
      '为你推荐', '热门推荐', '精彩推荐', '相关文章', '更多文章',
      '大家都在看', '你可能还喜欢', '本周热门', '本月热门',
      'ad', 'ads', 'advertise', 'advertisement', 'promo', 'promotion',
      'sponsor', 'sponsored', 'banner', 'commercial'
    ];
  }

  filter(html, platform, customRules) {
    if (!html) return html;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const platformSelectors = this.getPlatformAdSelectors(platform);
    const customAdSelectors = customRules?.adSelectors || [];
    
    const allSelectors = [
      ...this.genericAdSelectors,
      ...this.redundantSelectors,
      ...platformSelectors,
      ...customAdSelectors
    ];

    for (const selector of allSelectors) {
      try {
        const elements = tempDiv.querySelectorAll(selector);
        elements.forEach(el => {
          if (el.parentNode && !this.isImportantElement(el)) {
            el.parentNode.removeChild(el);
          }
        });
      } catch (e) {
        continue;
      }
    }

    this.filterByContentAnalysis(tempDiv);
    this.cleanEmptyElements(tempDiv);
    this.removeInvalidLinks(tempDiv);

    return tempDiv.innerHTML;
  }

  getPlatformAdSelectors(platform) {
    const platformRules = {
      csdn: [
        '.recommend-item-box', '.more-toolbox', '.second-recommend-box',
        '.feed-Side-box', '#commentBox', '.comment-box',
        '.template-box', '.blog-tags-box', '.blog-footer-bottom',
        '.csdn-side-toolbar', '.left-toolbox', '#treeSkill',
        '.article-footer', '.article-info-box .btn', '.share-box',
        '.blog-footer', '.blog_container_aside', '.recommend-list',
        '.recommend-box', '.hot-article', '.rank-list'
      ],
      juejin: [
        '.recommend-list', '.sidebar-block', '.global-component-box',
        '.author-info-block', '.comment-list', '.article-suspended-panel',
        '#comment-box', '.article-footer', '.article-banner',
        '.recommend-box', '.entry-list', '.sidebar', '.column-item'
      ],
      cnblogs: [
        '.ad_text', '#ad_text_under_commentbox', '.cnblogs_code',
        '.commentform', '#google_ads', '.blog_comment_body',
        '#comment_form_container', '.under_post_kb', '.under_post_news',
        '.postDesc', '#blog_post_info', '.comment_form', '#comment_form',
        '.feedback_area_title', '#MySignature', '#blog-comments-placeholder'
      ],
      jianshu: [
        '.recommend-collection', '.note-bottom-ad', '.sidebar',
        '._1PqU57', '.comment-list', '._3VQjf_', '.mobile-ad',
        '.note-bottom', '.follow-btn', '.share-btn', '.report',
        '.note-side', '.collection-footer', '.recommend-note'
      ],
      zhihu: [
        '.Pc-word-card', '.AdblockBanner', '.Recommendations-Main',
        '.CommentsV2', '.Question-sideColumn', '.Reward', '.CornerButton',
        '.Comments-container', '.AnswerItem', '.Question-mainColumn',
        '.AppBanner', '.FollowButton', '.ShareButton', '.Card',
        '.HotQuestions', '.HotTopics', '.RelatedQuestions'
      ],
      segmentfault: [
        '.widget-box', '.sidebar-widget', '.comment-list', '.comments',
        '.relevant-articles', '#sideAd', '.article-sidebar', '.post-sidebar',
        '.share', '.widget-taglist', '.widget-copyright', '.widget-user',
        '.widget-hot', '.widget-news', '.widget-tags'
      ]
    };

    return platformRules[platform] || [];
  }

  isImportantElement(element) {
    const importantTags = ['PRE', 'CODE', 'TABLE', 'IMG', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
    if (importantTags.includes(element.tagName)) {
      return true;
    }

    const importantClasses = ['code', 'highlight', 'syntax', 'hljs', 'prism', 'table'];
    for (const cls of importantClasses) {
      if (element.classList && element.classList.contains(cls)) {
        return true;
      }
    }

    return false;
  }

  filterByContentAnalysis(container) {
    const allElements = container.querySelectorAll('*');
    
    allElements.forEach(el => {
      if (this.isImportantElement(el)) return;

      const textContent = el.textContent?.toLowerCase() || '';
      const className = (el.className || '').toLowerCase();
      const id = (el.id || '').toLowerCase();

      for (const keyword of this.adKeywords) {
        const lowerKeyword = keyword.toLowerCase();
        
        if ((textContent.includes(lowerKeyword) && textContent.length < 50) ||
            className.includes(lowerKeyword) ||
            id.includes(lowerKeyword)) {
          if (el.parentNode && el.childElementCount < 10) {
            el.parentNode.removeChild(el);
            break;
          }
        }
      }
    });
  }

  cleanEmptyElements(container) {
    const emptySelectors = ['p:empty', 'div:empty', 'span:empty', 'section:empty', 'article:empty'];
    
    for (const selector of emptySelectors) {
      try {
        const elements = container.querySelectorAll(selector);
        elements.forEach(el => {
          if (el.parentNode && el.textContent.trim() === '' && el.childElementCount === 0) {
            el.parentNode.removeChild(el);
          }
        });
      } catch (e) {
        continue;
      }
    }

    const brElements = container.querySelectorAll('br');
    let consecutiveBr = 0;
    for (let i = brElements.length - 1; i >= 0; i--) {
      const br = brElements[i];
      const nextSibling = br.nextSibling;
      
      if (nextSibling && nextSibling.tagName === 'BR') {
        consecutiveBr++;
        if (consecutiveBr >= 2) {
          if (br.parentNode) {
            br.parentNode.removeChild(br);
          }
        }
      } else {
        consecutiveBr = 0;
      }
    }
  }

  removeInvalidLinks(container) {
    const links = container.querySelectorAll('a[href]');
    
    links.forEach(link => {
      const href = link.getAttribute('href') || '';
      
      if (href.startsWith('javascript:') || 
          href.startsWith('void(') ||
          href === '#' ||
          href === '') {
        const text = link.textContent.trim();
        if (text.length > 0) {
          const span = document.createElement('span');
          span.textContent = text;
          span.className = link.className;
          if (link.parentNode) {
            link.parentNode.replaceChild(span, link);
          }
        } else if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      }
    });
  }
}

class StructureExtractor {
  constructor() {
    this.languagePatterns = [
      /language-(\w+)/,
      /lang-(\w+)/,
      /hljs-(\w+)/,
      /syntax-(\w+)/,
      /brush:\s*(\w+)/,
      /class=".*?\b(javascript|js|typescript|ts|python|java|cpp|c\+\+|c#|php|ruby|go|golang|rust|swift|kotlin|dart|css|html|json|sql|bash|shell|yaml|yml|xml|markdown|md)\b.*?"/i
    ];

    this.commonLanguages = [
      'javascript', 'js', 'typescript', 'ts', 'python', 'java', 'cpp', 'c++', 'c#',
      'php', 'ruby', 'go', 'golang', 'rust', 'swift', 'kotlin', 'dart',
      'css', 'scss', 'less', 'html', 'xml', 'json', 'yaml', 'yml',
      'sql', 'mysql', 'postgresql', 'bash', 'shell', 'powershell',
      'markdown', 'md', 'latex', 'tex', 'r', 'matlab', 'swift', 'objective-c',
      'c', 'perl', 'lua', 'scala', 'haskell', 'elixir', 'clojure'
    ];

    this.formulaPatterns = [
      /\$\$[\s\S]*?\$\$/g,
      /\$[^\$]+\$/g,
      /\\\([\s\S]*?\\\)/g,
      /\\\[[\s\S]*?\\\]/g,
      /\\begin\{[a-zA-Z]+\}[\s\S]*?\\end\{[a-zA-Z]+\}/g
    ];
  }

  extract(htmlContent, originalDoc, options) {
    const result = {
      toc: [],
      codeBlocks: [],
      images: [],
      links: [],
      formulas: [],
      tables: []
    };

    if (!htmlContent) return result;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    result.toc = this.extractTOC(tempDiv, options);
    result.codeBlocks = this.extractCodeBlocks(tempDiv);
    result.images = this.extractImages(tempDiv);
    result.links = this.extractLinks(tempDiv);
    result.formulas = this.extractFormulas(tempDiv, htmlContent);
    result.tables = this.extractTables(tempDiv);

    return result;
  }

  extractTOC(container, options) {
    const toc = [];
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');

    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1));
      const text = heading.textContent.trim();
      
      if (!text || text.length < 1) return;

      let id = heading.id;
      if (!id) {
        id = `heading-${index}-${text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, '')}`;
        heading.id = id;
      }

      toc.push({
        level: level,
        text: text,
        id: id,
        index: index,
        tagName: heading.tagName
      });
    });

    return toc;
  }

  extractCodeBlocks(container) {
    const codeBlocks = [];
    const preElements = container.querySelectorAll('pre');

    preElements.forEach((pre, index) => {
      const code = pre.querySelector('code');
      const content = code ? code.textContent : pre.textContent;
      const language = this.detectCodeLanguage(pre, code);
      const hasHighlight = this.hasCodeHighlight(pre, code);
      const lineCount = content.split('\n').length;

      codeBlocks.push({
        index: index,
        language: language,
        content: content,
        rawContent: pre.innerHTML,
        hasHighlight: hasHighlight,
        lineCount: lineCount,
        isMultiLine: lineCount > 1,
        isInline: !pre.parentNode || pre.parentNode.tagName === 'P'
      });
    });

    const inlineCodes = container.querySelectorAll('code:not(pre code)');
    inlineCodes.forEach((code, index) => {
      const content = code.textContent;
      if (content.length > 0 && content.length < 100) {
        codeBlocks.push({
          index: preElements.length + index,
          language: this.detectCodeLanguage(null, code),
          content: content,
          rawContent: code.innerHTML,
          hasHighlight: this.hasCodeHighlight(null, code),
          lineCount: 1,
          isMultiLine: false,
          isInline: true
        });
      }
    });

    return codeBlocks;
  }

  extractImages(container) {
    const images = [];
    const imgElements = container.querySelectorAll('img');

    imgElements.forEach((img, index) => {
      const src = this.getImageSrc(img);
      const alt = img.alt || '';
      const title = img.title || '';
      const width = img.width || img.getAttribute('width') || 0;
      const height = img.height || img.getAttribute('height') || 0;

      if (src && !this.isPlaceholderImage(src)) {
        images.push({
          index: index,
          src: src,
          alt: alt,
          title: title,
          width: width,
          height: height,
          isLazy: !!img.getAttribute('data-src') || !!img.getAttribute('data-original'),
          originalAttributes: {
            dataSrc: img.getAttribute('data-src'),
            dataOriginal: img.getAttribute('data-original'),
            srcSet: img.getAttribute('srcset')
          }
        });
      }
    });

    return images;
  }

  extractLinks(container) {
    const links = [];
    const linkElements = container.querySelectorAll('a[href]');

    linkElements.forEach((link, index) => {
      const href = link.getAttribute('href');
      const text = link.textContent.trim();
      const title = link.title || '';

      if (href && !href.startsWith('javascript:') && href !== '#') {
        links.push({
          index: index,
          href: href,
          text: text || href,
          title: title,
          isExternal: this.isExternalLink(href),
          isAnchor: href.startsWith('#')
        });
      }
    });

    return links;
  }

  extractFormulas(container, htmlContent) {
    const formulas = [];

    const mathElements = container.querySelectorAll('math, .MathJax, [class*="math"], [class*="katex"]');
    mathElements.forEach((el, index) => {
      formulas.push({
        index: index,
        type: 'latex',
        content: el.textContent.trim(),
        rawHtml: el.outerHTML,
        elementType: el.tagName.toLowerCase()
      });
    });

    for (const pattern of this.formulaPatterns) {
      const matches = htmlContent.match(pattern);
      if (matches) {
        matches.forEach((match, index) => {
          if (!formulas.some(f => f.rawHtml && f.rawHtml.includes(match))) {
            formulas.push({
              index: formulas.length + index,
              type: 'latex-inline',
              content: match,
              rawHtml: match,
              elementType: 'text'
            });
          }
        });
      }
    }

    return formulas;
  }

  extractTables(container) {
    const tables = [];
    const tableElements = container.querySelectorAll('table');

    tableElements.forEach((table, index) => {
      const rows = table.querySelectorAll('tr');
      const headers = table.querySelectorAll('th');
      const data = [];

      rows.forEach((row, rowIndex) => {
        const cells = row.querySelectorAll('td, th');
        const rowData = [];
        cells.forEach((cell, cellIndex) => {
          rowData.push({
            text: cell.textContent.trim(),
            isHeader: cell.tagName === 'TH',
            colspan: cell.getAttribute('colspan') || 1,
            rowspan: cell.getAttribute('rowspan') || 1
          });
        });
        data.push(rowData);
      });

      tables.push({
        index: index,
        rowCount: rows.length,
        columnCount: headers.length > 0 ? headers.length : (rows[0]?.querySelectorAll('td')?.length || 0),
        hasHeader: headers.length > 0,
        data: data,
        rawHtml: table.outerHTML
      });
    });

    return tables;
  }

  detectCodeLanguage(pre, code) {
    if (!pre && !code) return '';

    const classNames = [
      ...(pre?.className ? pre.className.split(' ') : []),
      ...(code?.className ? code.className.split(' ') : [])
    ];

    for (const className of classNames) {
      for (const pattern of this.languagePatterns) {
        const match = className.match(pattern);
        if (match) {
          const lang = (match[1] || match[2] || match[3] || '').toLowerCase();
          return this.normalizeLanguage(lang);
        }
      }
    }

    for (const lang of this.commonLanguages) {
      if (classNames.includes(lang) || classNames.includes(lang.toLowerCase())) {
        return this.normalizeLanguage(lang);
      }
    }

    return '';
  }

  normalizeLanguage(lang) {
    const mappings = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'rb': 'ruby',
      'sh': 'bash',
      'shell': 'bash',
      'md': 'markdown',
      'yml': 'yaml',
      'html': 'html',
      'htm': 'html',
      'c++': 'cpp',
      'c#': 'csharp',
      'golang': 'go'
    };

    return mappings[lang.toLowerCase()] || lang.toLowerCase();
  }

  hasCodeHighlight(pre, code) {
    const classNames = [
      ...(pre?.className ? pre.className.toLowerCase() : ''),
      ...(code?.className ? code.className.toLowerCase() : '')
    ].join(' ');

    const highlightClasses = ['hljs', 'prism', 'prettyprint', 'syntaxhighlighter', 'highlight', 'codehilite', 'syntax'];
    return highlightClasses.some(cls => classNames.includes(cls));
  }

  getImageSrc(img) {
    return img.src || 
           img.getAttribute('data-src') || 
           img.getAttribute('data-original') ||
           img.getAttribute('data-lazy') ||
           img.getAttribute('data-srcset')?.split(' ')[0] ||
           '';
  }

  isPlaceholderImage(src) {
    const placeholderPatterns = [
      /placeholder/i,
      /blank/i,
      /transparent/i,
      /1x1\.(png|gif|jpg)/i,
      /spacer/i,
      /pixel/i,
      /loading.*\.(png|gif|jpg)/i
    ];

    return placeholderPatterns.some(pattern => pattern.test(src));
  }

  isExternalLink(href) {
    try {
      const url = new URL(href, window.location.href);
      return url.origin !== window.location.origin;
    } catch {
      return false;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    AIParser, 
    SemanticAnalyzer, 
    AdvancedAdFilter, 
    StructureExtractor 
  };
}
