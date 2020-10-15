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

    // 简书
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


