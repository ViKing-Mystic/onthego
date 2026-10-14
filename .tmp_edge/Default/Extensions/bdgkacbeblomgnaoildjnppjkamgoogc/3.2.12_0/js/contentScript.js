//content script doesn't comes under extension, so need to duplicate this code

//cross-platform check using chrome.runtime API
const browserIdentifier = chrome.runtime.getURL("manifest.json") //No I18N
const chromeIndex = browserIdentifier.indexOf("chrome-extension://")
const mozIndex = browserIdentifier.indexOf("moz-extension://")

var BROWSER = ""
if (chromeIndex != -1) {
    BROWSER = chrome
}
else if (mozIndex != -1) {
    BROWSER = browser
}

function escapeHTML(str) {
    if (!str && str !== 0) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

ContentScript = function () {
    this.connectToExtension();
    this.port = null;
};


ContentScript.prototype.connectToExtension = function () {
    this.port = BROWSER.runtime.connect({ name: "bsp-contentScript" });   //No I18N
    BROWSER.runtime.onMessage.addListener(this.onMessageReceived.bind(this));
};

ContentScript.prototype.onMessageReceived = function (message, sendResponse) {
    if ((message.action === "cancelDownload" || message.action === "cancelUpload") && !document.getElementById("BSP-download-restriction-modal")) {
        showDownloadRestrictionModal(message);
    }
    if (window.location.href.indexOf("url_restriction.html") != -1) {
        BROWSER.tabs.getCurrent(function (currentTab) {

            if (!message[currentTab.id]) {
                return;
            }

            var category = ""
            if(message[currentTab.id]?.BlockedCategory) {
                category = message[currentTab.id].BlockedCategory
            }

            if (message[currentTab.id]?.custom_message !== undefined && verifySanity(message[currentTab.id].custom_message)) {
                var curTabMsg = message[currentTab.id].custom_message;

                //domain replacement
                if (message[currentTab.id].domain !== undefined) {
                    curTabMsg = curTabMsg.replace("[domain]", escapeHTML(message[currentTab.id].domain))
                }

                //category replacement
                curTabMsg = curTabMsg.replace("[category]", escapeHTML(category))

                var supportingTags = []

                //href add for help link
                const pattern = /\[(.*?)\]\((.*?)\)/g;

                if (curTabMsg.match(pattern)) {
                    supportingTags.push('a')
                }
                curTabMsg = curTabMsg.replace(pattern, '<a href="$2">$1</a>');

                document.getElementById("blockMessage").innerHTML = curTabMsg;
            }
            else
            {
                var def_message
                if(!message[currentTab.id].ShowOverrideUI)
                {
                    if(category !== "")
                    {
                        def_message = `Access to <b>${escapeHTML(message[currentTab.id].domain)}</b> (<b>Category: ${escapeHTML(category)}</b>) is restricted by your organization. For further assistance, please reach out to your system administrator.`;
                    }
                    else
                    {
                        def_message = `The website <b>${escapeHTML(message[currentTab.id].domain)}</b> is currently blocked by your organization. Please contact your system administrator for further details.`;
                    }
                }
                else
                {
                    def_message = `Your organization has restricted access to <b>${escapeHTML(message[currentTab.id].domain)}</b> due to its classification under (<b>Category: ${escapeHTML(category)}</b>). If you believe this restriction is incorrect, you may use the override option. Your administrator will be notified of this action.`;
                }

                document.getElementById("blockMessage").innerHTML = def_message;
            }

            if (message[currentTab.id].custom_logo !== undefined) {
                document.getElementById("bspimage").src = message[currentTab.id].custom_logo;
            }
            if (message[currentTab.id].custom_mail_id !== undefined) {
                document.getElementById("mailId").textContent = message[currentTab.id].custom_mail_id;
            }
            else {
                var maildiv = document.getElementById("mailbox");
                maildiv?.remove();
            }

            if (message[currentTab.id].ShowOverrideUI === true) {
                var accessReq = document.getElementById("accessReq");
                accessReq.style.display = "inline-flex"

                //show Request box on click
                accessReq.addEventListener("click", function () {
                    accessReq.style.display = "none";

                    var reqForm = document.getElementById("reqForm");
                    if (reqForm) {
                        reqForm.style.display = "inline-flex";
                    }

                    var reqFormBtn = document.getElementById("reqFormBtn");
                    if (reqFormBtn) {
                        reqFormBtn.style.display = "inline-flex";

                        //page open code handle
                        var reason = document.getElementById("reason")
                        var reasonInput
                        var isValidRegex = true

                        reason.addEventListener("input", function(e){
                            reasonInput = reason.value
                            const regex = /^[a-zA-Z0-9\s+?!,()@%.\-:_*\\.=\[\]]+$/;

                            if((!regex.test(reasonInput) && reasonInput !== "") || reasonInput.length >= 250)
                            {
                                reason.style.border = "2px solid red"
                                isValidRegex = false
                            }
                            else
                            {
                                reason.style.border=""
                                isValidRegex = true
                            }
                        })

                        reqFormBtn.addEventListener("click", function (e) {
                            if(isValidRegex)
                            {
                                if (reason.value) {
                                    message[currentTab.id].override_reason = reason.value
                                }
                                BROWSER.runtime.sendMessage({ "Request": "overridepage", overriddenDetails: message[currentTab.id] }) //No I18N
                            }
                        })
                    }
                });

            }
        });
    }
}

function showDownloadRestrictionModal(incomingMessage) {
    var extensionPath = BROWSER.runtime.getURL(""); //No I18N
    
    fetch(extensionPath + "download_restriction.html") //No I18N
        .then(response => response.text())
        .then(html => {
            // Find your modal container and set its innerHTML
            let modal = document.getElementById("BSP-download-restriction-modal");
            if (!modal) {
                // If modal doesn't exist, create and append it
                modal = document.createElement("div");
                modal.id = "BSP-download-restriction-modal";
                modal.style.position = "fixed";
                modal.style.top = "0";
                modal.style.left = "0";
                modal.style.width = "100vw";
                modal.style.height = "100vh";
                modal.style.background = "rgba(0,0,0,0.5)";//No I18N
                modal.style.zIndex = "99999";
                modal.style.display = "flex";
                modal.style.justifyContent = "center";//No I18N
                modal.style.alignItems = "center";//No I18N
            }
            modal.innerHTML = html;
            var messageContainer = modal.querySelector(".bspblockmessage");//No I18N

            var message = incomingMessage.message

            let blockheader = modal.querySelector(".bspblockheader"); //No I18N
            if (blockheader && message.actiontype === "Upload") {
                blockheader.textContent = "Upload Not Allowed"; //No I18N
            }
            if (blockheader && message.actiontype === "Download") {
                blockheader.textContent = "Download Not Allowed"; //No I18N
            }
            //custom Message Population
            if (messageContainer) {
                //custom message

                if (message.custom_message !== undefined && verifySanity(message.custom_message)) {
                   
                    if (message.custom_message.includes("[domain]")) {
                        if (message.domain !== undefined) {
                            message.custom_message = message.custom_message.replace("[domain]", "<b class='bsp-b'>" + escapeHTML(message.domain) + "</b>");
                        } else {
                            message.custom_message = message.custom_message.replace("[domain]", "");
                        }
                    }

                    if (message.custom_message.includes("[filetype]")) {
                        if (message.filetype !== undefined) {
                            message.custom_message = message.custom_message.replace("[filetype]", "<b class='bsp-b'>" + escapeHTML(message.filetype) + "</b>");
                        }
                        else {
                            message.custom_message = message.custom_message.replace("[filetype]", "");
                        }
                    }

                    if (message.custom_message.includes("[filesize]")) {
                        if (message.filesize !== undefined) {
                            message.custom_message = message.custom_message.replace("[filesize]", "<b class='bsp-b'>" + escapeHTML(message.filesize) + "</b>");
                        }
                        else {
                            message.custom_message = message.custom_message.replace("[filesize]", "");
                        }
                    }

                    if (message.custom_message.match(/\[.*?\]\(.*?\)/g)) {
                        message.custom_message = message.custom_message.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
                    }
                    messageContainer.innerHTML = message.custom_message;
                }
                else {
                    let details =
                        (message.domain ? ` from <b class="bsp-b">${escapeHTML(message.domain)}</b>` : "") +
                        (message.filetype ? ` of type <b class="bsp-b">${escapeHTML(message.filetype)}</b>` : "") +
                        (message.filesize ?
                            ((message.domain || message.filetype) ? ` and of size <b class="bsp-b">${escapeHTML(message.filesize)}</b>` : ` of size <b class="bsp-b">${escapeHTML(message.filesize)}</b>`)
                            : "");
                    let msg = `The ${escapeHTML(message.actiontype)} attempted${details} has been blocked by your administrator.`;
                    messageContainer.innerHTML = msg;
                }

                //custom mail id
                if (message.custom_mail_id !== undefined) {
                    var mailId = escapeHTML(message.custom_mail_id);

                    var mailContainer = modal.querySelector(".bsp-admin-contact");//No I18N
                    var mailIDParagraph = modal.querySelector(".bsp-admin-contact-p");//No I18N

                    if (mailIDParagraph && mailContainer) {
                        mailIDParagraph.style.display = "inline";
                        mailContainer.innerHTML = `<a href="mailto:${mailId}">${mailId}</a>`;
                    }
                }

                //custom logo
                if (message.custom_logo !== undefined) {
                    var logo = message.custom_logo;
                    var logoImage = modal.querySelector(".bsp-cus-logo");//No I18N

                    if (logoImage) {
                        logoImage.src = logo;
                    }
                }
            }


            document.body.appendChild(modal);

            //add event listener to close the modal
            var closeButton = modal.querySelector(".bsp-closeBtn");//No I18N
            if (closeButton) {
                closeButton.addEventListener("click", function () {
                    modal.style.display = "none";
                    modal.remove();
                });
            }
        });
}

function verifySanity(message) {
    if (!message || typeof message !== "string") {
        return false;
    }

    // Your whitelist regex
    const regex = /^([a-zA-Z0-9\s\+?!,;%()@.\-:_*\./\\=\[\]\{\#\}$`~\^]|[^\u0020-\u007F])+$/;
    return regex.test(message);
}


contentScript = new ContentScript();

// ─── Relay clickfixDetector.js reports from MAIN world to extension ──────────
// clickfixDetector.js runs in MAIN world (for API interception) and cannot
// access chrome.runtime. It posts reports via window.postMessage which we
// relay here using chrome.runtime.sendMessage.
// This relay is page-reachable and cannot be made otherwise: clickfixDetector.js
// runs in the MAIN world, so it shares the page's JS context and origin. Any
// script on the page can post this exact message, so nothing arriving here is trusted —
// it is validated as hostile input:
//   - only the two telemetry Requests are accepted, nothing else is relayed
//   - the forwarded object is rebuilt from known fields, so no attacker-chosen
//     key survives (notably the action field that background handlers
//     dispatch on)
//   - every string is length-capped and every number type-checked
//   - url is carried as bounded detector context; contentPort.js replaces it
//     with the authenticated sender URL before processing the report
var RELAY_ALLOWED_REQUESTS = { ClickFixDetection: 1, ClickFixCopiedData: 1 };
var RELAY_MAX_THREATS      = 50;
var RELAY_MAX_DETAIL       = 2048;
var RELAY_MAX_PAYLOAD      = 4096;

function relayStr(value, max) {
    if (typeof value !== "string") { return ""; }                            //No I18N
    return value.length > max ? value.substring(0, max) : value;
}

function relayNum(value) {
    return (typeof value === "number" && isFinite(value)) ? value : 0;       //No I18N
}

function relayIsArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]";       //No I18N
}

function relayStrArray(value, maxItems, maxLen) {
    var out = [];
    if (!relayIsArray(value)) { return out; }
    var n = Math.min(value.length, maxItems);
    for (var i = 0; i < n; i++) {
        var item = relayStr(value[i], maxLen);
        if (item) { out.push(item); }
    }
    return out;
}

function relayNumArray(value, maxItems) {
    var out = [];
    if (!relayIsArray(value)) { return out; }
    var n = Math.min(value.length, maxItems);
    for (var i = 0; i < n; i++) {
        if (typeof value[i] === "number" && isFinite(value[i])) { out.push(value[i]); } //No I18N
    }
    return out;
}

function relayScores(value) {
    var out = { clickjacking: 0, pastejacking: 0, clickfix: 0, html_smuggling: 0 };
    if (!value || typeof value !== "object") { return out; }                 //No I18N
    for (var key in out) {
        if (Object.prototype.hasOwnProperty.call(value, key)) { out[key] = relayNum(value[key]); }
    }
    return out;
}

function relayThreat(threat) {
    if (!threat || typeof threat !== "object") { return null; }              //No I18N
    return {
        name:      relayStr(threat.name, 256),
        severity:  relayStr(threat.severity, 32),
        detail:    relayStr(threat.detail, RELAY_MAX_DETAIL),
        element:   relayStr(threat.element, 256),
        timestamp: relayNum(threat.timestamp),
        category:  relayStr(threat.category, 64),
        signalKey: relayStr(threat.signalKey, 64),
        weight:    relayNum(threat.weight),
        tier:      relayStr(threat.tier, 32),
        mitreIds:  relayStrArray(threat.mitreIds, 16, 32),
        ruleIds:   relayNumArray(threat.ruleIds, 32),
        payload:   relayStr(threat.payload, RELAY_MAX_PAYLOAD)
    };
}

function relaySanitizeReport(raw) {
    if (!raw || typeof raw !== "object") { return null; }                    //No I18N
    if (typeof raw.Request !== "string") { return null; }                    //No I18N
    if (!Object.prototype.hasOwnProperty.call(RELAY_ALLOWED_REQUESTS, raw.Request)) { return null; }

    var out = {
        Request:        raw.Request,
        threat_type:    relayStr(raw.threat_type, 64),
        url:            relayStr(raw.url, 2048),
        timestamp:      relayNum(raw.timestamp),
        copied_command: relayStr(raw.copied_command, RELAY_MAX_PAYLOAD)
    };

    if (raw.Request === "ClickFixDetection") {                               //No I18N
        out.severity    = relayStr(raw.severity, 32);
        out.severity_id = relayNum(raw.severity_id);
        out.scores      = relayScores(raw.scores);
        out.threats     = [];
        if (relayIsArray(raw.threats)) {
            var n = Math.min(raw.threats.length, RELAY_MAX_THREATS);
            for (var i = 0; i < n; i++) {
                var t = relayThreat(raw.threats[i]);
                if (t) { out.threats.push(t); }
            }
        }
    }
    return out;
}

window.addEventListener("message", function(event) { //No I18N
    if (event.source !== window) { return; }
    var expectedOrigin = window.location.protocol === "file:" ? "null" : window.location.origin; //No I18N
    if (event.origin !== expectedOrigin) { return; }
    if (!event.data || event.data.source !== "__bsp_clickfix_report__") { return; } //No I18N

    var report = relaySanitizeReport(event.data.report);
    if (!report) { return; }

    try {
        BROWSER.runtime.sendMessage(report);
    } catch (e) {
        // Extension context may be invalidated
    }
}, false);
