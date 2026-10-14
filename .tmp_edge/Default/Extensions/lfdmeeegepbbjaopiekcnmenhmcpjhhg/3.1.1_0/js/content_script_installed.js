addExtFlagToSite();

function addExtFlagToSite(){
    let div = document.createElement('div');
    div.setAttribute('id', 'qwerpdf-extension-installed');
    div.setAttribute('version',chrome.runtime.getManifest().version);
    document.body.appendChild(div);
}

