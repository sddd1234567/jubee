function addToCollect(product, target) {
    var xmlhttp = new XMLHttpRequest();
    var t = document.getElementById("collect_"+target)
    xmlhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            t.innerText = this.responseText;
            t.removeAttribute("href");
        }
    };
    xmlhttp.open("POST", "addtocollection", true);
    xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xmlhttp.send("title=" + product.title + "&price=" + product.price + "&image=" + encodeURIComponent(product.image) + "&urll=" + encodeURIComponent(product.url) + "&website=" + product.website);
}

function removeFromCollections(key) {

    if (confirm("確定要移除收藏嗎？") == true) 
    {
        var xmlhttp = new XMLHttpRequest();
        var t = document.getElementById(key);
        xmlhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                t.innerHTML = this.responseText;
                t.removeAttribute("href");
            }
        };
        xmlhttp.open("POST", "removefromcollections", true);
        xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xmlhttp.send("key=" + key);
    }
}


function addToAlert(){
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            alert(this.responseText);
            $('#alertme').modal('hide');
        }
    };
    xmlhttp.open("POST", "addtoalert", true);
    xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xmlhttp.send("title=" + alert_title + "&price=" + document.getElementById("alert_price").value + "&url=" + encodeURIComponent(alert_url));
}