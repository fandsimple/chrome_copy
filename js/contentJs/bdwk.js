// 解析百度文库内容

function bdwk() {
    // 创建导出按钮
    $button = $('<div style="height: 100px; width: 200px; position: fixed;top: 100px; right: 10px;"><button class="btn btn-success" id="importButton">导出文章</button></div>');
    $("body").after($button);
}
