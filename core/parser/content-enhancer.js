class ContentEnhancer {
  constructor(options = {}) {
    this.options = {
      removeRedundant: true,
      normalizeLinks: true,
      preserveCodeHighlight: true,
      fixFormatting: true,
      deduplicateContent: true,
      enableReadingMode: true,
      enableImageOffline: true,
      preserveFormulas: true,
      preserveTables: true,
      enableCodeFormatting: true,
      removeFormatting: true,
      ...options
    };

    this.imageOfflineManager = new ImageOfflineManager();
    this.formulaProcessor = new FormulaProcessor();
    this.tableProcessor = new TableProcessor();
    this.codeFormatter = new CodeFormatter();
  }

  enhance(parsedData) {
    if (!parsedData.success || !parsedData.htmlContent) {
      return parsedData;
    }

    let enhancedData = { ...parsedData };

    if (this.options.removeRedundant) {
      enhancedData.htmlContent = this.removeRedundantElements(enhancedData.htmlContent);
    }

    if (this.options.normalizeLinks) {
      enhancedData = this.normalizeLinksAndImages(enhancedData);
    }

    if (this.options.preserveCodeHighlight) {
      enhancedData.htmlContent = this.preserveCodeHighlight(enhancedData.htmlContent);
    }

    if (this.options.enableCodeFormatting && enhancedData.codeBlocks) {
      enhancedData.formattedCodeBlocks = this.codeFormatter.formatAll(enhancedData.codeBlocks);
    }

    if (this.options.preserveFormulas && enhancedData.formulas) {
      enhancedData = this.formulaProcessor.process(enhancedData);
    }

    if (this.options.preserveTables && enhancedData.tables) {
      enhancedData = this.tableProcessor.process(enhancedData);
    }

    if (this.options.fixFormatting) {
      enhancedData.htmlContent = this.fixFormatting(enhancedData.htmlContent);
    }

    if (this.options.deduplicateContent) {
      enhancedData = this.deduplicateContent(enhancedData);
    }

    if (this.options.removeFormatting) {
      enhancedData.htmlContent = this.cleanForMarkdown(enhancedData.htmlContent);
    }

    if (this.options.enableReadingMode) {
      enhancedData.readingModeHTML = this.enableReadingMode(enhancedData.htmlContent);
    }

    if (this.options.enableImageOffline && enhancedData.images) {
      enhancedData = this.imageOfflineManager.process(enhancedData);
    }

    return enhancedData;
  }

  removeRedundantElements(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const redundantSelectors = [
      '.social-share', '.share-buttons', '[class*="share"]', '[class*="social"]',
      '.like-button', '.vote-button', '.comment-button', '.follow-button',
      '.subscribe-box', '.newsletter-box', '.signup-box',
      '.related-posts', '.related-articles', '[class*="related"]', '[class*="similar"]',
      '.author-bio', '.about-author', '.author-info', '.author-card',
      '.post-navigation', '.nav-links', '[class*="navigation"]', '.prev-next',
      '.footer-widgets', '.post-footer', '.article-footer', '.entry-footer',
      '[style*="display:none"]', '[style*="display: none"]', '[style*="visibility:hidden"]',
      'noscript', 'script', 'style',
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
      '.recent-posts', '.recent-comments', '.meta-widget'
    ];

    for (const selector of redundantSelectors) {
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

    return tempDiv.innerHTML;
  }

  isImportantElement(element) {
    const importantTags = ['PRE', 'CODE', 'TABLE', 'IMG', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'UL', 'OL'];
    if (importantTags.includes(element.tagName)) {
      return true;
    }

    const importantClasses = ['code', 'highlight', 'syntax', 'hljs', 'prism', 'table', 'math', 'formula'];
    for (const cls of importantClasses) {
      if (element.classList && element.classList.contains(cls)) {
        return true;
      }
    }

    return false;
  }

  normalizeLinksAndImages(parsedData) {
    const result = { ...parsedData };
    const baseUrl = parsedData.url;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = result.htmlContent;

    const links = tempDiv.querySelectorAll('a[href]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl).href;
          link.setAttribute('href', absoluteUrl);
          if (!link.title && link.textContent.trim()) {
            link.title = link.textContent.trim();
          }
        } catch (e) {
        }
      }
    });

    const images = tempDiv.querySelectorAll('img[src], img[data-src], img[data-original]');
    images.forEach(img => {
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-original');
      if (src) {
        try {
          const absoluteUrl = new URL(src, baseUrl).href;
          img.setAttribute('src', absoluteUrl);
          img.dataset.originalSrc = src;
          img.removeAttribute('data-src');
          img.removeAttribute('data-original');
        } catch (e) {
        }
      }
    });

    result.htmlContent = tempDiv.innerHTML;

    if (result.images) {
      result.images = result.images.map(img => {
        try {
          const absoluteSrc = new URL(img.src, baseUrl).href;
          return { ...img, src: absoluteSrc };
        } catch {
          return img;
        }
      });
    }

    if (result.links) {
      result.links = result.links.map(link => {
        try {
          const absoluteHref = new URL(link.href, baseUrl).href;
          return { ...link, href: absoluteHref };
        } catch {
          return link;
        }
      });
    }

    return result;
  }

  preserveCodeHighlight(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const preElements = tempDiv.querySelectorAll('pre');
    preElements.forEach(pre => {
      const code = pre.querySelector('code');
      if (code) {
        const codeClass = code.className;
        const preClass = pre.className;
        
        if (!pre.getAttribute('data-code-lang')) {
          const langMatch = (codeClass + ' ' + preClass).match(/language-(\w+)|lang-(\w+)|hljs-(\w+)/);
          if (langMatch) {
            pre.setAttribute('data-code-lang', langMatch[1] || langMatch[2] || langMatch[3]);
          }
        }

        if (!code.textContent.trim() && pre.textContent.trim()) {
          code.textContent = pre.textContent;
        }

        pre.dataset.hasHighlight = this.hasHighlightClasses(preClass + ' ' + codeClass);
      }
    });

    return tempDiv.innerHTML;
  }

  hasHighlightClasses(className) {
    const highlightClasses = ['hljs', 'prism', 'prettyprint', 'syntaxhighlighter', 'highlight', 'codehilite', 'syntax'];
    return highlightClasses.some(cls => className.toLowerCase().includes(cls));
  }

  fixFormatting(html) {
    let fixed = html;

    fixed = fixed.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
    fixed = fixed.replace(/(<p>\s*<\/p>\s*)+/gi, '');
    fixed = fixed.replace(/\n\s*\n\s*\n+/g, '\n\n');
    fixed = fixed.replace(/&nbsp;/g, ' ');
    fixed = fixed.replace(/\s{2,}/g, ' ');

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = fixed;

    const lists = tempDiv.querySelectorAll('ul, ol');
    lists.forEach(list => {
      const items = list.querySelectorAll('li');
      items.forEach(li => {
        const text = li.textContent.trim();
        if (text === '' || text === '-' || text === '*' || text === '•') {
          if (li.parentNode) {
            li.parentNode.removeChild(li);
          }
        }
      });
    });

    const blockquotes = tempDiv.querySelectorAll('blockquote');
    blockquotes.forEach(bq => {
      const text = bq.textContent.trim();
      if (text === '') {
        if (bq.parentNode) {
          bq.parentNode.removeChild(bq);
        }
      }
    });

    return tempDiv.innerHTML;
  }

  deduplicateContent(parsedData) {
    const result = { ...parsedData };

    if (result.codeBlocks && result.codeBlocks.length > 1) {
      const seenContent = new Map();
      result.codeBlocks = result.codeBlocks.filter(block => {
        const contentKey = block.content.trim().substring(0, Math.min(200, block.content.length));
        if (seenContent.has(contentKey)) {
          const existingIndex = seenContent.get(contentKey);
          if (block.isInline && !result.codeBlocks[existingIndex]?.isInline) {
            return false;
          }
          if (block.content.length < result.codeBlocks[existingIndex]?.content?.length) {
            return false;
          }
        }
        seenContent.set(contentKey, block.index);
        return true;
      });
    }

    if (result.images && result.images.length > 1) {
      const seenSrcs = new Set();
      result.images = result.images.filter(img => {
        if (seenSrcs.has(img.src)) {
          return false;
        }
        seenSrcs.add(img.src);
        return true;
      });
    }

    if (result.links && result.links.length > 1) {
      const seenLinks = new Set();
      result.links = result.links.filter(link => {
        const key = `${link.href}-${link.text}`;
        if (seenLinks.has(key)) {
          return false;
        }
        seenLinks.add(key);
        return true;
      });
    }

    if (result.htmlContent) {
      result.htmlContent = this.removeDuplicateParagraphs(result.htmlContent);
    }

    return result;
  }

  removeDuplicateParagraphs(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const paragraphs = tempDiv.querySelectorAll('p');
    const seenTexts = new Map();

    paragraphs.forEach(p => {
      const text = p.textContent.trim();
      if (text.length > 20) {
        const textKey = text.substring(0, Math.min(100, text.length));
        if (seenTexts.has(textKey)) {
          if (p.parentNode) {
            p.parentNode.removeChild(p);
          }
        } else {
          seenTexts.set(textKey, true);
        }
      }
    });

    return tempDiv.innerHTML;
  }

  enableReadingMode(html, options = {}) {
    if (!html) return '';

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const readingModeStyles = {
      container: `
        max-width: 800px;
        margin: 0 auto;
        padding: 40px 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 18px;
        line-height: 1.8;
        color: #333;
        background-color: #fafafa;
      `,
      headings: `
        font-weight: 600;
        line-height: 1.4;
        margin-top: 2em;
        margin-bottom: 0.5em;
        color: #1a1a1a;
      `,
      h1: `
        font-size: 2em;
        margin-top: 1em;
        margin-bottom: 0.75em;
        border-bottom: 2px solid #e1e4e8;
        padding-bottom: 0.5em;
      `,
      h2: `
        font-size: 1.5em;
        margin-top: 1.5em;
      `,
      h3: `
        font-size: 1.25em;
      `,
      code: `
        background-color: #f6f8fa;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        font-size: 0.9em;
        color: #d73a49;
      `,
      pre: `
        background-color: #1e1e1e;
        color: #d4d4d4;
        padding: 16px;
        border-radius: 8px;
        overflow-x: auto;
        margin: 1em 0;
        border: 1px solid #e1e4e8;
      `,
      links: `
        color: #0366d6;
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: border-bottom 0.2s;
      `,
      linksHover: `
        text-decoration: underline;
      `,
      images: `
        max-width: 100%;
        height: auto;
        border-radius: 4px;
        margin: 1em 0;
        display: block;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      `,
      blockquotes: `
        border-left: 4px solid #dfe2e5;
        padding-left: 16px;
        margin: 1em 0;
        color: #6a737d;
        font-style: italic;
        background-color: #f8f9fa;
        padding: 16px;
        border-radius: 0 4px 4px 0;
      `,
      tables: `
        width: 100%;
        border-collapse: collapse;
        margin: 1em 0;
        font-size: 0.95em;
      `,
      tableCells: `
        border: 1px solid #dfe2e5;
        padding: 12px 16px;
        text-align: left;
      `,
      tableHeader: `
        background-color: #f6f8fa;
        font-weight: 600;
        color: #24292e;
      `,
      lists: `
        padding-left: 2em;
        margin: 1em 0;
      `,
      listItems: `
        margin: 0.5em 0;
        line-height: 1.6;
      `,
      paragraphs: `
        margin: 1em 0;
        text-align: justify;
      `,
      hr: `
        border: 0;
        height: 1px;
        background: #e1e4e8;
        margin: 2em 0;
      `
    };

    const container = document.createElement('div');
    container.style.cssText = readingModeStyles.container;
    container.className = 'reading-mode-container';

    const allElements = tempDiv.querySelectorAll('*');
    allElements.forEach(el => {
      el.removeAttribute('style');
    });

    container.innerHTML = tempDiv.innerHTML;

    const paragraphs = container.querySelectorAll('p');
    paragraphs.forEach(p => {
      p.style.cssText = readingModeStyles.paragraphs;
    });

    const h1Elements = container.querySelectorAll('h1');
    h1Elements.forEach(h => {
      h.style.cssText = readingModeStyles.headings + readingModeStyles.h1;
    });

    const h2Elements = container.querySelectorAll('h2');
    h2Elements.forEach(h => {
      h.style.cssText = readingModeStyles.headings + readingModeStyles.h2;
    });

    const h3Elements = container.querySelectorAll('h3');
    h3Elements.forEach(h => {
      h.style.cssText = readingModeStyles.headings + readingModeStyles.h3;
    });

    const h456Elements = container.querySelectorAll('h4, h5, h6');
    h456Elements.forEach(h => {
      h.style.cssText = readingModeStyles.headings;
    });

    const codes = container.querySelectorAll('code:not(pre code)');
    codes.forEach(c => {
      c.style.cssText = readingModeStyles.code;
    });

    const pres = container.querySelectorAll('pre');
    pres.forEach(pre => {
      pre.style.cssText = readingModeStyles.pre;
      const preCode = pre.querySelector('code');
      if (preCode) {
        preCode.style.cssText = `
          background: none;
          padding: 0;
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
          font-size: 14px;
          line-height: 1.5;
          color: #d4d4d4;
        `;
      }
    });

    const links = container.querySelectorAll('a');
    links.forEach(a => {
      a.style.cssText = readingModeStyles.links;
    });

    const imgs = container.querySelectorAll('img');
    imgs.forEach(img => {
      img.style.cssText = readingModeStyles.images;
    });

    const blockquotes = container.querySelectorAll('blockquote');
    blockquotes.forEach(bq => {
      bq.style.cssText = readingModeStyles.blockquotes;
    });

    const tables = container.querySelectorAll('table');
    tables.forEach(table => {
      table.style.cssText = readingModeStyles.tables;
      const cells = table.querySelectorAll('th, td');
      cells.forEach(cell => {
        cell.style.cssText = readingModeStyles.tableCells;
      });
      const headers = table.querySelectorAll('th');
      headers.forEach(th => {
        th.style.cssText += readingModeStyles.tableHeader;
      });
    });

    const uls = container.querySelectorAll('ul');
    uls.forEach(ul => {
      ul.style.cssText = readingModeStyles.lists;
      const items = ul.querySelectorAll('li');
      items.forEach(li => {
        li.style.cssText = readingModeStyles.listItems;
      });
    });

    const ols = container.querySelectorAll('ol');
    ols.forEach(ol => {
      ol.style.cssText = readingModeStyles.lists;
      const items = ol.querySelectorAll('li');
      items.forEach(li => {
        li.style.cssText = readingModeStyles.listItems;
      });
    });

    const hrs = container.querySelectorAll('hr');
    hrs.forEach(hr => {
      hr.style.cssText = readingModeStyles.hr;
    });

    return container.outerHTML;
  }

  cleanForMarkdown(html) {
    let cleaned = html;

    cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    cleaned = cleaned.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');

    cleaned = cleaned.replace(/on\w+="[^"]*"/gi, '');
    cleaned = cleaned.replace(/on\w+='[^']*'/gi, '');

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cleaned;

    const emptyElements = tempDiv.querySelectorAll('div:empty, span:empty, p:empty, section:empty, article:empty');
    emptyElements.forEach(el => {
      if (el.parentNode && el.textContent.trim() === '') {
        el.parentNode.removeChild(el);
      }
    });

    const inlineStyles = tempDiv.querySelectorAll('[style]');
    inlineStyles.forEach(el => {
      const style = el.getAttribute('style') || '';
      if (style.includes('display:none') || style.includes('visibility:hidden')) {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      }
    });

    return tempDiv.innerHTML;
  }
}

