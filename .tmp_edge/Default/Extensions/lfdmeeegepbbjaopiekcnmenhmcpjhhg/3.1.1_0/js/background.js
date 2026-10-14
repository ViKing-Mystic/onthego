importScripts('misc.js', 'config.js');

let f, t, itemInfo;
let fileLength = 0;
let successNum = 0;
let filenames = [];
let timeoutId = null;

chrome.action.setPopup({
    popup: 'popup.html'
});



checkUser();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.type) {
        case EVENTS.ADD_FILE:
            timeoutId = null;
            filenames = [];
            fileLength = 0;
            successNum = 0;
            f = request.f;
            t = request.t;
            itemInfo = request.itemInfo;
            let _files = request.files;
            fileLength = _files.length;

            const formData = new FormData()
            for (let i in _files) {
                let _file = _files[i];
                let blob = dataURItoBlob(_file.dataURL);
                let file = new File([blob], _file.name, {
                    type: _file.type
                });
                formData.append('file', file, _file.name);
                fetch(f == 'pdf' ? PDF_UPLOAD_API : OFFICE_UPLOAD_API, {
                    method: 'POST',
                    body: formData
                }).then(res => {
                    if (res.status != 200 || !res.ok) {
                        chrome.runtime.sendMessage({
                            type: EVENTS.ERROR
                        });
                        chrome.notifications.create({
                            type: 'basic',
                            title: chrome.i18n.getMessage('notifications_conversion_failed_title'),
                            message: chrome.i18n.getMessage('notifications_conversion_msg'),
                            iconUrl: '/images/icon.png'
                        }, function(notificationId) {
                            if (chrome.runtime.lastError) {
                                console.error('Notification error:', chrome.runtime.lastError.message);
                            } else {
                                console.log('Notification created with ID:', notificationId);
                            }
                        });
                        return false;
                    }
                    return res.json();
                }).then(async res => {
                    successNum++;
                    let json = res;
                    if (json.status) {
                        chrome.runtime.sendMessage({
                            type: EVENTS.START_CONVERT
                        });
                        let user = await getUser();
                        let userId = user ? user.user_id : 0,
                            taskId = 0;
                        if (['jpg', 'png'].indexOf(f) >= 0) {
                            filenames.push(json.filenames[0]);
                        } else {
                            filenames = json.filenames[0];
                        }

                        if (!timeoutId) {
                            let _progress = 0;
                            timeoutId = setInterval(() => {
                                _progress += Math.floor(Math.random() * 3);
                                if (_progress >= 99) {
                                    _progress = 99;
                                }
                                chrome.runtime.sendMessage({
                                    type: EVENTS.CONVERTING,
                                    progress: _progress
                                });
                            }, 500);
                        }

                        if (successNum == fileLength) {
                            taskId = await taskCreate(f + '-' + t, file, taskId, userId);
                            let fun = "pdf2office";
                            let server = "win1";
                            if (t == "pdf") {
                                fun = "office2pdf";
                                server = "centos1";
                            }
                            await fetch(QUEUE_API, {
                                method: 'post',
                                body: new URLSearchParams({
                                    file: (['jpg', 'png'].indexOf(f) >= 0) ? JSON.stringify(filenames) : filenames,
                                    from: convertExt(f)[0],
                                    to: convertExt(t)[0],
                                    task: taskId,
                                    user: userId,
                                    password: "",
                                    fun: fun,
                                    server: server
                                })
                            });
                            let taskprocess_fun = () => {
                                fetch(TASK_PROCESS_API, {
                                        method: 'post',
                                        body: new URLSearchParams({
                                            id: taskId,
                                            user: userId
                                        })
                                    }).then(res => res.json())
                                    .then(result => {
                                        switch (result.data.status) {
                                            case "-1": {
                                                if (timeoutId) {
                                                    clearInterval(timeoutId);
                                                }
                                                chrome.runtime.sendMessage({
                                                    type: EVENTS.CONVERTING,
                                                    progress: 100
                                                });
                                                chrome.notifications.create({
                                                    type: 'basic',
                                                    title: chrome.i18n.getMessage('notifications_conversion_failed_title'),
                                                    message: chrome.i18n.getMessage('notifications_conversion_msg'),
                                                    iconUrl: '/images/icon.png'
                                                }, function(notificationId) {
                                                    if (chrome.runtime.lastError) {
                                                        console.error('Notification error:', chrome.runtime.lastError.message);
                                                    } else {
                                                        console.log('Notification created with ID:', notificationId);
                                                    }
                                                });
                                                break;
                                            }
                                            case "1":
                                                setTimeout(taskprocess_fun, 1000);
                                                break;
                                            case "2": {
                                                if (timeoutId) {
                                                    clearInterval(timeoutId);
                                                }
                                                chrome.runtime.sendMessage({
                                                    type: EVENTS.CONVERTING,
                                                    progress: 100
                                                });
                                                converted_file = {
                                                    'name': result.data.url,
                                                    'show_name': _file.name.split('.').slice(0, -1).join('.') + "_converted_by_qwerpdf." + getFileExt(result.data.url)
                                                };

                                                converted_file.size = _file.size;
                                                converted_file.from = f;
                                                converted_file.to = t;
                                                converted_file.task = taskId;
                                                converted_file.userId = userId;
                                                converted_file.addTime = new Date().getTime();
                                                converted_file.expired = converted_file.addTime + 1800 * 1000;
                                                

                                                chrome.runtime.sendMessage({
                                                    type: EVENTS.SUCCESS,
                                                    file: converted_file
                                                });

                                                // chrome.action.setPopup({
                                                //     popup: 'files.html'
                                                // });

                                                chrome.notifications.create({
                                                    type: 'basic',
                                                    title: itemInfo.title + chrome.i18n.getMessage('notifications_conversion_complete_title'),
                                                    message: chrome.i18n.getMessage('notifications_conversion_msg'),
                                                    iconUrl: '/images/icon.png'
                                                }, function(notificationId) {
                                                    if (chrome.runtime.lastError) {
                                                        console.error('Notification error:', chrome.runtime.lastError.message);
                                                    } else {
                                                        console.log('Notification created with ID:', notificationId);
                                                    }
                                                });
                                                
                                                insertFile(converted_file);
                                                updateFileCount();
                                                break;
                                            }
                                            default:
                                                setTimeout(taskprocess_fun, 1000);
                                        }
                                    }).catch(e => {
                                        console.log(e);
                                        chrome.notifications.create({
                                            type: 'basic',
                                            title: chrome.i18n.getMessage('notifications_conversion_failed_title'),
                                            message: chrome.i18n.getMessage('notifications_conversion_msg'),
                                            iconUrl: '/images/icon.png'
                                        }, function(notificationId) {
                                            if (chrome.runtime.lastError) {
                                                console.error('Notification error:', chrome.runtime.lastError.message);
                                            } else {
                                                console.log('Notification created with ID:', notificationId);
                                            }
                                        });
                                    });
                                if (timeoutId) {
                                    clearInterval(timeoutId);
                                }
                            }
                            setTimeout(taskprocess_fun, 1000);
                        } else {
                            taskCreate(f + '-' + t, file, taskId, userId);
                        }
                    }
                });
            }
            break;
        case EVENTS.SET_USER_STATUS:
            if (request) {
                delete request.type;
                updateUser(request);
            } else {
                removeUser();
            }
            break;
    }
    return true;
});


chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason == "install") {
        chrome.tabs.create({
            url: INSTALL_URL
        });
    }
});

chrome.runtime.setUninstallURL(UNINSTALL_URL + "?" + utm);


function taskCreate(type, info, taskId, userId) {
    return new Promise(async (resolve, reject) => {

       
                                let server = "p1";
                                if (t == "pdf") {
                                    server = "up1";
                                }
        let res = await fetch(DOMAIN + 'user/taskCreate', {
            method: 'POST',
            body: new URLSearchParams({
                type: type,
                name: info.name,
                size: info.size,
                user_id: userId,
                server:server
            })
        });
        try {
            let json = await res.json();

            fetch(DOMAIN + 'user/taskuid', {
                method: 'post',
                body: new URLSearchParams({
                    task_id: json.data.taskId,
                    uid: taskId ? taskId : json.data.taskId
                })
            }).then(res => {
                resolve(json.data.taskId);
            });
        } catch (e) {
            resolve(0);
        }

    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, message, function(response) {
                if (chrome.runtime.lastError) {
                    sendResponse({ received: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ received: true, response: response });
                }
            });
        } else {
            sendResponse({ received: false, error: 'No active tab found' });
        }
    });

    return true;
});