

function __(msg){
  return chrome.i18n.getMessage(msg);
}

function localizeHtmlPage() {
  // Localize using __MSG_***__ data tags
  let data = document.querySelectorAll('[data-localize]');

  for (let i in data) if (data.hasOwnProperty(i)) {
    let obj = data[i];
    obj.innerHTML=obj.innerHTML.replace(/__MSG_(\w+)__/g, function (match, v1) {
      return v1 ? chrome.i18n.getMessage(v1) : '';
    });
  }
}




function localizeLink() {
  let lang=getCurrentSiteLangPath();
  let data = document.querySelectorAll('[link-localize]');
   

  for (let i in data) if (data.hasOwnProperty(i)) {
    let obj = data[i];
    let href = obj.getAttribute('href').toString();
    let msg = href.replace(/__LANG__/g, lang);
 msg+="?"+utm;
    if (msg != href) obj.href = msg;
  }
}

function localizeCss() {

  let fileName = '_locales/' + getCurrentTopLang() + '/style.css';
  chrome.runtime.getPackageDirectoryEntry(function (storageRootEntry) {
    fileExists(storageRootEntry, fileName, function (isExist) {
      if (isExist) {
        includeCssFile(fileName);
      } else {
        fileName = '_locales/' + getCurrentTopLang() + '/style.css';
        chrome.runtime.getPackageDirectoryEntry(function (storageRootEntry) {
          fileExists(storageRootEntry, fileName, function (isExist) {
            if (isExist) {
              includeCssFile(fileName);
            }
          });
        });
      }
    });
  });
}

function includeCssFile(filePath) {
  var head = document.getElementsByTagName('head')[0];
  var link = document.createElement('link');
  link.href = filePath;
  link.rel = 'stylesheet';
  link.type = 'text/css';
  head.appendChild(link);
}




function fileExists(storageRootEntry, fileName, callback) {
  storageRootEntry.getFile(fileName, {
    create: false
  }, function () {
    callback(true);
  }, function () {
    callback(false);
  });
}

function getCurrentTopLang() {
  return chrome.i18n.getUILanguage().split('-')[0];
}

function getCurrentSiteLangPath() {
  const supportLangList = [ "en", "es", "fr", "de", "it", "pt","zh-cn"];
  let lang = chrome.i18n.getUILanguage().toLowerCase();
  switch (lang) {
    case "zh-tw":
    case "zh-hk": lang = "zh-ft"; break;
    case "zh-cn": break;

    default: lang = getCurrentTopLang();
  }
  if (!supportLangList.includes(lang)) {
    lang = "en";
  }
  return lang== "en"?"":lang+"/";
}


localizeHtmlPage();
localizeCss();
localizeLink();