class ImageOfflineManager {
  constructor() {
    this.cachedImages = new Map();
    this.maxCacheSize = 50 * 1024 * 1024;
  }

  process(parsedData) {
    const result = { ...parsedData };

    if (!result.images || result.images.length === 0) {
      return result;
    }

    result.images = result.images.map(img => {
      return {
        ...img,
        offlineReady: this.canBeOfflined(img),
        cacheKey: this.generateCacheKey(img),
        downloadInfo: {
          status: 'pending',
          lastAttempt: null,
          error: null
        }
      };
    });

    result.htmlContent = this.processImagesInHtml(result.htmlContent, result.images);

    result.offlineSummary = {
      totalImages: result.images.length,
      canBeOfflined: result.images.filter(img => img.offlineReady).length,
      alreadyCached: result.images.filter(img => this.cachedImages.has(img.cacheKey)).length
    };

    return result;
  }

  canBeOfflined(img) {
    if (!img.src) return false;

    const invalidPatterns = [
      /data:image\/(gif|png);base64,R0lGODlhAQABAIAAAP\/\/\/\//,
      /placeholder/i,
      /blank\.gif/i,
      /spacer/i,
      /pixel/i,
      /^blob:/,
      /^javascript:/
    ];

    for (const pattern of invalidPatterns) {
      if (pattern.test(img.src)) {
        return false;
      }
    }

    if (img.width === 1 || img.height === 1) {
      return false;
    }

    return true;
  }

