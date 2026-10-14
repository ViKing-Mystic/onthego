function getUrlParam(name) {
    var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
    var r = window.location.search.substr(1).match(reg);
    if (r != null) return decodeURI(r[2]); //unescape(r[2]);
    return null;
}

function convertExt(name) {
    let convertTo = {
        pdf: ['pdf'],
        word: ['docx', 'doc'],
        excel: ['xlsx', 'xls'],
        ppt: ['pptx', 'ppt'],
        jpg: ['jpg', 'jpeg'],
        png: ['png']
    };
    return convertTo[name];
}

function getFileExt(path) {
    let offset = path.lastIndexOf('.') + 1;
    return path.substr(offset).toLowerCase();
}

function getFileIcon(ext) {
    let fileIcon = {
        pdf: './images/pdf.svg',
        doc: './images/word.svg',
        docx: './images/word.svg',
        xls: './images/excel.svg',
        xlsx: './images/excel.svg',
        ppt: './images/ppt.svg',
        pptx: './images/ppt.svg',
        jpg: './images/image.svg',
        jpeg: './images/image.svg',
        png: './images/image.svg'
    };
    return fileIcon[ext] ? fileIcon[ext] : fileIcon['jpg'];
}

function getFileSize(limit) {
    let size = "";
    if (limit < 0.1 * 1024) {
        size = limit.toFixed(2) + " B";
    } else if (limit < 0.1 * 1024 * 1024) {
        size = (limit / 1024).toFixed(2) + " KB";
    } else if (limit < 0.1 * 1024 * 1024 * 1024) {
        size = (limit / (1024 * 1024)).toFixed(2) + " MB";
    } else {
        size = (limit / (1024 * 1024 * 1024)).toFixed(2) + " GB";
    }
    let sizestr = size + "";
    let len = sizestr.indexOf("\.");
    let dec = sizestr.substr(len + 1, 2);
    if (dec == "00") {
        return sizestr.substring(0, len) + sizestr.substr(len + 3, 2);
    }
    return sizestr;
}

function getItemInfo(name) {
    let items = {
        pdfword: {
            title: __('page_pdf_to_word')
        },
        pdfexcel: {
            title: __('page_pdf_to_excel')
        },
        pdfppt: {
            title: __('page_pdf_to_ppt')
        },
        pdfjpg: {
            title: __('page_pdf_to_jpg')
        },
        pdfpng: {
            title: __('page_pdf_to_png')
        },
        wordpdf: {
            title: __('page_word_to_pdf')
        },
        excelpdf: {
            title: __('page_excel_to_pdf')
        },
        pptpdf: {
            title: __('page_ppt_to_pdf')
        },
        jpgpdf: {
            title: __('page_jpg_to_pdf')
        },
        pngpdf: {
            title: __('page_png_to_pdf')
        }
    };
    return items[name]
}

async function getFileList() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get('files', res => {
            if (!res.files) {
                resolve([]);
            }
            return resolve(res.files);
        });
    });
}

function insertFile(file) {
    getFileList().then(items => {
        items.unshift(file);
        chrome.storage.local.set({files: items});
    });
}

async function getFile(idx) {
    return getFileList().then(items => {
        return items[idx];
    });
}

function removeFile(idx) {
    getFileList().then(items => {
        items.splice(idx, 1);
        chrome.storage.local.set({files: items});
    });
}

async function updateFileCount() {
    if (typeof(document) == 'undefined') return;
    let time = new Date().getTime();
    let fileLength = 0;
    let fileList = await getFileList();
    for (let file of fileList) {
        if (time < file.expired) {
            fileLength++;
        }
    }
    let countText = fileLength.toString();
    const fileCount = document.getElementById('file-count');
    if (fileCount) {
        const fileCountSpan = fileCount.querySelector('span');
        fileCountSpan.textContent = fileLength;
        if (fileLength > 0) {
            fileCountSpan.classList.remove('hide');
        }
    }

    chrome.action.setBadgeText({
        text: (fileLength > 0 ? countText : '')
    });
    chrome.action.setBadgeBackgroundColor({
        color: '#ff0000'
    });
    if (chrome.action.setBadgeTextColor) {
        chrome.action.setBadgeTextColor({
            color: 'white'
        });
    }

    chrome.runtime.sendMessage({
        type: 'fileUpdate',
        count: fileLength
    });
}
function radomNumber(){
    let num = '';
    for(var i=0;i<3;i++)
    {
        num+=Math.floor(Math.random()*10);
    }
    return num;
}

function getDownload(file) {
    let downUrl = 'https://qwerpdf.com/pdf/extdownload/f/' + utf8ToBase64(file.name) + '/size/' + file.size + '/from/' + file.from + '/to/' + file.to + '/u/' + file.userId + '/t/' + file.task + '/?' + utm;
    return downUrl;
}

function getEditUrl(file) {
    let editor = 'https://qwerpdf.com/pdf/extfileedit/f/'+ utf8ToBase64(file.name) + '/to/'+ file.to+'/type/edit'+'/?' + utm;
    return editor;
}
function getViewUrl(file) {
    let viewor = 'https://qwerpdf.com/pdf/extfileedit/f/'+ utf8ToBase64(file.name) + '/to/'+ file.to+'/type/view'+'/?' + utm;
    return viewor;
}
function utf8ToBase64(str) {
    return window.btoa(encodeURIComponent(str));
}

function base64ToUtf8(str) {
    return decodeURIComponent(window.atob(str));
}

function dataURItoBlob(dataURI) {
    let byteString = atob(dataURI.split(',')[1]);
    let mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    let ab = new ArrayBuffer(byteString.length);
    let ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], {
        type: mimeString
    });
}

function getNowFormatDate() {
    var date = new Date();
    var seperator1 = "";
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var strDate = date.getDate();
    if (month >= 1 && month <= 9) {
        month = "0" + month;
    }
    if (strDate >= 0 && strDate <= 9) {
        strDate = "0" + strDate;
    }
    var currentdate = year + seperator1 + month + seperator1 + strDate;
    return currentdate;
}

function createUUID() {
    return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function getUser() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get('user', res => resolve(res.user));
    });
}

function updateUser(user) {
    chrome.storage.local.set({user: user})
}

function removeUser() {
    chrome.storage.local.remove('user');
}

function checkUser() {
    return new Promise((resolve, reject) => {
        getUser().then(user => {
            if (user) {
                fetch(DOMAIN + 'ext/checkUser').then(res => {
                    return res.json();
                }).then(user => {
                    if (user.status) {
                        updateUser(user.data);
                        resolve(true);
                    } else {
                        removeUser();
                        resolve(false);
                    }
                });
            } else {
                resolve(false);
            }
        });
    });
}

function setRateUs() {
    let rateus = document.querySelector(".rateus");
    if(!rateus){
        return;
    }
    if (STORE_URL == "") {
        rateus.style.display = "none";
    } else {
        rateus.style.display = "block";
        rateus.querySelector('a').innerHTML = chrome.i18n.getMessage('page_rateus');

        rateus.querySelector('a').href = STORE_URL;
    }
}

function getFileType(file){
    if(file.to == 'word'){
        return 'docx'
    }else if(file.to == 'excel'){
        return 'xlsx'
    }else if(file.to == 'ppt'){
        return 'pptx'
    }
}

function isEditView(task,file) {
    return new Promise(async (resolve, reject) => {
        fetch(DOMAIN + 'user/allowofficeview', {
            method: 'post',
            body: new URLSearchParams({
                taskid: task,
                type:getFileType(file)
            })
        }).then(res => {
            resolve(res.json())
        });

    });
}