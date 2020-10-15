function exportArticle() {
    // console.log('baiduwenku exportArticle');
    // // var title = '# ' +  $('h1.article-title').text();
    // var title = '# 待抽取';
    // // var content = $('//div[@id="reader-container"]').html();
    // var content = $('div#reader-container').html();
    // console.log(content);
    // var turndownService = new window.TurndownService();
    // var markdown = turndownService.turndown(content);
    // markdown = title + '\n' + markdown;
    // $textarea_content = $('<textarea name="content" id="" cols="30" rows="10" style="position: absolute;top: 0;left: 0;opacity: 0;z-index: -10;">' + markdown + '</textarea>');
    // $('body').append($textarea_content);
    // $textarea_content.select();
    // var isSuccess = document.execCommand('copy');
    // if(isSuccess){
    //     alert('导出文章到粘贴板成功！！！');
    // }else {
    //     alert('导出文章内容失败，请重试！！！');
    // }
    // console.log(markdown);


    $('html').wordExport('文档下载');




}
document.getElementById("importButton").addEventListener("click", exportArticle);