  generateCacheKey(img) {
    const url = img.src || '';
    let baseName = '';

    try {
      const urlObj = new URL(url);
      baseName = urlObj.pathname.split('/').pop() || 'image';
    } catch {
      baseName = url.split('/').pop() || 'image';
    }

    const hash = this.simpleHash(url);
    const ext = this.getExtension(baseName);

    return `${hash}${ext}`;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  getExtension(filename) {
    const match = filename.match(/\.([^.]+)$/);
    if (match) {
      const ext = match[1].toLowerCase();
      const validExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
      if (validExts.includes(ext)) {
        return '.' + ext;
      }
    }
    return '.png';
  }

  processImagesInHtml(html, images) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const imgElements = tempDiv.querySelectorAll('img');

    imgElements.forEach((imgEl, index) => {
      const src = imgEl.src || imgEl.getAttribute('data-src');
      const matchingImage = images.find(img => img.src === src || img.originalAttributes?.dataSrc === src);

      if (matchingImage) {
        imgEl.setAttribute('data-original-src', matchingImage.src);
        imgEl.setAttribute('data-cache-key', matchingImage.cacheKey);
        imgEl.setAttribute('data-offline-ready', matchingImage.offlineReady.toString());

        if (matchingImage.alt) {
          imgEl.alt = matchingImage.alt;
        }
        if (matchingImage.title) {
          imgEl.title = matchingImage.title;
        }
      }
    });

    return tempDiv.innerHTML;
  }

