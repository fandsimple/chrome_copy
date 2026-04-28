var DEFAULT_SETTINGS = {
  autoDetectPlatform: true,
  autoInjectButton: true,
  enableReadingMode: true,
  enableImageOffline: false,
  enableCodeHighlight: true,
  enableTableOfContents: true,
  exportFormat: 'markdown',
  autoSave: false,
  savePath: 'articles/',
  autoRetry: true,
  maxRetries: 3,
  enabledPlatforms: ['csdn', 'juejin', 'cnblogs', 'jianshu', 'zhihu', 'segmentfault', 'generic'],
  customRules: [],
  exportHistory: [],
  batchQueue: [],
  mergeQueue: []
};

var PLATFORM_RULES = {
  csdn: {
    name: 'CSDN',
    patterns: ['blog.csdn.net'],
    titleSelectors: ['h1.title-article', 'div.article-title-box h1', '.title-article'],
    authorSelectors: ['.follow-nickName', '.name', '.user-info a'],
    dateSelectors: ['.time', '.article-info-box .time'],
    contentSelectors: ['#article_content', '#content_views', '.article_content'],
    adSelectors: [
      '.ad', '.adsbygoogle', '.advertisement',
      '#ad_layer', '[class*="ad-"]', '[id*="ad_"]',
      '.recommend-item-box', '.more-toolbox', '.second-recommend-box',
      '.feed-Side-box', '#commentBox', '.comment-box',
      '.template-box', '.blog-tags-box', '.blog-footer-bottom',
      '.csdn-side-toolbar', '.left-toolbox', '#treeSkill'
    ],
    codeSelectors: ['pre', 'code', '.prism-token', '.hljs'],
    tocSelectors: ['h2', 'h3', 'h4', 'h5', 'h6']
  },
  juejin: {
    name: '掘金',
    patterns: ['juejin.cn', 'juejin.im'],
    titleSelectors: ['h1.article-title', '.title', '.article-title'],
    authorSelectors: ['.username', '.author-name', '.user-info .name'],
    dateSelectors: ['.time', '.meta-item .text'],
    contentSelectors: ['.article-content', '.markdown-body', '#article-root'],
    adSelectors: [
      '.ad', '.advertisement', '.recommend-list',
      '.sidebar-block', '.global-component-box',
      '.author-info-block', '.comment-list',
      '.article-suspended-panel', '#comment-box'
    ],
    codeSelectors: ['pre', 'code', '.prism', '.hljs', '.token'],
    tocSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  },
  cnblogs: {
    name: '博客园',
    patterns: ['cnblogs.com'],
    titleSelectors: ['#cb_post_title_url', '.postTitle a', '.postTitle'],
    authorSelectors: ['.postDesc a', '#post-date + a', '#BlogPost1_author'],
    dateSelectors: ['#post-date', '.postDesc'],
    contentSelectors: ['#cnblogs_post_body', '.postBody', '#topics'],
    adSelectors: [
      '.ad_text', '#ad_text_under_commentbox',
      '.cnblogs_code', '.commentform',
      '#google_ads', '.blog_comment_body',
      '#comment_form_container', '.under_post_kb',
      '.under_post_news'
    ],
    codeSelectors: ['pre', 'code', '.cnblogs_code', '.hljs'],
    tocSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  },
  jianshu: {
    name: '简书',
    patterns: ['jianshu.com'],
    titleSelectors: ['h1.title', '.article-title', '._1RuRku'],
    authorSelectors: ['.author .name', '.follow-detail .name', '._2gP-m8'],
    dateSelectors: ['.publish-time', '.time', '._3U4Smb'],
    contentSelectors: ['.article', '._2rhmJa', '#__next'],
    adSelectors: [
      '.recommend-collection', '.note-bottom-ad',
      '.sidebar', '._1PqU57', '.comment-list',
      '._3VQjf_', '.mobile-ad'
    ],
    codeSelectors: ['pre', 'code', '.hljs', '.prism'],
    tocSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  },
  zhihu: {
    name: '知乎',
    patterns: ['zhihu.com'],
    titleSelectors: ['h1.QuestionHeader-title', '.Post-Title', '.RichContent-title'],
    authorSelectors: ['.AuthorInfo-name', '.UserLink-link', '.author-link'],
    dateSelectors: ['.ContentItem-time', '.publish-time'],
    contentSelectors: ['.RichContent-inner', '.Post-RichText', '.QuestionAnswer-content'],
    adSelectors: [
      '.Pc-word-card', '.AdblockBanner',
      '.Recommendations-Main', '.CommentsV2',
      '.Question-sideColumn', '.Reward',
      '.CornerButton', '.Comments-container'
    ],
    codeSelectors: ['pre', 'code', '.highlight', '.codeblock'],
    tocSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  },
  segmentfault: {
    name: '思否',
    patterns: ['segmentfault.com'],
    titleSelectors: ['h1.article__title', '.question__title', '.h1'],
    authorSelectors: ['.user__name', '.author-name', '.user-info a'],
    dateSelectors: ['.article__creation-time', '.time'],
    contentSelectors: ['.article__content', '.question-content', '.answer'],
    adSelectors: [
      '.widget-box', '.sidebar-widget',
      '.comment-list', '.comments',
      '.relevant-articles', '#sideAd'
    ],
    codeSelectors: ['pre', 'code', '.prettyprint', '.hljs'],
    tocSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  },
  generic: {
    name: '通用站点',
    patterns: [],
    titleSelectors: ['h1', 'title', '.title', '.article-title', '.post-title'],
    authorSelectors: ['.author', '.byline', '.meta-author', '[itemprop="author"]'],
    dateSelectors: ['.date', '.time', '.published', '[itemprop="datePublished"]'],
    contentSelectors: [
      'article', '.article-content', '.post-content',
      '.entry-content', '#content', '.main-content',
      '[role="main"]', 'body'
    ],
    adSelectors: [
      '.ad', '.ads', '.advertisement',
      '[class*="ad-"]', '[id*="ad_"]',
      '.sidebar', '.widget', '.widget-area',
      '.social-share', '.share-buttons',
      '.comments', '#comments', '.comment-area',
      '.related-posts', '.related-articles',
      '.nav-links', '.post-navigation',
      '.footer-widgets', '#footer'
    ],
    codeSelectors: ['pre', 'code', '.code', '.code-block'],
    tocSelectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  }
};

