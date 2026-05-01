class TemplateEngine {
  constructor(storage = null) {
    this.storage = storage || chrome.storage;
    this.templatesCache = null;
    this.cacheKey = 'markdown_templates';
    this.defaultTemplates = this.getDefaultTemplates();
  }

  async init() {
    if (!this.templatesCache) {
      await this.loadTemplates();
    }
  }

  getDefaultTemplates() {
    return [
      {
        id: 'default_standard',
        name: '标准模板',
        description: '标准 Markdown 格式，包含标题、作者、日期和内容',
        isDefault: true,
        isBuiltIn: true,
        template: `# {{title}}

> 作者：{{author}}
> 日期：{{date}}
> 来源：{{url}}

{{#if tableOfContents}}
## 目录

{{tableOfContents}}
{{/if}}

---

{{content}}

---

*本文由 Smart Article Extractor 自动提取*
`,
        variables: ['title', 'author', 'date', 'url', 'tableOfContents', 'content']
      },
      {
        id: 'default_minimal',
        name: '极简模板',
        description: '仅包含标题和内容的简洁格式',
        isDefault: false,
        isBuiltIn: true,
        template: `# {{title}}

{{content}}
`,
        variables: ['title', 'content']
      },
      {
        id: 'default_technical',
        name: '技术文章模板',
        description: '优化的技术文章格式，突出代码块和目录',
        isDefault: false,
        isBuiltIn: true,
        template: `# {{title}}

> **作者**: {{author}}  
> **发布日期**: {{date}}  
> **阅读时间**: {{estimatedReadTime}} 分钟  
> **平台**: {{platform}}

{{#if tableOfContents}}
## 目录

{{tableOfContents}}
{{/if}}

---

{{content}}

---

## 文章元信息

| 项目 | 值 |
|------|-----|
| 总字数 | {{wordCount}} |
| 代码块数 | {{codeBlockCount}} |
| 图片数 | {{imageCount}} |
| 链接数 | {{linkCount}} |
| 内容分类 | {{contentCategory}} |

*提取时间: {{extractTime}}*
`,
        variables: [
          'title', 'author', 'date', 'url', 'platform',
          'estimatedReadTime', 'wordCount', 'codeBlockCount',
          'imageCount', 'linkCount', 'contentCategory',
          'tableOfContents', 'content', 'extractTime'
        ]
      },
      {
        id: 'default_notebook',
        name: '笔记模板',
        description: '适合个人知识管理的笔记格式',
        isDefault: false,
        isBuiltIn: true,
        template: `---
title: {{title}}
author: {{author}}
date: {{date}}
source: {{url}}
tags: [extracted, {{platform}}, {{contentCategory}}]
read_time: {{estimatedReadTime}}
---

# {{title}}

## 笔记要点

> 请在此处添加你的笔记要点...

---

## 原文内容

{{content}}

---

## 我的补充

> 请在此处添加你的理解和补充...

---

*原文链接: {{url}}*
*提取时间: {{extractTime}}*
`,
        variables: [
          'title', 'author', 'date', 'url', 'platform',
          'estimatedReadTime', 'contentCategory',
          'content', 'extractTime'
        ]
      }
    ];
  }

  async loadTemplates() {
    try {
      const result = await this.storage.local.get(this.cacheKey);
      const customTemplates = result[this.cacheKey] || [];
      this.templatesCache = [...this.defaultTemplates, ...customTemplates];
      return this.templatesCache;
    } catch (error) {
      console.error('Failed to load templates:', error);
      this.templatesCache = [...this.defaultTemplates];
      return this.templatesCache;
    }
  }

  async saveCustomTemplates(templates) {
    try {
      const customTemplates = templates.filter(t => !t.isBuiltIn);
      await this.storage.local.set({ [this.cacheKey]: customTemplates });
      this.templatesCache = [...this.defaultTemplates, ...customTemplates];
      return true;
    } catch (error) {
      console.error('Failed to save templates:', error);
      return false;
    }
  }

  async addTemplate(template) {
    await this.init();
    const newTemplate = {
      ...this.getEmptyTemplate(),
      ...template,
      id: this.generateId(),
      isBuiltIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const customTemplates = this.templatesCache.filter(t => !t.isBuiltIn);
    customTemplates.push(newTemplate);
    
    await this.saveCustomTemplates(customTemplates);
    return newTemplate;
  }

  async updateTemplate(id, updates) {
    await this.init();
    const index = this.templatesCache.findIndex(t => t.id === id);
    if (index === -1) {
      throw new Error(`Template with id ${id} not found`);
    }

    if (this.templatesCache[index].isBuiltIn) {
      throw new Error('Cannot modify built-in templates');
    }

    this.templatesCache[index] = {
      ...this.templatesCache[index],
      ...updates,
      updatedAt: Date.now()
    };

    const customTemplates = this.templatesCache.filter(t => !t.isBuiltIn);
    await this.saveCustomTemplates(customTemplates);
    return this.templatesCache[index];
  }

  async deleteTemplate(id) {
    await this.init();
    const template = this.templatesCache.find(t => t.id === id);
    if (!template) {
      return false;
    }

    if (template.isBuiltIn) {
      throw new Error('Cannot delete built-in templates');
    }

    const customTemplates = this.templatesCache.filter(t => !t.isBuiltIn && t.id !== id);
    await this.saveCustomTemplates(customTemplates);
    return true;
  }

  async getTemplate(id) {
    await this.init();
    return this.templatesCache.find(t => t.id === id) || null;
  }

  async getTemplates(options = {}) {
    await this.init();
    let templates = [...this.templatesCache];

    if (options.builtInOnly) {
      templates = templates.filter(t => t.isBuiltIn);
    } else if (options.customOnly) {
      templates = templates.filter(t => !t.isBuiltIn);
    }

    if (options.defaultOnly) {
      templates = templates.filter(t => t.isDefault);
    }

    return templates;
  }

  async getDefaultTemplate() {
    await this.init();
    return this.templatesCache.find(t => t.isDefault) || this.templatesCache[0];
  }

  render(templateId, data) {
    const template = this.templatesCache?.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    return this.renderString(template.template, data);
  }

  renderString(templateString, data) {
    let result = templateString;

    result = this.processConditionals(result, data);

    result = this.processVariables(result, data);

    result = this.processHelpers(result, data);

    return result;
  }

  processConditionals(templateString, data) {
    let result = templateString;

    result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, variable, content) => {
      const value = data[variable];
      if (value !== undefined && value !== null && value !== '' && value !== false && value !== 0) {
        return content;
      }
      return '';
    });

    result = result.replace(/\{\{#unless\s+(\w+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (match, variable, content) => {
      const value = data[variable];
      if (value === undefined || value === null || value === '' || value === false || value === 0) {
        return content;
      }
      return '';
    });

    return result;
  }

  processVariables(templateString, data) {
    let result = templateString;

    result = result.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path);
      if (value === undefined || value === null) {
        return '';
      }
      return String(value);
    });

    return result;
  }

  processHelpers(templateString, data) {
    let result = templateString;

    result = result.replace(/\{\{dateFormat\s+(\w+(?:\.\w+)*)\s+["']([^"']+)["']\}\}/g, (match, path, format) => {
      const value = this.getNestedValue(data, path);
      if (!value) return '';
      return this.formatDate(new Date(value), format);
    });

    result = result.replace(/\{\{uppercase\s+(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path);
      return value ? String(value).toUpperCase() : '';
    });

    result = result.replace(/\{\{lowercase\s+(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path);
      return value ? String(value).toLowerCase() : '';
    });

    result = result.replace(/\{\{trim\s+(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(data, path);
      return value ? String(value).trim() : '';
    });

    result = result.replace(/\{\{pluralize\s+(\w+(?:\.\w+)*)\s+["']([^"']+)["'](?:\s+["']([^"']+)["'])?\}\}/g, (match, path, singular, plural) => {
      const count = parseInt(this.getNestedValue(data, path)) || 0;
      if (count === 1) {
        return singular;
      }
      return plural || singular + 's';
    });

    return result;
  }

  getNestedValue(obj, path) {
    const parts = path.split('.');
    let value = obj;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  formatDate(date, format) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return '';
    }

    const pad = (n) => String(n).padStart(2, '0');

    const replacements = {
      'YYYY': date.getFullYear(),
      'YY': String(date.getFullYear()).slice(-2),
      'MM': pad(date.getMonth() + 1),
      'M': date.getMonth() + 1,
      'DD': pad(date.getDate()),
      'D': date.getDate(),
      'HH': pad(date.getHours()),
      'H': date.getHours(),
      'mm': pad(date.getMinutes()),
      'm': date.getMinutes(),
      'ss': pad(date.getSeconds()),
      's': date.getSeconds()
    };

    let result = format;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(key, 'g'), String(value));
    }

    return result;
  }

  generateId() {
    return 'template_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  getEmptyTemplate() {
    return {
      name: '',
      description: '',
      isDefault: false,
      template: '',
      variables: []
    };
  }

  validateTemplate(templateString) {
    const errors = [];
    const warnings = [];

    const variablePattern = /\{\{(\w+(?:\.\w+)*)\}\}/g;
    const variables = new Set();
    let match;

    while ((match = variablePattern.exec(templateString)) !== null) {
      variables.add(match[1]);
    }

    const ifPattern = /\{\{#if\s+(\w+)\}\}/g;
    const ifVariables = new Set();
    while ((match = ifPattern.exec(templateString)) !== null) {
      ifVariables.add(match[1]);
    }

    const openIfs = (templateString.match(/\{\{#if\s+\w+\}\}/g) || []).length;
    const closeIfs = (templateString.match(/\{\{\/if\}\}/g) || []).length;
    if (openIfs !== closeIfs) {
      errors.push(`Mismatched {{#if}} blocks: ${openIfs} open, ${closeIfs} close`);
    }

    const openUnless = (templateString.match(/\{\{#unless\s+\w+\}\}/g) || []).length;
    const closeUnless = (templateString.match(/\{\{\/unless\}\}/g) || []).length;
    if (openUnless !== closeUnless) {
      errors.push(`Mismatched {{#unless}} blocks: ${openUnless} open, ${closeUnless} close`);
    }

    if (variables.size === 0 && ifVariables.size === 0) {
      warnings.push('Template contains no variables or conditionals');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      variables: Array.from(variables),
      conditionals: Array.from(ifVariables)
    };
  }

  prepareTemplateData(parsedData, options = {}) {
    const metadata = parsedData.metadata || {};
    const now = new Date();

    return {
      title: parsedData.title || '',
      author: parsedData.author || '未知作者',
      date: parsedData.date || now.toISOString(),
      url: parsedData.url || '',
      platform: parsedData.platform || 'generic',

      tableOfContents: parsedData.markdownTOC || '',
      content: options.content || parsedData.htmlContent || '',

      estimatedReadTime: metadata.estimatedReadTime || 0,
      wordCount: metadata.wordCount || 0,
      codeBlockCount: parsedData.codeBlocks?.length || 0,
      imageCount: parsedData.images?.length || 0,
      linkCount: parsedData.links?.length || 0,
      contentCategory: metadata.contentCategory || 'general',

      isTechnicalArticle: metadata.isTechnicalArticle || false,
      isTutorialArticle: metadata.isTutorialArticle || false,
      isNewsArticle: metadata.isNewsArticle || false,

      extractTime: now.toISOString(),

      ...options.additionalData
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TemplateEngine;
}