  async downloadImage(img) {
    return new Promise((resolve, reject) => {
      const imgElement = new Image();
      imgElement.crossOrigin = 'anonymous';

      imgElement.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = imgElement.naturalWidth;
          canvas.height = imgElement.naturalHeight;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(imgElement, 0, 0);

          const dataUrl = canvas.toDataURL('image/png');
          const cacheKey = this.generateCacheKey(img);

          this.cachedImages.set(cacheKey, {
            dataUrl: dataUrl,
            originalUrl: img.src,
            timestamp: Date.now(),
            size: dataUrl.length
          });

          resolve({ success: true, cacheKey, dataUrl });
        } catch (error) {
          reject(error);
        }
      };

      imgElement.onerror = (error) => {
        reject(error);
      };

      imgElement.src = img.src;
    });
  }

  replaceWithOfflineVersion(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const imgElements = tempDiv.querySelectorAll('img[data-cache-key]');

    imgElements.forEach(imgEl => {
      const cacheKey = imgEl.getAttribute('data-cache-key');
      if (cacheKey && this.cachedImages.has(cacheKey)) {
        const cached = this.cachedImages.get(cacheKey);
        imgEl.src = cached.dataUrl;
        imgEl.setAttribute('data-was-offlined', 'true');
      }
    });

    return tempDiv.innerHTML;
  }
}

