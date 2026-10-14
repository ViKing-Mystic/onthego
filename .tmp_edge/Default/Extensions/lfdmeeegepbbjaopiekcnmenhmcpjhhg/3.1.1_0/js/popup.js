document.addEventListener('DOMContentLoaded', function () {
    const toggleSwitch = document.getElementById('toggleSwitch');
    const statusText = document.getElementById('status');
    const toggleSwitchT = document.getElementById('toggleSwitchT');
    const statusTextT = document.getElementById('statusT');

    chrome.storage.sync.get(['toggleStatus'], function(result) {
        if (result.toggleStatus === 'OFF') {
            toggleSwitch.checked = false;
        } else {
            toggleSwitch.checked = true;
        }
        updateStatusText();
    });

    chrome.storage.sync.get(['toggleStatusT'], function(result) {
        if (result.toggleStatusT === 'OFF') {
            toggleSwitchT.checked = false;
        } else {
            toggleSwitchT.checked = true;
        }
        updateStatusTextT();
    });

    function updateStatusText() {
        const status = toggleSwitch.checked ? 'ON' : 'OFF';
        statusText.textContent =  status;
        sendMessageToBackground({ status: status });
    }

    function updateStatusTextT() {
        const status = toggleSwitchT.checked ? 'ON' : 'OFF';
        statusTextT.textContent =  status;
    }

    

    function updateStatus() {
        const status = toggleSwitch.checked ? 'ON' : 'OFF';
        chrome.storage.sync.set({ toggleStatus: status }, function() {
            // console.log('Toggle status saved as', status);
        });
        updateStatusText();
    }

    function updateStatusT() {
        const status = toggleSwitch.checked ? 'ON' : 'OFF';
        chrome.storage.sync.set({ toggleStatusT: status }, function() {
            // console.log('Toggle status saved as', status);
        });
        updateStatusTextT();
    }


    function sendMessageToBackground(message) {
        chrome.runtime.sendMessage(message, function(response) {
            // console.log('Response from background:', response);
        });
    }

    toggleSwitch.addEventListener('change', updateStatus);
    
    toggleSwitchT.addEventListener('change', updateStatusT);
});