function main() {
    if (document.URL.indexOf('csdn.net') >= 0) { // csdn
        chrome.storage.sync.get({csdnFlag: 'off'}, function (data) {
            if (data.csdnFlag == 'on') {
                csdn();
            }
        });
    }
}
main();