class FormulaProcessor {
  constructor() {
    this.latexPatterns = [
      { regex: /\$\$([\s\S]*?)\$\$/g, type: 'block', delimiter: '$$' },
      { regex: /\$([^$\n]+)\$/g, type: 'inline', delimiter: '$' },
      { regex: /\\\(([\s\S]*?)\\\)/g, type: 'inline', delimiter: '\\(' },
      { regex: /\\\[([\s\S]*?)\\\]/g, type: 'block', delimiter: '\\[' },
      { regex: /\\begin\{([a-zA-Z]+)\}([\s\S]*?)\\end\{\1\}/g, type: 'environment', delimiter: 'environment' }
    ];
  }

  process(parsedData) {
    const result = { ...parsedData };

    if (!result.formulas || result.formulas.length === 0) {
      return result;
    }

    result.formulas = result.formulas.map(formula => {
      return {
        ...formula,
        normalized: this.normalizeFormula(formula),
        markdownReady: this.toMarkdownFormula(formula),
        isValid: this.validateFormula(formula)
      };
    });

    result.htmlContent = this.processFormulasInHtml(result.htmlContent, result.formulas);

    result.formulaSummary = {
      total: result.formulas.length,
      blockFormulas: result.formulas.filter(f => f.type === 'block' || f.type === 'environment').length,
      inlineFormulas: result.formulas.filter(f => f.type === 'inline').length,
      validFormulas: result.formulas.filter(f => f.isValid).length
    };

    return result;
  }

  normalizeFormula(formula) {
    let content = formula.content || '';

    for (const pattern of this.latexPatterns) {
      if (content.match(pattern.regex)) {
        content = content.replace(pattern.regex, (match, p1, p2) => {
          if (pattern.type === 'environment') {
            return p2 || match;
          }
          return p1 || p2 || match;
        });
      }
    }

    content = content.trim();
    content = content.replace(/^\s+|\s+$/g, '');
    content = content.replace(/\n\s*\n/g, '\n');

    return content;
  }

