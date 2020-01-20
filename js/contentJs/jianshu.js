// 解析简书文章内容

function jianshu() {
    // 创建导出按钮
    addButton();
}

function addButton() {
    $button = $('<button class="btn btn-success" id="importButton">导出文章</button>');
    $("h1._1RuRku").after($button);
}
