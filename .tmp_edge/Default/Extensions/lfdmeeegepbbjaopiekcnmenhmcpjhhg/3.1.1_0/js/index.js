(function () {
    updateFileCount();
    checkUser().then(status => {
        if (status) {
            document.querySelector('.loginbtn').classList.add('hide');
            document.querySelector('.userface').classList.remove('hide');
        }
    });

    setRateUs();
})();