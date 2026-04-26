function main() {
    //引入第三方库
    importLib();

    if (document.URL.indexOf('csdn.net') >= 0) { // csdn
        chrome.storage.sync.get({csdnFlag: 'off'}, function (data) {
            if (data.csdnFlag == 'on') {
                injectCustomJs("js/export/csdn.js"); // 向页面中注入js文件，可以进行回调
                csdn();
            }
        });
    } else if (document.URL.indexOf('juejin.im') >= 0) { // 掘金
        chrome.storage.sync.get({juejinFlag: 'off'}, function (data) {
            if (data.juejinFlag == 'on') {
                injectCustomJs("js/export/juejin.js"); // 向页面中注入js文件，可以进行回调
                juejin();
            }
        });
    } else if (document.URL.indexOf('cnblogs.com') >= 0) { // 博客园
        chrome.storage.sync.get({bokeyuanFlag: 'off'}, function (data) {
            if (data.bokeyuanFlag == 'on') {
                injectCustomJs("js/export/bokeyuan.js"); // 向页面中注入js文件，可以进行回调
                bokeyuan();
            }
        });
    } else if (document.URL.indexOf('jianshu.com') >= 0) { // 简书
        chrome.storage.sync.get({jianshuFlag: 'off'}, function (data) {
            if (data.jianshuFlag == 'on') {
                injectCustomJs("js/export/jianshu.js"); // 向页面中注入js文件，可以进行回调
                jianshu();
            }
        });
    } else if (document.URL.indexOf('dgstack.cn') >= 0) { // 简书
        chrome.storage.sync.get({dgstackFlag: 'off'}, function (data) {
            if (data.dgstackFlag == 'on') {
                injectCustomJs("js/export/dgstack.js"); // 向页面中注入js文件，可以进行回调
                dgstack();
            }
        });
    } else if (document.URL.indexOf('wenku.baidu.com') >= 0) { // 百度文库
        chrome.storage.sync.get({bdwkFlag: 'off'}, function (data) {
            if (data.bdwkFlag == 'on') {
                injectCustomJs("js/export/bdwk.js"); // 向页面中注入js文件，可以进行回调
                bdwk();
            }
        });
    } else if (document.URL.indexOf('zhihu.com') >= 0) { // 知乎
        chrome.storage.sync.get({zhihuFlag: 'off'}, function (data) {
            if (data.zhihuFlag == 'on') {
                injectCustomJs("js/export/zhihu.js"); // 向页面中注入js文件，可以进行回调
                zhihu();
            }
        });
    } else if (document.URL.indexOf('oschina.net') >= 0) { // 开源中国
        chrome.storage.sync.get({oschinaFlag: 'off'}, function (data) {
            if (data.oschinaFlag == 'on') {
                injectCustomJs("js/export/oschina.js"); // 向页面中注入js文件，可以进行回调
                oschina();
            }
        });
    } else if (document.URL.indexOf('127.0.0.1:8000/') >= 0) { // 测试

        injectCustomJs("js/export/local.js"); // 向页面中注入js文件，可以进行回调

    }
}

function injectCustomJs(jsPath) { // 注入函数
    jsPath = jsPath || 'js/export/csdn.js';
    var temp = document.createElement('script');
    temp.setAttribute('type', 'text/javascript');
    temp.src = chrome.extension.getURL(jsPath);
    console.log(temp.src, '路径');
    // temp.onload = function () {
    //     // 放在页面不好看，执行完后移除掉
    //     this.parentNode.removeChild(this);
    // };
    document.head.appendChild(temp);
}

function importLib() { // 引入三方库
    injectCustomJs('js/baseJs/jquery-2.2.1.js'); // jquery
    injectCustomJs('js/baseJs/turndown.js'); // html to markdown
    injectCustomJs('js/baseJs/FileSaver.js'); // html to word
    injectCustomJs('js/baseJs/jquery.wordexport.js'); // html to word
}

window.onload = main(); // 入口函数

// 消息监听器
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'previewArticle') {
        // 获取当前页面的文章内容并转换为 Markdown
        var markdown = getArticleMarkdown();
        sendResponse({markdown: markdown});
    } else if (request.action === 'exportArticle') {
        // 执行导出操作
        exportArticle();
        sendResponse({success: true});
    } else if (request.action === 'downloadMarkdown') {
        // 下载 .md 文件
        downloadMarkdownFile();
        sendResponse({success: true});
    }
});

// 获取文章 Markdown 内容
function getArticleMarkdown() {
    var title = '';
    var content = '';
    
    if (document.URL.indexOf('csdn.net') >= 0) {
        title = '# ' + $('div.article-title-box h1').text();
        content = $('div#article_content').html();
    } else if (document.URL.indexOf('juejin.im') >= 0) {
        title = '# ' + $('.article-title').text();
        content = $('.article-content').html();
    } else if (document.URL.indexOf('cnblogs.com') >= 0) {
        title = '# ' + $('.postTitle').text();
        content = $('.postBody').html();
    } else if (document.URL.indexOf('jianshu.com') >= 0) {
        title = '# ' + $('.title').text();
        content = $('.show-content').html();
    } else if (document.URL.indexOf('dgstack.cn') >= 0) {
        title = '# ' + $('.article-header h1').text();
        content = $('.article-content').html();
    } else if (document.URL.indexOf('wenku.baidu.com') >= 0) {
        title = '# ' + $('.doc-title').text();
        content = $('.reader-page-content').html();
    } else if (document.URL.indexOf('zhihu.com') >= 0) {
        if (document.URL.indexOf('zhuanlan.zhihu.com') >= 0) {
            title = '# ' + $('h1.Post-Title').text();
            content = $('div.Post-RichTextContainer').html();
        } else if (document.URL.indexOf('/question/') >= 0) {
            title = '# ' + $('h1.QuestionHeader-title').text();
            content = $('div.QuestionAnswer-content').html();
        } else if (document.URL.indexOf('/answer/') >= 0) {
            title = '# ' + $('h1.QuestionHeader-title').text();
            content = $('div.AnswerItem-content').html();
        }
    } else if (document.URL.indexOf('oschina.net') >= 0) {
        title = '# ' + $('.article-header h1').text();
        content = $('.article-content').html();
    }
    
    var turndownService = new window.TurndownService();
    var markdown = turndownService.turndown(content);
    return title + '\n' + markdown;
}

// 下载 .md 文件
function downloadMarkdownFile() {
    var markdown = getArticleMarkdown();
    var blob = new Blob([markdown], {type: 'text/markdown;charset=utf-8;'});
    saveAs(blob, 'article.md');
}