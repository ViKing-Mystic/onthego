window.addEventListener('message', function (e) {
    if (e.origin != 'https://qwerpdf.com' && e.origin != 'https://www.qwerpdf.com') {
        return false;
    }

    if (localStorage.getItem('__debug')) {
        console.log('Content script receiving: ');
        console.log(e);
    }

    chrome.runtime.sendMessage(e.data, (res) => {
        if (chrome.runtime.lastError) {
            
        }

        if (localStorage.getItem('__debug')) {
            console.log('Content script sending: ');
            console.log(sender);
        }
    });
});


document.addEventListener('DOMContentLoaded', function() {
    const floatingButton = document.createElement('div');
    floatingButton.id = 'floating-button';
    floatingButton.innerHTML = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8CAYAAAA6/NlyAAAABHNCSVQICAgIfAhkiAAACQ5JREFUaIHtm3uMHVUdxz9n5u7de/fu7vSZBbalpcUWG5CXFB84EKxVIMYHWIaogbaG1BCpIoaSABEBKUIxUg1Kgg9C4lTQWINGRHmMIgEiWFqkICtFaHdpu21nd+/27t475/jHubt7996Z+9zbbRO/yWTvnN9jft855/zOb87MwjEK37FjvmOLWu1qNpgu+I79BWAtsByYWST+A/AmcJ/lej3l/BxLhE8AFgMfAlYD749Q3Qp82XK9wTBhKGHfsZcCZwOdgGo42soIgIcs1xut1sB37IuAHwMnhoj3Ax+2XO/NYsEkwr5jLwd+CJxTU7iNYxjotlzvUFE8HpAEbrRc78/FRr5jp4A/AueF+NwPLLNcb19ho1FgvA54niNPFiANyMIG37FPAT4GfBB4wnfsx33HXlSoY7leGlgBvBHicw7gFjcaeefnA/dPSej1o3h6fbLofCXQ4zv2pDgt1xsBLo/weaHv2Ct9x77Ed+zfw0QPP9xotE3ABRHt63zHVr5jrxprsFzvn8AvI/QfBx4DLgYwfMdeCcybwkCnCisryC8qOr+5gv5vQPfw1+uNqFnwHTsOtJVROd9yvdWFDfn1999lbHoAYsDJkSpKTl6UhNBHIaScfB6mE+arnC5cFhmTxgcAb+zEd+zT0UO3q4zN+BwOX2eV1GlESBCB/ju8F7X3ZciNTugYKi8PwJAw+C5q3yswOhziK5isKxSo8csXxnFmBcK3Fp1LdOeVw0uUU1L9r5Ha/AzmgkU6FiFAKoJdPRx+4B7Urm0YS86h/Y4fobJZMAwdspLket5gZKtL8OwjiM7jETO6SN1+PyLVAYbuUWHGGPnrX8jcux7RcZxgcpb20XNuI/AUkCoKb5bv2N+0XG8TgOV6233H7gY2AN8OobNjrPIyQoQauX5EKoVIJpH+IYI970IsRmzZaaRu3oTK9GuSLXFEa4Jg93+RB/sRbSlaTjuT9pvuouXTX0Wl94MwEO0diLY25Hu9yN7dBH27UQf7EWacPKHk2KUt17vdcr1LLdd7EbgjIsLv+Y59coHNiOV6twJzgUeKdF8Y+xFNGMYHWWbLz0lfvoT0nTeCDDBmz8FcdiHIAAA5OED6vFMYWvsRBtdcQtC7G4DkV9Yj5Iie5wrIZklvuJKhq5eTvtpm9OFN0DaLPNmFYSFYrncn8FyIyAD+7jv23CL9/ZbrrULP85fzzW6hUUUIMwYz5iB3voAaGdGNsZaJWScELAJhLUQdeo/hb31JN8fjmCvWQm4kzCvE4oUNUcUD6NJxW0j7XKDPd+xLiwWW6223XO8sy/WE5XpPjLVXIKwZGd0nEjv/KhLX34NItqGG0wQ7ngKzyFwIaE0hdz6NGhzQtvNPQuWy2ldLC6mNv6D9gRdJ/eRpzHMvKkxua/K1cQks15OW650B/DREbACP+o6903fsa33Hnu87dnsUo6p6OPE5h9RNdxM/+1xUeojhzRsRRguRT5cKaG3VPwd8hGFOXLDreIzjT8A8rhvR3qEzuEYn8J1ycViutxY4FbgPeBs4UCBeCvwA2Al8P8pHpVQOwOizTyF7dyN9n9zfHoMDeyAxY7JSAMgANdhH7LPXI+KacPDSM9ASBwTksgx97XLUoT49nJUeEQW4zndsz3K9rWVIvwqsB9b7jt0BLMvzyAB7Ldd7pxyXCoR1D2b/8Ty5rd9FdCzSAbbNgOzkeSnigCmIXXAFbdfcoO1efQW54xGMUz4/MRiUAAyQIr9ElYyS3/qOvcpyveJMW4L8UvN8Jb1ClCc8tma2xBGdiyHROVmer5IMawYdT2RACERcJ6LcWz0cvmU1Yu7yiYpKGPnD1EtaNH7lO/aDwDeidi7qRTTh1nnIvX2IRBKVHgSjSNUwYHQEeWA/ZLOakFIE/iGyzz1D1t0IHd35giWH7NujM7sMosrJYqwFrvId+1H0urodOIjOEGEOFNAC9JfbORG+Y78OLAmVDu1DZQcQHfMg1loqD3Io/y0K1idQASLZBckZE8RkgBrsBSURnd1QkMSagMss1/t1lLD8kG6fi2AOkdnYjCFmFT97hOgaJsLqjpZPLcrui1WRpSsFWC2Bo2ODtDJhGcBoeryMnFbEEhBP0MjNK084fQDRORvz41ciEsnCR7kjDyGQ7+4i9+RmxOzTS5NolYh+PBzoo+Xi1STXXItIltt8OLLIOasZvuEKIFlX8gtfDLMZzFNt2q7ZcFSRBYgtWkLq7i2oPc/WZR9KWA3sIvHFdQ0F1kyYC08mtmI9ZDM124b38OG9GPMWNBpXU2Ge8VEYGajZLnwOS3RVVNi0rw/Vv6/KKklhLj1N/wxyBP95vVIpWRHmgvdBrCBcM1b4pFU1yqS6oows8sW+qCLw4mwuqLacbDrqy+2VIIpOWhP6gaEuKO1uim5YcwgXwjQx5y9u+mWqRWMT6xhE83tYKdRIpoEhqfOBiCemZFg3n7AMkO/0gFnnHM7nv5IsXSeq96DGXotUUU+XZOnQrZzqIEL8NYCqCYtEEqyZ1By4MBAdMxtch9X4dlOjqJ5wh4XosGq/gmFgdJ1Qu12T8P8sHQV1eBiVGUZMU8UkOhudFhrVEx4eQh3cj5qiuVQTFJjt1pElPH5ldXTUxPWitqTV2th+UkOodx0vQvWE460QD9mbPsZQNWG5txdGGykR64eSEmN2F6It9G1qTag+aWVHoaGauAFIOWXbxJGERdFcFaaJisWYljlsyNIbXeeNDycc08uQ6JyorIyubo7Ml8QhUJQQVIOHwIiH65dBOOG2k8i98Rrx47on2hp5AGgUIZfNPflo6evbKmCEuRNWN5m7VuvXpEchRv70O+Tb2/RGXinK9ooBlLISBrTNY2jtJ8j9a1s+aUzzoSRqaIDMlp+Rue0ziFmLStloDEcJQA/pLcBZpZI4Sgakr71AfwFgnci0zWEAKZHvvYzoXIaYZ0dpZch/YhgF4Tt2a14xGuMP/9OMyrX0Q5brXVnWRf6L8tvKuhFCX2y6j8rYUElhzMst6I84j2Wsslyvt5KSAWC5Huh/lniwyUE1A4PAp6r5zAlCUrjv2POB6wAb/XVc7S9wjgzeBh62XO+hWoz+Byl2IE7XtKN4AAAAAElFTkSuQmCC" alt="Icon">';
    floatingButton.style.display='none';
    document.body.appendChild(floatingButton);

    const ifrDiv = document.createElement('div');
    ifrDiv.id = '_ifr_box'
    const iframe = document.createElement('iframe');
    iframe.id='_ifr_bs'
    const colseE = document.createElement('div');
    colseE.id='_close_ifr';
    colseE.innerHTML = '<svg t="1718159341469" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6250" width="30" height="30"><path d="M579.88 512l190-190A48 48 0 0 0 702 254l-190 190-190-190a48 48 0 0 0-68 68l190 190-190 190a48 48 0 1 0 68 68l190-190 190 190a48 48 0 0 0 68-68z" p-id="6251" fill="#fff"></path></svg>';
    iframe.src = chrome.runtime.getURL('index.html');
    iframe.width = '800';
    iframe.height = '500';
    iframe.style.border = 'none';
    ifrDiv.appendChild(colseE);
    ifrDiv.appendChild(iframe);
    document.body.appendChild(ifrDiv);



    floatingButton.addEventListener('click',function(){
        ifrDiv.classList.add('_s_visble');
        setTimeout(function(){
            colseE.style.display = 'block';
        },300)

    })
    colseE.addEventListener('click',function(){
        floatingButton.style.display = 'flex';
        ifrDiv.classList.remove('_s_visble');
        colseE.style.display = 'none';
    })

    chrome.runtime.onMessage.addListener(request => {
       if(request.status == 'ON'){
            floatingButton.style.display = 'flex';
       }

       if(request.status == 'OFF'){
            floatingButton.style.display = 'none';
       }
    });

    chrome.storage.sync.get(['toggleStatus'], function(result) {
        const status = result.toggleStatus || 'ON';
        if(status == 'ON'){
            floatingButton.style.display = 'flex';
       }

       if(status == 'OFF'){
            floatingButton.style.display = 'none';
       }
    });

    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
        if (message.type === 'fileUpdate') {
            let fileLength = message.count;
    
            if(fileLength != 0){
                var file_span = document.querySelector(".file_span");
                if(file_span){
                    file_span.innerHTML = fileLength;
                }else{
                    var fileNumber = document.createElement('span');
                    fileNumber.innerHTML = fileLength;
                    fileNumber.classList.add('file_span');
                    floatingButton.appendChild(fileNumber);
                }
            }else{
                var file_span = document.querySelector(".file_span");
                if(file_span){
                    file_span.remove();
                }
            }
        }
    });
})