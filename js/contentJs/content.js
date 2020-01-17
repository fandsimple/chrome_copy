function main() {
    function injectCustomJs(jsPath) {
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

    if (document.URL.indexOf('csdn.net') >= 0) { // csdn
        chrome.storage.sync.get({csdnFlag: 'off'}, function (data) {
            if (data.csdnFlag == 'on') {
                injectCustomJs("js/export/csdn.js"); // 向页面中注入js文件，可以进行回调
                //引入第三方库
                var  turndown = document.createElement('script');
                turndown.setAttribute('type', 'text/javascript');
                turndown.src = 'https://unpkg.com/turndown/dist/turndown.js';
                document.head.appendChild(turndown);

                csdn();
            }
        });
    }
}

main();