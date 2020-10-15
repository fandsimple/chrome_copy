function cnnvd() {
    // 创建导出按钮

    // 创建导出按钮
    $info = $('<iframe style="height: 500px; width: 500px; position: fixed;top: 100px; right: 10px;z-index: 9999" src="chrome-extension://acaijkemcnhhcbdmephegfcdbbjajokf/html/test.html" frameborder="0" id="fanding"></iframe>');

    $("body").append($info);

    function fun() {
        console.log('我要获取了');
        // console.log($('body').html());
        // console.log($('html').html());
        // doc = document.getElementById('16027769507660.42796596572037293').contentWindow.document;
        // var name = doc.getElementById('content').innerHTML;
        // console.log(name);
        // // $(window.frames[0].document).find(".styleClass");
        // // doc.getElementById('inputWarning1').value = doc.getElementById('content').innerHTML;
        //
        //
        // var $context = $('#fanding').contents();    // 通过ID选择器获取iframe元素，是可以获取iframe中的元素的
        //
        //     // #document
        // $context.find('input#inputSuccess1').val(name);


    }
    fun();

    // document.getElementById("get").addEventListener("click", fun);


}

cnnvd();