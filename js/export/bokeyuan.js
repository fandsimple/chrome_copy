function exportArticle() {
    console.log('bokeyuan exportArticle');
    var title = '# ' +  $('a#cb_post_title_url').text();
    var content = $('div#topics').html();
    var turndownService = new window.TurndownService();
    var markdown = turndownService.turndown(content);
    // markdown = title + '\n' + markdown;
    $textarea_content = $('<textarea name="content" id="" cols="30" rows="10" style="position: absolute;top: 0;left: 0;opacity: 0;z-index: -10;">' + markdown + '</textarea>');
    $('body').append($textarea_content);
    $textarea_content.select();
    var isSuccess = document.execCommand('copy');
    if(isSuccess){
        confirm('导出文章到粘贴板成功！！！');
    }else {
        confirm('导出文章内容失败，请重试！！！');
    }
    console.log(markdown);


}
document.getElementById("importButton").addEventListener("click", exportArticle);