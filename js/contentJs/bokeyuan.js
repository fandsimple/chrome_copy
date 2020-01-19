// 解析博客园文章内容

function bokeyuan() {
    // 创建导出按钮
    $button = $('<button class="btn btn-success" id="importButton">导出文章</button>');
    $('h1.postTitle').after($button);
}
