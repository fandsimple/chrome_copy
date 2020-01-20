function exportArticle() {
    console.log('jianshu exportArticle');
    var title = '# ' +  $('h1._1RuRku').text();
    var content = $('article._2rhmJa').html();

    // 将图片链接进行替换
    var newContent = $(content);
    var imgList = newContent.find('img');
    var oldImgUrl = '';
    var newImgUrl = '';
    for(var i=0; i<imgList.length; i++){
        oldImgUrl = imgList[i].src.replace('https:', '');
        newImgUrl = 'https:' + oldImgUrl.split('?')[0];
        content = content.replace(oldImgUrl, newImgUrl);
    }

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