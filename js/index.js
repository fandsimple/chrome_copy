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

chrome.storage.sync.get({juejinFlag: 'off'}, function (data) { //juejin
    if (data.juejinFlag == 'on') {
        $('input[name="juejin"]').bootstrapToggle('on');
    } else {
        $('input[name="juejin"]').bootstrapToggle('off');
    }

    // juejin
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
