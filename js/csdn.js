// 解析csdn文章内容

function csdn() {
    // 创建导出按钮
    $button = $('<button class="btn btn-success" onclick="exportArticle()">导出文章</button>');
    $('div.article-title-box').append($button);



    function injectCustomJs(jsPath) {
    jsPath = './inject.js';
    var temp = document.createElement('script');
    temp.setAttribute('type', 'text/javascript');
    // 获得的地址类似：chrome-extension://ihcokhadfjfchaeagdoclpnjdiokfakg/js/inject.js
    temp.src = chrome.extension.getURL(jsPath);
    temp.onload = function()
    {
        // 放在页面不好看，执行完后移除掉
        this.parentNode.removeChild(this);
    };
    document.head.appendChild(temp);
}
injectCustomJs();
}