  toMarkdownFormula(formula) {
    const normalized = formula.normalized || formula.content;
    const type = formula.type || 'inline';

    if (type === 'block' || type === 'environment') {
      return `$$\n${normalized}\n$$`;
    } else {
      return `$${normalized}$`;
    }
  }

  validateFormula(formula) {
    const content = formula.content || '';

    if (content.length < 2) return false;

    let braceBalance = 0;
    let bracketBalance = 0;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';

      if (char === '{' && prevChar !== '\\') braceBalance++;
      if (char === '}' && prevChar !== '\\') braceBalance--;
      if (char === '[' && prevChar !== '\\') bracketBalance++;
      if (char === ']' && prevChar !== '\\') bracketBalance--;
    }

    return braceBalance === 0 && bracketBalance === 0;
  }

  processFormulasInHtml(html, formulas) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const mathElements = tempDiv.querySelectorAll('math, .MathJax, [class*="math"], [class*="katex"], .formula');

    mathElements.forEach((el, index) => {
      const matchingFormula = formulas.find(f => 
        f.rawHtml && (el.outerHTML.includes(f.rawHtml) || f.rawHtml.includes(el.outerHTML))
      );

      if (matchingFormula) {
        el.setAttribute('data-formula-type', matchingFormula.type);
        el.setAttribute('data-formula-markdown', matchingFormula.markdownReady);
        el.setAttribute('data-formula-normalized', matchingFormula.normalized);
      }
    });

    return tempDiv.innerHTML;
  }

  extractFromText(text) {
    const formulas = [];
    let matchIndex = 0;

    for (const pattern of this.latexPatterns) {
      const regex = new RegExp(pattern.regex.source, 'g');
      let match;

      while ((match = regex.exec(text)) !== null) {
        formulas.push({
          index: matchIndex++,
          type: pattern.type,
          content: match[0],
          normalized: match[1] || match[2] || match[0],
          position: match.index,
          length: match[0].length
        });
      }
    }

    return formulas.sort((a, b) => a.position - b.position);
  }
}

class TableProcessor {
  constructor() {
    this.markdownTableStyles = {
      default: {
        leftSeparator: ':',
        rightSeparator: '-',
        centerSeparator: ':'
      },
      github: {
        leftSeparator: ':',
        rightSeparator: '-',
        centerSeparator: ':'
      },
      simple: {
        leftSeparator: '-',
        rightSeparator: '-',
        centerSeparator: '-'
      }
    };
  }

  process(parsedData) {
    const result = { ...parsedData };

    if (!result.tables || result.tables.length === 0) {
      return result;
    }

    result.tables = result.tables.map(table => {
      return {
        ...table,
        normalized: this.normalizeTable(table),
        markdown: this.toMarkdownTable(table),
        html: this.cleanTableHtml(table),
        isComplex: this.isComplexTable(table)
      };
    });

    result.htmlContent = this.processTablesInHtml(result.htmlContent, result.tables);

    result.tableSummary = {
      total: result.tables.length,
      withHeaders: result.tables.filter(t => t.hasHeader).length,
      complexTables: result.tables.filter(t => t.isComplex).length,
      totalRows: result.tables.reduce((sum, t) => sum + t.rowCount, 0),
      totalColumns: result.tables.reduce((sum, t) => sum + t.columnCount, 0)
    };

    return result;
  }

  normalizeTable(table) {
    if (!table.data || table.data.length === 0) {
      return table.data || [];
    }

    const normalized = [];
    const maxCols = Math.max(...table.data.map(row => row.length));

    for (let rowIndex = 0; rowIndex < table.data.length; rowIndex++) {
      const row = table.data[rowIndex];
      const normalizedRow = [];

      for (let colIndex = 0; colIndex < maxCols; colIndex++) {
        if (colIndex < row.length) {
          const cell = row[colIndex];
          normalizedRow.push({
            ...cell,
            text: this.cleanCellText(cell.text),
            rowSpan: parseInt(cell.rowSpan) || 1,
            colSpan: parseInt(cell.colSpan) || 1
          });
        } else {
          normalizedRow.push({
            text: '',
            isHeader: false,
            rowSpan: 1,
            colSpan: 1
          });
        }
      }

      normalized.push(normalizedRow);
    }

    return normalized;
  }

