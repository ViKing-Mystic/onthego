(async function() {
    // chrome.action.setPopup({
    //     popup: 'files.html'
    // });

    updateFileCount();

    checkUser().then(status => {
        if (status) {
            document.querySelector('.loginbtn').classList.add('hide');
            document.querySelector('.userface').classList.remove('hide');
        }
    });
    
    let elFilesBox = document.querySelector('.files-box');
    let files = await getFileList();
    let time = new Date().getTime();
    for (let i in files) {
        let file = files[i];
        let id = 'file-' + i;
        let temp = document.importNode( document.querySelector('#file-temp').content, true);
        temp.querySelector('.file-item').setAttribute('id', id);
        temp.querySelector('.icon img').setAttribute('src', getFileIcon(getFileExt(file.name)));
        temp.querySelector('.name').textContent = file.show_name;
        temp.querySelector('.size').textContent = getFileSize(file.size);
        if (!file.expired || time >= file.expired) {
            temp.querySelector('.file-item').classList.add('deleted');
            temp.querySelector('.icon img').classList.add('gray');
            temp.querySelector('.download img').classList.add('gray');
            // temp.querySelector('.remove img').classList.add('gray');
            temp.querySelector('.edit img').classList.add('gray');
            temp.querySelector('.download').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            temp.querySelector('.edit').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            // temp.querySelector('.view').addEventListener('click', (e) => {
            //     e.preventDefault();
            //     e.stopPropagation();
            // });
        } else {
            temp.querySelector('.edit').setAttribute('href', getEditUrl(file));
            // temp.querySelector('.view').setAttribute('href', getViewUrl(file));
            temp.querySelector('.download').setAttribute('href', getDownload(file));
            // temp.querySelector('.download').addEventListener('click', () => {
            //     chrome.tabs.create({
            //         url: getDownload(file)
            //     });
            // });
        }
        temp.querySelector('.remove').addEventListener('click', () => {
            removeFile(id);
            document.getElementById(id).remove();
            updateFileCount();
        });
        
        let a = await isEditView(file.task,file);
        if( !a.status){
            temp.querySelector('.edit').classList.add('hide');
            // temp.querySelector('.item_top_edit').classList.add('hide');
            // temp.querySelector('.view').classList.add('hide');
            // temp.querySelector('.item_top_view').classList.add('hide');
            // temp.querySelector('.item_top_down').style.width = '49%';
            // temp.querySelector('.item_top_del').style.width = '49%';
            temp.querySelector('.download').style.width = '49%';
            temp.querySelector('.remove').style.width = '49%';
        }
       
        elFilesBox.appendChild(temp);
    }
    
    const elHours = document.querySelector('.time-hours');
    const elMinutes = document.querySelector('.time-minutes');
    const elSeconds = document.querySelector('.time-seconds');

    
    let intervalId = setInterval(async () => {
        let file = await getFile(0);
       
        if (!file) {
            return;
        }
        let time = timeLeft(file.expired);
        if (!time) {
            elHours.textContent = '0';
            elMinutes.textContent = '0';
            elSeconds.textContent = '0';
            clearInterval(intervalId);
        } else {
            elHours.textContent = time.hours;
            elMinutes.textContent = time.minutes;
            elSeconds.textContent = time.seconds;
        }
    }, 1000);

    setRateUs();
})();

function timeLeft(expireTime) {
    let current = new Date().getTime();
    if (current >= expireTime) {
        return false;
    }
    let _time = (expireTime - current) / 1000;
    let hours = Math.floor(_time / 3600);
    let minutes = Math.floor(_time % 3600 / 60);
    let seconds = Math.round(_time % 3600 % 60);
    return {
        hours: hours,
        minutes: minutes,
        seconds: seconds
    }
}