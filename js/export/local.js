
function inject(jsPath) { // 注入函数
    jsPath = jsPath || 'js/export/csdn.js';
    var temp = document.createElement('script');
    temp.setAttribute('type', 'text/javascript');
    temp.src = 'chrome-extension://acaijkemcnhhcbdmephegfcdbbjajokf/js/export/local1.js';
    // temp.onload = function () {
    //     // 放在页面不好看，执行完后移除掉
    //     this.parentNode.removeChild(this);
    // };
    document.head.appendChild(temp);
}

function exportArticle() {
    console.log('进来了');
    inject("js/export/local1.js");
    console.log('已经注入');

}
document.getElementById("importButton").addEventListener("click", exportArticle);