  cleanCellText(text) {
    if (!text) return '';

    let cleaned = text.trim();
    cleaned = cleaned.replace(/\n+/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/&nbsp;/g, ' ');
    cleaned = cleaned.replace(/<[^>]*>/g, '');

    return cleaned.trim();
  }

  toMarkdownTable(table, style = 'default') {
    if (!table.data || table.data.length === 0) {
      return '';
    }

    const data = table.normalized || table.data;
    const styles = this.markdownTableStyles[style] || this.markdownTableStyles.default;

    const colWidths = this.calculateColumnWidths(data);

    let markdown = '';

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];
      const cells = row.map((cell, colIndex) => {
        const text = cell.text || '';
        const width = colWidths[colIndex] || text.length;
        return ` ${text.padEnd(width)} `;
      });

      markdown += '|' + cells.join('|') + '|\n';

      if (rowIndex === 0 && (table.hasHeader || row.some(cell => cell.isHeader))) {
        const separatorRow = row.map((cell, colIndex) => {
          const width = colWidths[colIndex] || 3;
          let separator = '';

          if (cell.isHeader || rowIndex === 0) {
            separator = styles.leftSeparator + '-'.repeat(Math.max(1, width - 2)) + styles.rightSeparator;
          } else {
            separator = '-'.repeat(width + 2);
          }

          return separator;
        });

        markdown += '|' + separatorRow.join('|') + '|\n';
      }
    }

    return markdown;
  }

  calculateColumnWidths(data) {
    if (!data || data.length === 0) return [];

    const maxCols = Math.max(...data.map(row => row.length));
    const widths = new Array(maxCols).fill(3);

    for (const row of data) {
      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const text = row[colIndex]?.text || '';
        widths[colIndex] = Math.max(widths[colIndex], text.length);
      }
    }

    return widths.map(w => Math.min(Math.max(w, 3), 50));
  }

  cleanTableHtml(table) {
    if (!table.rawHtml) return '';

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = table.rawHtml;

    const tableEl = tempDiv.querySelector('table');
    if (!tableEl) return table.rawHtml;

    tableEl.removeAttribute('style');
    tableEl.removeAttribute('width');
    tableEl.removeAttribute('height');
    tableEl.removeAttribute('border');
    tableEl.removeAttribute('cellpadding');
    tableEl.removeAttribute('cellspacing');

    const cells = tableEl.querySelectorAll('th, td');
    cells.forEach(cell => {
      cell.removeAttribute('style');
      cell.removeAttribute('width');
      cell.removeAttribute('height');
      cell.removeAttribute('bgcolor');
    });

    return tableEl.outerHTML;
  }

  isComplexTable(table) {
    if (!table.data) return false;

    for (const row of table.data) {
      for (const cell of row) {
        if (parseInt(cell.rowSpan) > 1 || parseInt(cell.colSpan) > 1) {
          return true;
        }
      }
    }

    return false;
  }

  processTablesInHtml(html, tables) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const tableElements = tempDiv.querySelectorAll('table');

    tableElements.forEach((tableEl, index) => {
      const matchingTable = tables[index];

      if (matchingTable) {
        tableEl.setAttribute('data-table-index', matchingTable.index.toString());
        tableEl.setAttribute('data-table-rows', matchingTable.rowCount.toString());
        tableEl.setAttribute('data-table-columns', matchingTable.columnCount.toString());
        tableEl.setAttribute('data-table-has-header', matchingTable.hasHeader.toString());
        tableEl.setAttribute('data-table-is-complex', matchingTable.isComplex.toString());

        if (matchingTable.markdown) {
          tableEl.setAttribute('data-table-markdown', matchingTable.markdown.substring(0, 500) + (matchingTable.markdown.length > 500 ? '...' : ''));
        }
      }
    });

    return tempDiv.innerHTML;
  }
}

class CodeFormatter {
  constructor() {
    this.indentSize = 4;
    this.maxLineLength = 120;
  }

  formatAll(codeBlocks) {
    if (!codeBlocks || codeBlocks.length === 0) {
      return [];
    }

    return codeBlocks.map(block => {
      return {
        ...block,
        formatted: this.formatBlock(block),
        markdownReady: this.toMarkdownCodeBlock(block),
        analysis: this.analyzeCode(block)
      };
    });
  }

