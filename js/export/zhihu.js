function zhihu() {
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
    console.log('zhihu exportArticle');
    var title = '';
    var content = '';
    
    // 知乎专栏
    if (window.location.href.indexOf('zhuanlan.zhihu.com') >= 0) {
        title = '# ' + $('h1.Post-Title').text();
        content = $('div.Post-RichTextContainer').html();
    }
    // 知乎问答
    else if (window.location.href.indexOf('/question/') >= 0) {
        title = '# ' + $('h1.QuestionHeader-title').text();
        content = $('div.QuestionAnswer-content').html();
    }
    // 知乎回答
    else if (window.location.href.indexOf('/answer/') >= 0) {
        title = '# ' + $('h1.QuestionHeader-title').text();
        content = $('div.AnswerItem-content').html();
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