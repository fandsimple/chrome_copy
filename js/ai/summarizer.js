(function(window) {
    'use strict';

    const ChineseSummarizer = {
        stopWords: new Set([
            '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
            '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
            '自己', '这', '那', '他', '她', '它', '们', '这个', '那个', '什么', '怎么',
            '为什么', '哪', '哪里', '谁', '多少', '几', '啊', '吧', '呢', '吗', '呀',
            '哦', '嗯', '哈', '唉', '但是', '然而', '不过', '所以', '因此', '于是',
            '因为', '如果', '虽然', '即使', '只要', '只有', '无论', '不管', '而且',
            '并且', '或者', '还是', '以及', '等', '等等', '等等等', '之', '其', '以',
            '于', '而', '与', '及', '或', '但', '如', '若', '虽', '即', '既', '又',
            '也', '还', '再', '又', '更', '最', '太', '非常', '特别', '比较', '相当',
            '已经', '正在', '将要', '曾经', '一直', '总是', '从来', '往往', '常常',
            '有时', '偶尔', '突然', '忽然', '立刻', '马上', '赶紧', '还是', '已经'
        ]),

        punctuation: new Set([
            '。', '！', '？', '，', '；', '：', '、', '「', '」', '『', '』', '（', '）',
            '【', '】', '〔', '〕', '—', '…', '《', '》', '〈', '〉', '．', '〝', '〞'
        ]),

        config: {
            maxSentences: 5,
            minSentenceLength: 10,
            summaryRatio: 0.2,
            titleWeight: 1.5,
            positionWeight: 1.2,
            lengthWeight: 0.8,
            keywordWeight: 2.0
        },

        isChineseChar: function(char) {
            return /[\u4e00-\u9fa5]/.test(char);
        },

        isPunctuation: function(char) {
            return this.punctuation.has(char) || /[,.!?;:，。！？；：、]/.test(char);
        },

        isStopWord: function(word) {
            return this.stopWords.has(word) || word.length <= 1;
        },

        segment: function(text) {
            const words = [];
            let currentWord = '';
            
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                
                if (this.isChineseChar(char)) {
                    if (currentWord && !this.isChineseChar(currentWord[currentWord.length - 1])) {
                        words.push(currentWord.toLowerCase());
                        currentWord = '';
                    }
                    
                    if (i <= text.length - 4) {
                        const fourWord = text.substring(i, i + 4);
                        const wordFreq = this.getWordFrequency(fourWord, text);
                        if (wordFreq >= 2) {
                            words.push(fourWord);
                            i += 3;
                            continue;
                        }
                    }
                    
                    if (i <= text.length - 3) {
                        const threeWord = text.substring(i, i + 3);
                        const wordFreq = this.getWordFrequency(threeWord, text);
                        if (wordFreq >= 2) {
                            words.push(threeWord);
                            i += 2;
                            continue;
                        }
                    }
                    
                    if (i <= text.length - 2) {
                        const twoWord = text.substring(i, i + 2);
                        const wordFreq = this.getWordFrequency(twoWord, text);
                        if (wordFreq >= 2 || this.isCommonWord(twoWord)) {
                            words.push(twoWord);
                            i += 1;
                            continue;
                        }
                    }
                    
                    words.push(char);
                } else if (/[a-zA-Z0-9]/.test(char)) {
                    currentWord += char;
                } else {
                    if (currentWord) {
                        words.push(currentWord.toLowerCase());
                        currentWord = '';
                    }
                }
            }
            
            if (currentWord) {
                words.push(currentWord.toLowerCase());
            }
            
            return words.filter(word => !this.isStopWord(word));
        },

        getWordFrequency: function(word, text) {
            let count = 0;
            let pos = 0;
            while ((pos = text.indexOf(word, pos)) !== -1) {
                count++;
                pos += word.length;
            }
            return count;
        },

        isCommonWord: function(word) {
            const commonWords = [
                '技术', '开发', '程序', '代码', '功能', '系统', '用户', '数据', '设计',
                '实现', '方法', '问题', '解决方案', '平台', '应用', '项目', '学习',
                '知识', '经验', '分享', '总结', '介绍', '使用', '配置', '安装', '部署',
                '测试', '优化', '性能', '安全', '网络', '服务器', '数据库', '接口',
                '文档', '示例', '教程', '指南', '入门', '进阶', '高级', '实战', '案例'
            ];
            return commonWords.includes(word);
        },

        splitSentences: function(text) {
            const sentences = [];
            let currentSentence = '';
            
            const sentenceEnders = /[。！？\n\r]+/;
            
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                
                if (sentenceEnders.test(char)) {
                    if (currentSentence.trim()) {
                        sentences.push(currentSentence.trim() + char);
                    }
                    currentSentence = '';
                } else if (char === '\n' || char === '\r') {
                    if (currentSentence.trim()) {
                        sentences.push(currentSentence.trim());
                    }
                    currentSentence = '';
                } else {
                    currentSentence += char;
                }
            }
            
            if (currentSentence.trim()) {
                sentences.push(currentSentence.trim());
            }
            
            return sentences.filter(s => s.length >= this.config.minSentenceLength);
        },

        calculateWordFrequency: function(words) {
            const freq = {};
            words.forEach(word => {
                freq[word] = (freq[word] || 0) + 1;
            });
            
            const maxFreq = Math.max(...Object.values(freq), 1);
            const tfidf = {};
            Object.keys(freq).forEach(word => {
                tfidf[word] = freq[word] / maxFreq;
            });
            
            return { freq, tfidf };
        },

        extractKeywords: function(text, topN = 10) {
            const words = this.segment(text);
            const { freq, tfidf } = this.calculateWordFrequency(words);
            
            const sortedWords = Object.keys(tfidf)
                .map(word => ({ word, score: tfidf[word], freq: freq[word] }))
                .sort((a, b) => b.score - a.score)
                .slice(0, topN);
            
            return sortedWords;
        },

        scoreSentence: function(sentence, index, totalSentences, keywords, titleWords) {
            let score = 0;
            const words = this.segment(sentence);
            
            const positionScore = 1 - (index / totalSentences);
            score += positionScore * this.config.positionWeight;
            
            const lengthScore = Math.min(sentence.length / 100, 1);
            score += lengthScore * this.config.lengthWeight;
            
            let keywordScore = 0;
            const keywordSet = new Set(keywords.map(k => k.word));
            words.forEach(word => {
                if (keywordSet.has(word)) {
                    const keyword = keywords.find(k => k.word === word);
                    keywordScore += keyword ? keyword.score : 0.1;
                }
            });
            score += keywordScore * this.config.keywordWeight;
            
            if (titleWords && titleWords.length > 0) {
                let titleScore = 0;
                const titleWordSet = new Set(titleWords);
                words.forEach(word => {
                    if (titleWordSet.has(word)) {
                        titleScore += 0.2;
                    }
                });
                score += titleScore * this.config.titleWeight;
            }
            
            if (/^本文|本文主要|本文介绍|本文将|本文总结|综上所述|总之|因此|由此可见/.test(sentence)) {
                score += 0.5;
            }
            
            if (/^第一|第二|第三|首先|其次|最后|另外|此外|还有/.test(sentence)) {
                score += 0.3;
            }
            
            return score;
        },

        summarize: function(text, title = '', options = {}) {
            const config = { ...this.config, ...options };
            
            if (!text || text.trim().length === 0) {
                return {
                    summary: '',
                    keywords: [],
                    originalLength: 0,
                    summaryLength: 0
                };
            }
            
            const sentences = this.splitSentences(text);
            
            if (sentences.length === 0) {
                return {
                    summary: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
                    keywords: [],
                    originalLength: text.length,
                    summaryLength: Math.min(text.length, 200)
                };
            }
            
            const keywords = this.extractKeywords(text, 15);
            const titleWords = title ? this.segment(title) : [];
            
            const scoredSentences = sentences.map((sentence, index) => ({
                sentence,
                index,
                score: this.scoreSentence(sentence, index, sentences.length, keywords, titleWords)
            }));
            
            scoredSentences.sort((a, b) => b.score - a.score);
            
            let numSentences = Math.min(
                config.maxSentences,
                Math.max(2, Math.ceil(sentences.length * config.summaryRatio))
            );
            
            const topSentences = scoredSentences
                .slice(0, numSentences)
                .sort((a, b) => a.index - b.index)
                .map(item => item.sentence);
            
            const summary = topSentences.join('');
            
            return {
                summary: summary,
                keywords: keywords.slice(0, 10),
                originalLength: text.length,
                summaryLength: summary.length,
                compressionRatio: Math.round((1 - summary.length / text.length) * 100)
            };
        },

        smartSimplify: function(text, options = {}) {
            const config = { 
                removeRedundant: true,
                removeDuplicate: true,
                maxLength: options.maxLength || 3000,
                ...options 
            };
            
            if (!text || text.length <= config.maxLength) {
                return text;
            }
            
            let simplified = text;
            
            if (config.removeRedundant) {
                simplified = simplified.replace(/[的地得]话/g, '');
                simplified = simplified.replace(/非常|十分|特别|极其|相当/g, '');
                simplified = simplified.replace(/(然后|接着|于是|因此|所以)[，。]/g, '。');
                simplified = simplified.replace(/(的话|来说|而言|来看)[，。]/g, '。');
            }
            
            if (config.removeDuplicate) {
                const sentences = this.splitSentences(simplified);
                const seen = new Set();
                const uniqueSentences = [];
                
                sentences.forEach(sentence => {
                    const key = sentence.substring(0, Math.min(20, sentence.length));
                    if (!seen.has(key)) {
                        seen.add(key);
                        uniqueSentences.push(sentence);
                    }
                });
                
                simplified = uniqueSentences.join('');
            }
            
            if (simplified.length > config.maxLength) {
                const summaryResult = this.summarize(simplified, '', {
                    maxSentences: Math.ceil(config.maxLength / 50),
                    summaryRatio: 0.5
                });
                simplified = summaryResult.summary;
            }
            
            return simplified;
        },

        cleanContent: function(html) {
            let cleaned = html;
            
            const adPatterns = [
                /<div[^>]*class=["'][^"']*ad[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
                /<div[^>]*id=["'][^"']*ad[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
                /<ins[^>]*class=["'][^"']*adsbygoogle[^"']*["'][^>]*>[\s\S]*?<\/ins>/gi,
                /<iframe[^>]*src=["'][^"']*doubleclick[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi,
                /<iframe[^>]*src=["'][^"']*googleads[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi,
                /<script[^>]*>[\s\S]*?<\/script>/gi,
                /<style[^>]*>[\s\S]*?<\/style>/gi,
                /<noscript[^>]*>[\s\S]*?<\/noscript>/gi,
                /<!--[\s\S]*?-->/gi
            ];
            
            adPatterns.forEach(pattern => {
                cleaned = cleaned.replace(pattern, '');
            });
            
            const recommendPatterns = [
                /<div[^>]*>[\s\S]*?推荐阅读[\s\S]*?<\/div>/gi,
                /<div[^>]*>[\s\S]*?相关文章[\s\S]*?<\/div>/gi,
                /<div[^>]*>[\s\S]*?猜你喜欢[\s\S]*?<\/div>/gi,
                /<div[^>]*>[\s\S]*?热门推荐[\s\S]*?<\/div>/gi,
                /<div[^>]*class=["'][^"']*recommend[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
                /<div[^>]*class=["'][^"']*related[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
                /<div[^>]*class=["'][^"']*sidebar[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
                /<div[^>]*class=["'][^"']*footer[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
                /<div[^>]*class=["'][^"']*comment[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
                /<div[^>]*id=["'][^"']*comment[^"']*["'][^>]*>[\s\S]*?<\/div>/gi
            ];
            
            recommendPatterns.forEach(pattern => {
                cleaned = cleaned.replace(pattern, '');
            });
            
            return cleaned;
        },

        extractMainContent: function($, selectors) {
            let bestContent = '';
            let bestScore = 0;
            
            const contentSelectors = selectors || [
                'div#article_content',
                'div.article-content',
                'div#content',
                'div.content',
                'div.post-content',
                'div.entry-content',
                'div.article-detail',
                'article',
                '.article-body',
                '.post-body',
                '#main-content',
                '.main-content'
            ];
            
            contentSelectors.forEach(selector => {
                const $element = $(selector);
                if ($element.length > 0) {
                    const score = this.calculateContentScore($element);
                    if (score > bestScore) {
                        bestScore = score;
                        bestContent = $element.html() || '';
                    }
                }
            });
            
            if (bestContent) {
                return this.cleanContent(bestContent);
            }
            
            return '';
        },

        calculateContentScore: function($element) {
            let score = 0;
            
            const html = $element.html() || '';
            const text = $element.text() || '';
            
            const textLength = text.length;
            score += Math.min(textLength / 100, 10);
            
            const pCount = $element.find('p').length;
            score += pCount * 0.5;
            
            const codeCount = $element.find('pre, code').length;
            score += codeCount * 0.3;
            
            const imgCount = $element.find('img').length;
            score += imgCount * 0.2;
            
            const linkDensity = $element.find('a').length / Math.max(pCount, 1);
            if (linkDensity > 0.5) {
                score -= 2;
            }
            
            const classAttr = ($element.attr('class') || '').toLowerCase();
            const idAttr = ($element.attr('id') || '').toLowerCase();
            
            const positivePatterns = [
                'article', 'content', 'post', 'entry', 'detail', 'body', 'main'
            ];
            positivePatterns.forEach(pattern => {
                if (classAttr.includes(pattern) || idAttr.includes(pattern)) {
                    score += 1;
                }
            });
            
            const negativePatterns = [
                'ad', 'advertisement', 'sidebar', 'footer', 'header', 'nav',
                'menu', 'comment', 'recommend', 'related', 'popular'
            ];
            negativePatterns.forEach(pattern => {
                if (classAttr.includes(pattern) || idAttr.includes(pattern)) {
                    score -= 2;
                }
            });
            
            return Math.max(0, score);
        }
    };

    window.ChineseSummarizer = ChineseSummarizer;

})(window);
