class CustomRulesManager {
  constructor(storage = null) {
    this.storage = storage || chrome.storage;
    this.rulesCache = null;
    this.cacheKey = 'custom_rules';
  }

  async init() {
    if (!this.rulesCache) {
      await this.loadRules();
    }
  }

  async loadRules() {
    try {
      const result = await this.storage.local.get(this.cacheKey);
      this.rulesCache = result[this.cacheKey] || [];
      return this.rulesCache;
    } catch (error) {
      console.error('Failed to load custom rules:', error);
      this.rulesCache = [];
      return [];
    }
  }

  async saveRules(rules) {
    try {
      this.rulesCache = rules;
      await this.storage.local.set({ [this.cacheKey]: rules });
      return true;
    } catch (error) {
      console.error('Failed to save custom rules:', error);
      return false;
    }
  }

  async addRule(rule) {
    await this.init();
    const newRule = {
      ...this.getDefaultRule(),
      ...rule,
      id: this.generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      enabled: true
    };

    this.rulesCache.push(newRule);
    await this.saveRules(this.rulesCache);
    return newRule;
  }

  async updateRule(id, updates) {
    await this.init();
    const index = this.rulesCache.findIndex(r => r.id === id);
    if (index === -1) {
      throw new Error(`Rule with id ${id} not found`);
    }

    this.rulesCache[index] = {
      ...this.rulesCache[index],
      ...updates,
      updatedAt: Date.now()
    };

    await this.saveRules(this.rulesCache);
    return this.rulesCache[index];
  }

  async deleteRule(id) {
    await this.init();
    const index = this.rulesCache.findIndex(r => r.id === id);
    if (index === -1) {
      return false;
    }

    this.rulesCache.splice(index, 1);
    await this.saveRules(this.rulesCache);
    return true;
  }

  async getRule(id) {
    await this.init();
    return this.rulesCache.find(r => r.id === id) || null;
  }

  async getRules(options = {}) {
    await this.init();
    let rules = [...this.rulesCache];

    if (options.enabledOnly) {
      rules = rules.filter(r => r.enabled);
    }

    if (options.platform) {
      rules = rules.filter(r => r.platform === options.platform || r.platform === 'generic');
    }

    if (options.url) {
      rules = rules.filter(r => this.matchesUrl(r, options.url));
    }

    return rules.sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }

  async matchRuleForUrl(url) {
    await this.init();
    const rules = await this.getRules({ enabledOnly: true });
    
    for (const rule of rules) {
      if (this.matchesUrl(rule, url)) {
        return rule;
      }
    }
    
    return null;
  }

  matchesUrl(rule, url) {
    if (!rule.urlPatterns || rule.urlPatterns.length === 0) {
      return false;
    }

    for (const pattern of rule.urlPatterns) {
      if (this.matchPattern(url, pattern)) {
        return true;
      }
    }

    return false;
  }

  matchPattern(url, pattern) {
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(url);
    }

    return url.includes(pattern);
  }

  getDefaultRule() {
    return {
      name: '',
      description: '',
      platform: 'generic',
      urlPatterns: [],
      priority: 10,
      selectors: {
        titleSelectors: ['h1', '.title', '.article-title'],
        authorSelectors: ['.author', '.byline'],
        dateSelectors: ['.date', '.time'],
        contentSelectors: ['article', '.article-content', '.post-content'],
        adSelectors: ['.ad', '.ads', '.advertisement']
      },
      options: {
        enableAdFiltering: true,
        enableTOC: true,
        preserveCodeHighlight: true,
        normalizeLinks: true
      }
    };
  }

  generateId() {
    return 'rule_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  async exportRules(ruleIds = null) {
    await this.init();
    let rulesToExport = this.rulesCache;

    if (ruleIds) {
      rulesToExport = this.rulesCache.filter(r => ruleIds.includes(r.id));
    }

    return JSON.stringify(rulesToExport, null, 2);
  }

  async importRules(rulesJson, merge = false) {
    try {
      const importedRules = JSON.parse(rulesJson);
      
      if (!Array.isArray(importedRules)) {
        throw new Error('Invalid rules format: expected array');
      }

      await this.init();

      if (merge) {
        const existingIds = new Set(this.rulesCache.map(r => r.id));
        const newRules = importedRules.filter(r => !existingIds.has(r.id));
        this.rulesCache = [...this.rulesCache, ...newRules];
      } else {
        this.rulesCache = importedRules;
      }

      await this.saveRules(this.rulesCache);
      return {
        success: true,
        imported: importedRules.length,
        merged: merge
      };
    } catch (error) {
      console.error('Failed to import rules:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  validateRule(rule) {
    const errors = [];

    if (!rule.name || rule.name.trim() === '') {
      errors.push('Rule name is required');
    }

    if (!rule.urlPatterns || rule.urlPatterns.length === 0) {
      errors.push('At least one URL pattern is required');
    }

    if (rule.selectors) {
      if (!rule.selectors.contentSelectors || rule.selectors.contentSelectors.length === 0) {
        errors.push('Content selectors are required');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CustomRulesManager;
}