var STORAGE_KEYS = {
  SETTINGS: 'smart_extractor_settings',
  HISTORY: 'smart_extractor_history',
  CUSTOM_RULES: 'smart_extractor_custom_rules',
  BATCH_QUEUE: 'smart_extractor_batch_queue',
  TEMPLATES: 'smart_extractor_templates'
};

var MESSAGES = {
  PARSE_ARTICLE: 'PARSE_ARTICLE',
  EXPORT_MARKDOWN: 'EXPORT_MARKDOWN',
  EXPORT_PDF: 'EXPORT_PDF',
  EXPORT_HTML: 'EXPORT_HTML',
  EXPORT_TXT: 'EXPORT_TXT',
  SAVE_FILE: 'SAVE_FILE',
  COPY_TO_CLIPBOARD: 'COPY_TO_CLIPBOARD',
  GET_SETTINGS: 'GET_SETTINGS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  DETECT_PLATFORM: 'DETECT_PLATFORM',
  ENABLE_READING_MODE: 'ENABLE_READING_MODE',
  ADD_TO_BATCH: 'ADD_TO_BATCH',
  PROCESS_BATCH: 'PROCESS_BATCH',
  GET_HISTORY: 'GET_HISTORY',
  CLEAR_HISTORY: 'CLEAR_HISTORY',
  GET_PAGE_INFO: 'GET_PAGE_INFO',
  GET_BATCH_STATUS: 'GET_BATCH_STATUS',
  APPLY_CUSTOM_RULE: 'APPLY_CUSTOM_RULE',
  SCHEDULE_PARSE: 'SCHEDULE_PARSE',
  CANCEL_SCHEDULE: 'CANCEL_SCHEDULE',
  GET_SCHEDULED: 'GET_SCHEDULED'
};

var EXPORT_FORMATS = {
  MARKDOWN: 'markdown',
  PDF: 'pdf',
  HTML: 'html',
  TXT: 'txt'
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    PLATFORM_RULES: PLATFORM_RULES,
    STORAGE_KEYS: STORAGE_KEYS,
    MESSAGES: MESSAGES,
    EXPORT_FORMATS: EXPORT_FORMATS
  };
}
