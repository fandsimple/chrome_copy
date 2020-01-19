// 解析掘金文章内容

function juejin() {
    // 创建导出按钮
    addButton();
}

function addButton() {
    $button = $('<button class="btn btn-success" id="importButton">导出文章</button>');
    $("h1.article-title").after($button);
}
