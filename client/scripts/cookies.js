function setCookie(cname, cvalue, exdays){
    var date = new Date();
    date.setTime(date.getTime() + (exdays*24*60*60*1000));
    var expires = "expires=" + date.toUTCString();
    if(exdays > 0){
        document.cookie = cname + '=' + cvalue + ';' + expires + ';path=/';
    }
    else{
        document.cookie = cname + '=' + cvalue + ';path=/';
    }
}

function getCookie(cname){
    var name = cname + '=';
    var decodedCookies = decodeURIComponent(document.cookie);
    var cookies = decodedCookies.split(';');
    for(var i = 0; i < cookies.length; i++){
        var c = cookies[i];
        while(c.charAt(0) == ' '){
            c = c.substring(1);
        }
        if(c.indexOf(name) == 0){
            return c.substring(name.length, c.length);
        }
    }
    return"";
}