  formatBlock(block) {
    const content = block.content || '';
    const language = block.language || '';

    let formatted = content;

    formatted = this.normalizeLineEndings(formatted);
    formatted = this.trimTrailingWhitespace(formatted);
    formatted = this.normalizeIndentation(formatted, language);

    return formatted;
  }

  normalizeLineEndings(content) {
    return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  trimTrailingWhitespace(content) {
    const lines = content.split('\n');
    const trimmed = lines.map(line => line.replace(/\s+$/, ''));
    while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === '') {
      trimmed.pop();
    }
    return trimmed.join('\n');
  }

  normalizeIndentation(content, language) {
    const lines = content.split('\n');
    if (lines.length <= 1) return content;

    const minIndent = this.detectMinIndent(lines);

    if (minIndent > 0) {
      const normalized = lines.map(line => {
        if (line.trim() === '') return '';
        return line.substring(minIndent);
      });
      return normalized.join('\n');
    }

    return content;
  }

  detectMinIndent(lines) {
    const nonEmptyLines = lines.filter(line => line.trim() !== '');
    if (nonEmptyLines.length === 0) return 0;

    let minIndent = Infinity;

    for (const line of nonEmptyLines) {
      const match = line.match(/^(\s+)/);
      if (match) {
        minIndent = Math.min(minIndent, match[1].length);
      } else {
        return 0;
      }
    }

    return minIndent === Infinity ? 0 : minIndent;
  }

  toMarkdownCodeBlock(block) {
    const content = block.formatted || block.content || '';
    const language = block.language || '';
    const fence = '```';

    return `${fence}${language}\n${content}\n${fence}\n\n`;
  }

  analyzeCode(block) {
    const content = block.content || '';
    const lines = content.split('\n');

    return {
      lineCount: lines.length,
      charCount: content.length,
      avgLineLength: lines.length > 0 ? Math.round(content.length / lines.length) : 0,
      hasMultilineStrings: this.detectMultilineStrings(content, block.language),
      hasComments: this.detectComments(content, block.language),
      complexityScore: this.calculateComplexity(content, block.language)
    };
  }

  detectMultilineStrings(content, language) {
    const patterns = {
      javascript: [/`[\s\S]*?`/g],
      python: [/"""[\s\S]*?"""/g, /'''[\s\S]*?'''/g],
      php: [/<<<['"]?(\w+)['"]?[\s\S]*?\1;/g],
      ruby: [/<<[-~]?['"]?(\w+)['"]?[\s\S]*?^\1/gm]
    };

    const langPatterns = patterns[language] || [];

    for (const pattern of langPatterns) {
      if (pattern.test(content)) {
        return true;
      }
    }

    return false;
  }

  detectComments(content, language) {
    const commentPatterns = {
      singleLine: [/\/\/.*$/gm, /#.*$/gm, /--.*$/gm],
      multiLine: [/\/\*[\s\S]*?\*\//g, /<!--[\s\S]*?-->/g, /"""[\s\S]*?"""/g]
    };

    for (const pattern of commentPatterns.singleLine) {
      if (pattern.test(content)) return true;
    }

    for (const pattern of commentPatterns.multiLine) {
      if (pattern.test(content)) return true;
    }

    return false;
  }

  calculateComplexity(content, language) {
    let score = 0;

    const controlFlowPatterns = [
      /\bif\s*\(/g,
      /\belse\s*\n?\s*\{?/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bswitch\s*\(/g,
      /\bcase\s+\w+:/g,
      /\btry\s*\{/g,
      /\bcatch\s*\(/g,
      /\bthrow\s+/g,
      /\breturn\s+/g,
      /\bbreak\s*;?/g,
      /\bcontinue\s*;?/g,
      /&&|\|\||\?\?/g
    ];

    for (const pattern of controlFlowPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        score += matches.length;
      }
    }

    const functionPatterns = [
      /\bfunction\s+\w+\s*\(/g,
      /\bconst\s+\w+\s*=\s*(async\s*)?\(/g,
      /\blet\s+\w+\s*=\s*(async\s*)?\(/g,
      /\bvar\s+\w+\s*=\s*(async\s*)?\(/g,
      /\bdef\s+\w+\s*\(/g,
      /\bclass\s+\w+/g,
      /=>/g
    ];

    for (const pattern of functionPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        score += matches.length * 2;
      }
    }

    return Math.min(score, 100);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ContentEnhancer,
    ImageOfflineManager,
    FormulaProcessor,
    TableProcessor,
    CodeFormatter
  };
}
