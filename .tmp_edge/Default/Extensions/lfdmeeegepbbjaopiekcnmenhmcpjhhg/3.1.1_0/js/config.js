const DOMAIN = 'https://qwerpdf.com/';
const PDF_UPLOAD_API = 'https://p1.qwerpdf.com/api/upload1';
const OFFICE_UPLOAD_API = 'https://up1.qwerpdf.com/extupload';
const QUEUE_API = 'https://qwerpdf.com/queue';
const TASK_PROCESS_API ="https://qwerpdf.com/user/taskProcess";
const utm_source="E-P2WC";
const utm = 'utm_source='+utm_source+'&utm_medium=EXT';
const INSTALL_URL = DOMAIN + 'ext.html?' + utm;
const UNINSTALL_URL = DOMAIN + 'uninstall.html';
const STORE_URL="https://chrome.google.com/webstore/detail/convert-pdf-to-word/ibhimefaglgoiegnacijmmdiocedollm";
//const STORE_URL="https://microsoftedge.microsoft.com/addons/detail/pdgpghmbhknkfcpoiknkekaklppdpenl";
const MAX_UPLOAD_SIZE = {
    pdf: 1000,
    docx: 1000,
    doc: 1000,
    xlsx: 1000,
    xls: 1000,
    pptx: 1000,
    ppt: 1000,
    jpg: 1000,
    jpeg: 1000,
    png: 1000
};
const VIP_MAX_UPLOAD_SIZE = {
    pdf: 1000,
    docx: 1000,
    doc: 1000,
    xlsx: 1000,
    xls: 1000,
    pptx: 1000,
    ppt: 1000,
    jpg: 1000,
    jpeg: 1000,
    png: 1000
};

const EVENTS = {
    ADD_FILE: 'add_file',
    UPLOAD_PROGRESS: 'uploadprogress',
    START_CONVERT: 'start_convert',
    CONVERTING: 'converting',
    SUCCESS: 'success',
    SET_USER_STATUS: 'set_user_status',
    ERROR: 'error'
};
