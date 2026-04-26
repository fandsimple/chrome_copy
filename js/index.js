// 初始化配置
chrome.storage.sync.get({csdnFlag: 'off'}, function (data) { //csdn
    if (data.csdnFlag == 'on') {
        $('input[name="csdn"]').bootstrapToggle('on');
    } else {
        $('input[name="csdn"]').bootstrapToggle('off');
    }

    // csdn
    $('input[name="csdn"]').change(function () {
        chrome.storage.sync.get({csdnFlag: 'off'}, function (data) {
            if (data.csdnFlag == 'on') {
                chrome.storage.sync.set({csdnFlag: 'off'}, function () {
                });
            } else {
                chrome.storage.sync.set({csdnFlag: 'on'}, function () {
                });
            }
        });
    });
});

chrome.storage.sync.get({juejinFlag: 'off'}, function (data) { //掘金
    if (data.juejinFlag == 'on') {
        $('input[name="juejin"]').bootstrapToggle('on');
    } else {
        $('input[name="juejin"]').bootstrapToggle('off');
    }

    // 掘金
    $('input[name="juejin"]').change(function () {
        chrome.storage.sync.get({juejinFlag: 'off'}, function (data) {
            if (data.juejinFlag == 'on') {
                chrome.storage.sync.set({juejinFlag: 'off'}, function () {
                });
            } else {
                chrome.storage.sync.set({juejinFlag: 'on'}, function () {
                });
            }
        });
    });

});

chrome.storage.sync.get({bokeyuanFlag: 'off'}, function (data) { //博客园
    if (data.bokeyuanFlag == 'on') {
        $('input[name="bokeyuan"]').bootstrapToggle('on');
    } else {
        $('input[name="bokeyuan"]').bootstrapToggle('off');
    }

    // 博客园
    $('input[name="bokeyuan"]').change(function () {
        chrome.storage.sync.get({bokeyuanFlag: 'off'}, function (data) {
            if (data.bokeyuanFlag == 'on') {
                chrome.storage.sync.set({bokeyuanFlag: 'off'}, function () {
                });
            } else {
                chrome.storage.sync.set({bokeyuanFlag: 'on'}, function () {
                });
            }
        });
    });

});

chrome.storage.sync.get({jianshuFlag: 'off'}, function (data) { //简书
    if (data.jianshuFlag == 'on') {
        $('input[name="jianshu"]').bootstrapToggle('on');
    } else {
        $('input[name="jianshu"]').bootstrapToggle('off');
    }

    // 简书
    $('input[name="jianshu"]').change(function () {
        chrome.storage.sync.get({jianshuFlag: 'off'}, function (data) {
            if (data.jianshuFlag == 'on') {
                chrome.storage.sync.set({jianshuFlag: 'off'}, function () {
                });
            } else {
                chrome.storage.sync.set({jianshuFlag: 'on'}, function () {
                });
            }
        });
    });

});


chrome.storage.sync.get({dgstackFlag: 'off'}, function (data) { //简书
    if (data.dgstackFlag == 'on') {
        $('input[name="dgstack"]').bootstrapToggle('on');
    } else {
        $('input[name="dgstack"]').bootstrapToggle('off');
    }

    // 简书
    $('input[name="dgstack"]').change(function () {
        chrome.storage.sync.get({dgstackFlag: 'off'}, function (data) {
            if (data.dgstackFlag == 'on') {
                chrome.storage.sync.set({dgstackFlag: 'off'}, function () {
                });
            } else {
                chrome.storage.sync.set({dgstackFlag: 'on'}, function () {
                });
            }
        });
    });

});


chrome.storage.sync.get({bdwkFlag: 'off'}, function (data) { //百度文库
    if (data.bdwkFlag == 'on') {
        $('input[name="bdwk"]').bootstrapToggle('on');
    } else {
        $('input[name="bdwk"]').bootstrapToggle('off');
    }

    // 百度文库
    $('input[name="bdwk"]').change(function () {
        chrome.storage.sync.get({bdwkFlag: 'off'}, function (data) {
            if (data.bdwkFlag == 'on') {
                chrome.storage.sync.set({bdwkFlag: 'off'}, function () {
                });
            } else {
                chrome.storage.sync.set({bdwkFlag: 'on'}, function () {
                });
            }
        });
    });

});

chrome.storage.sync.get({zhihuFlag: 'off'}, function (data) { //知乎
    if (data.zhihuFlag == 'on') {
        $('input[name="zhihu"]').bootstrapToggle('on');
    } else {
        $('input[name="zhihu"]').bootstrapToggle('off');
    }

    // 知乎
    $('input[name="zhihu"]').change(function () {
        chrome.storage.sync.get({zhihuFlag: 'off'}, function (data) {
            if (data.zhihuFlag == 'on') {
                chrome.storage.sync.set({zhihuFlag: 'off'}, function () {
                });
            } else {
                chrome.storage.sync.set({zhihuFlag: 'on'}, function () {
                });
            }
        });
    });

});

chrome.storage.sync.get({oschinaFlag: 'off'}, function (data) { //开源中国
    if (data.oschinaFlag == 'on') {
        $('input[name="oschina"]').bootstrapToggle('on');
    } else {
        $('input[name="oschina"]').bootstrapToggle('off');
    }

    // 开源中国
    $('input[name="oschina"]').change(function () {
        chrome.storage.sync.get({oschinaFlag: 'off'}, function (data) {
            if (data.oschinaFlag == 'on') {
                chrome.storage.sync.set({oschinaFlag: 'off'}, function () {
                });
            } else {
                chrome.storage.sync.set({oschinaFlag: 'on'}, function () {
                });
            }
        });
    });

});

// 预览功能
$(document).ready(function() {
    // 预览按钮点击事件
    $('#previewButton').click(function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'previewArticle'}, function(response) {
                if (response && response.markdown) {
                    $('#previewContent').text(response.markdown);
                    $('#previewModal').show();
                } else {
                    alert('无法获取文章内容，请确保当前页面是支持的文章页面。');
                }
            });
        });
    });

    // 关闭预览模态框
    $('.close, #closePreview').click(function() {
        $('#previewModal').hide();
    });

    // 点击模态框外部关闭
    $(window).click(function(event) {
        if (event.target == $('#previewModal')[0]) {
            $('#previewModal').hide();
        }
    });

    // 下载 .md 文件
    $('#downloadMd').click(function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'downloadMarkdown'}, function(response) {
                if (response && response.success) {
                    alert('下载 .md 文件成功！');
                    $('#previewModal').hide();
                } else {
                    alert('下载 .md 文件失败，请重试。');
                }
            });
        });
    });

    // 导出按钮点击事件
    $('#exportButton').click(function() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'exportArticle'}, function(response) {
                if (response && response.success) {
                    alert('导出文章成功！');
                } else {
                    alert('导出文章失败，请重试。');
                }
            });
        });
    });
});


