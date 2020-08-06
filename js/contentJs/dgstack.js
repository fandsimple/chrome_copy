// 解析简书文章内容

function dgstack() {
    // 创建导出按钮
    // $button = $('<div style="height: 100px; width: 200px; position: fixed;top: 100px; right: 10px;"><button class="btn btn-success" id="importButton">导出文章</button></div>');
    $button = $('<button class="btn btn-success" id="importButton">导出文章</button>');
    $("h1.entry-title").after($button);
}

