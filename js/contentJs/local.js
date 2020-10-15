function local() {
    // 创建导出按钮
    $button = $('<div style="height: 100px; width: 200px; position: fixed;top: 100px; right: 10px;"><button class="btn btn-success" id="importButton">导出</button></div>');
    $("body").append($button);


    // // 选择需要观察变动的节点
    // const targetNode = document.getElementsByTagName('body')[0];
    // console.log(targetNode);
    //
    // // 观察器的配置（需要观察什么变动）
    // const config = {attributes: true, childList: true, subtree: true};
    // // const config = {childList: true};
    //
    // // 当观察到变动时执行的回调函数
    // const callback = function (mutationsList, observer) {
    //     console.log($('#result_list > tbody > tr > td.field-sourceName').text(), 1);
    //     if ($('#result_list > tbody > tr > td.field-sourceName').text() == 'nvd_nist') {
    //         injectCustomJs('js/export/local.js');
    //         console.log('注入了');
    //     }
    //     console.log('wo bian le');
    //
    // };
    //
    // // 创建一个观察器实例并传入回调函数
    // const observer = new MutationObserver(callback);
    //
    // // 以上述配置开始观察目标节点
    // observer.observe(targetNode, config);
    //
    // // // 之后，可停止观察
    // // observer.disconnect();
    // debugger;


}

local();