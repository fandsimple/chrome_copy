function main() {
    importLib();

    var platform = detectPlatform();
    console.log('Detected platform:', platform);

    switch (platform) {
        case 'csdn':
            chrome.storage.sync.get({csdnFlag: 'off'}, function (data) {
                if (data.csdnFlag == 'on') {
                    injectCustomJs("js/export/export-manager.js");
                    injectCustomJs("js/ai/summarizer.js");
                    injectCustomJs("js/utils/content-enhancer.js");
                    injectCustomJs("js/export/csdn.js");
                    csdn();
                }
            });
            break;
            
        case 'juejin':
            chrome.storage.sync.get({juejinFlag: 'off'}, function (data) {
                if (data.juejinFlag == 'on') {
                    injectCustomJs("js/export/export-manager.js");
                    injectCustomJs("js/ai/summarizer.js");
                    injectCustomJs("js/utils/content-enhancer.js");
                    injectCustomJs("js/export/juejin.js");
                    juejin();
                }
            });
            break;
            
        case 'cnblogs':
            chrome.storage.sync.get({bokeyuanFlag: 'off'}, function (data) {
                if (data.bokeyuanFlag == 'on') {
                    injectCustomJs("js/export/export-manager.js");
                    injectCustomJs("js/ai/summarizer.js");
                    injectCustomJs("js/utils/content-enhancer.js");
                    injectCustomJs("js/export/bokeyuan.js");
                    bokeyuan();
                }
            });
            break;
            
        case 'jianshu':
            chrome.storage.sync.get({jianshuFlag: 'off'}, function (data) {
                if (data.jianshuFlag == 'on') {
                    injectCustomJs("js/export/export-manager.js");
                    injectCustomJs("js/ai/summarizer.js");
                    injectCustomJs("js/utils/content-enhancer.js");
                    injectCustomJs("js/export/jianshu.js");
                    jianshu();
                }
            });
            break;
            
        case 'dgstack':
            chrome.storage.sync.get({dgstackFlag: 'off'}, function (data) {
                if (data.dgstackFlag == 'on') {
                    injectCustomJs("js/export/export-manager.js");
                    injectCustomJs("js/ai/summarizer.js");
                    injectCustomJs("js/utils/content-enhancer.js");
                    injectCustomJs("js/export/dgstack.js");
                    dgstack();
                }
            });
            break;
            
        case 'bdwk':
            chrome.storage.sync.get({bdwkFlag: 'off'}, function (data) {
                if (data.bdwkFlag == 'on') {
                    injectCustomJs("js/export/export-manager.js");
                    injectCustomJs("js/ai/summarizer.js");
                    injectCustomJs("js/utils/content-enhancer.js");
                    injectCustomJs("js/export/bdwk.js");
                    bdwk();
                }
            });
            break;
            
        case 'local':
            injectCustomJs("js/export/export-manager.js");
            injectCustomJs("js/ai/summarizer.js");
            injectCustomJs("js/utils/content-enhancer.js");
            injectCustomJs("js/export/local.js");
            break;
            
        default:
            console.log('Platform not supported or flag is off');
    }
}

function detectPlatform() {
    var url = document.URL;
    
    if (url.indexOf('csdn.net') >= 0) return 'csdn';
    if (url.indexOf('juejin.im') >= 0 || url.indexOf('juejin.cn') >= 0) return 'juejin';
    if (url.indexOf('cnblogs.com') >= 0) return 'cnblogs';
    if (url.indexOf('jianshu.com') >= 0) return 'jianshu';
    if (url.indexOf('dgstack.cn') >= 0) return 'dgstack';
    if (url.indexOf('wenku.baidu.com') >= 0) return 'bdwk';
    if (url.indexOf('127.0.0.1:8000/') >= 0) return 'local';
    
    return 'unknown';
}

function injectCustomJs(jsPath) {
    jsPath = jsPath || 'js/export/csdn.js';
    var temp = document.createElement('script');
    temp.setAttribute('type', 'text/javascript');
    temp.src = chrome.extension.getURL(jsPath);
    console.log(temp.src, '路径');
    document.head.appendChild(temp);
}

function importLib() {
    injectCustomJs('js/baseJs/jquery-2.2.1.js');
    injectCustomJs('js/baseJs/turndown.js');
    injectCustomJs('js/baseJs/FileSaver.js');
    injectCustomJs('js/baseJs/jquery.wordexport.js');
}

window.onload = main();
