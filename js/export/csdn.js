function exportArticle() {
    console.log('csdn exportArticle with AI enhancement');
    
    if (window.ExportManager) {
        window.ExportManager.exportArticle(
            'div.article-title-box h1, h1.title-article',
            [
                'div#article_content',
                'div.article_content',
                '.article-detail-content'
            ],
            'csdn'
        );
    } else {
        var title = '# ' +  $('div.article-title-box h1').text();
        var content = $('div#article_content').html();
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
}

function addExportButton() {
    var $existingButton = $('#importButton');
    if ($existingButton.length > 0) {
        return;
    }
    
    var $button = $('<button>', {
        id: 'importButton',
        class: 'btn btn-success',
        css: {
            marginLeft: '10px',
            padding: '6px 16px',
            fontSize: '14px',
            fontWeight: '500',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
            transition: 'all 0.2s ease'
        },
        text: '📥 导出文章'
    });
    
    $button.hover(
        function() {
            $(this).css({
                transform: 'translateY(-1px)',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
            });
        },
        function() {
            $(this).css({
                transform: 'translateY(0)',
                boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
            });
        }
    );
    
    var $titleBox = $('div.article-title-box');
    if ($titleBox.length > 0) {
        $titleBox.append($button);
    } else {
        var $articleHeader = $('.article-header, .title-box, #articleDetails').first();
        if ($articleHeader.length > 0) {
            $articleHeader.append($button);
        } else {
            $('h1').first().after($button);
        }
    }
}

$(document).ready(function() {
    addExportButton();
    
    var $button = $('#importButton');
    if ($button.length > 0) {
        $button.off('click').on('click', exportArticle);
    }
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    addExportButton();
}
