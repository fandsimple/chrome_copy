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
    }
}

function injectCustomJs(jsPath) { // 注入函数
    jsPath = jsPath || 'js/export/csdn.js';
    var temp = document.createElement('script');
    temp.setAttribute('type', 'text/javascript');
    temp.src = chrome.extension.getURL(jsPath);
    temp.onload = function () {
        // 放在页面不好看，执行完后移除掉
        this.parentNode.removeChild(this);
    };
    document.head.appendChild(temp);
}

function importLib() { // 引入三方库
    injectCustomJs('js/baseJs/jquery-2.2.1.js'); // jquery
    injectCustomJs('js/baseJs/turndown.js'); // html to markdown
}


window.onload = main(); // 入口函数