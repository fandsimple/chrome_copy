function oschina() {
    var btn = document.createElement('button');
    btn.id = 'importButton';
    btn.className = 'btn btn-primary';
    btn.style.position = 'fixed';
    btn.style.top = '100px';
    btn.style.right = '20px';
    btn.style.zIndex = '9999';
    btn.style.padding = '10px 15px';
    btn.style.backgroundColor = '#007bff';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '4px';
    btn.style.cursor = 'pointer';
    btn.innerHTML = '导出文章';
    document.body.appendChild(btn);
}

function exportArticle() {
    console.log('oschina exportArticle');
    var title = '# ' + $('.article-header h1').text();
    var content = $('.article-content').html();
    var turndownService = new window.TurndownService();
    var markdown = turndownService.turndown(content);
    markdown = title + '\n' + markdown;
    $textarea_content = $('<textarea name="content" id="" cols="30" rows="10" style="position: absolute;top: 0;left: 0;opacity: 0;z-index: -10;">' + markdown + '</textarea>');
    $('body').append($textarea_content);
    $textarea_content.select();
    var isSuccess = document.execCommand('copy');
    if(isSuccess){
        alert('导出文章到粘贴板成功！！！');
    }else {
        alert('导出文章内容失败，请重试！！！');
    }
    console.log(markdown);
}
document.getElementById("importButton").addEventListener("click", exportArticle);