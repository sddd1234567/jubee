var express = require('express');
var session = require('express-session');
var app = express();
app.use(session({ secret: 'mysupersecret', resave: false, saveUninitialized: false }));
var bodyParser = require('body-parser');
var port = Number(process.env.PORT || '3000');
var cookieParser = require('cookie-parser');
var engine = require('ejs-locals');
var path = require('path');
const puppeteer = require('puppeteer');
var wildcard = require('node-wildcard');
var fireAuth = require("./service/fireAuth");
// var fireData = require("./service/fireData");

var resemble = require('./public/js/resemble.js');
var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
// const compareImages = require('resemblejs/compareImages');
app.engine('ejs', engine);
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, '/public')));
app.set('view engine', 'ejs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());




var admin = require("firebase-admin");
var serviceAccount = require("./jubeecompare-firebase-adminsdk-f9u14-50866585c5.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://jubeecompare.firebaseio.com"
});

var hotProducts;
var hotKeywords;
var discounts;

var compareBrowser;

var productBrowser;

async function initialBrowser()
{
    compareBrowser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
}

async function compareImage(image1,image2){
    if(!compareBrowser)
        await initialBrowser();
    const page = await compareBrowser.newPage();
    await page.goto('http://localhost:3000/c?image1=' + encodeURIComponent(image1) + "&image2=" + encodeURIComponent(image2));
    await page.waitFor('#content');
    const result = await page.evaluate(() => {
        let title = document.querySelector('#content').innerText;

        return title;
    });
    // console.log(result);
    return result;
}


admin.database().ref('hotProducts').on('value', function (snapshot) {
    var productList = snapshot.val();
    var products = new Array();
    if(productList != null && Object.keys(productList).length > 2)
    {
        for(index in productList)
        {
            products.push(productList[index]);
        }

        products = products.sort(function (a, b) {
            return b.clickTimes - a.clickTimes;
        });        
    }
    hotProducts = products;
})

admin.database().ref('hotKeywords').on('value', function (snapshot) {
    var productList = snapshot.val();
    var products = new Array();
    if (productList != null) {
        for (index in productList) {
            products.push(productList[index]);
        }
        if (Object.keys(productList).length > 2)
        {
            products = products.sort(function (a, b) {
                return b.searchTimes - a.searchTimes;
            });
        }
        
    }
    hotKeywords = products;
})

admin.database().ref('PChome').on('value',function(snapshot){
    var products = snapshot.val();
    var newDiscounts = [];
    for(index in products)
    {
        var newObject = new Array();
        for(i in products[index])
        {
            newObject.push(products[index][i]);
        }
        newObject = newObject.sort(function (a, b) {
            return a.price.replace(',',"") - b.price.replace(",","");
        });
        
         var count = newObject.length;
         var middle = Math.ceil((count)/2);
         if(count == 1)
            middle = 0;
        //  console.log(newObject[middle].price);
         var discountRate = Math.ceil((1 - parseFloat(newObject[0].price.replace(',',"")) / parseFloat(newObject[middle].price.replace(',',""))) * 100);
        if(discountRate > 0)
            newDiscounts.push({ product: newObject[0], discountRate: discountRate });
    }
    newDiscounts = newDiscounts.sort(function (a, b) {
        return b.discountRate - a.discountRate;
    });
    discounts = newDiscounts;
})

app.get('/c',function(req,res){
    res.render('c');
})

app.get('/', function (req, res) {
    var auth = req.session.uid;
    var username = auth ? req.session.mail : '訪客';
    
    res.render('index', { title: "啾比比價網--首頁", username: username, keywords: hotKeywords, discounts: discounts});
});

app.get('/search', async function (req, res) {
    var productList;
    var auth = req.session.uid;
    var username = auth ? req.session.mail : '訪客';
    
    var myURL = req.originalUrl.split('?');
    
    var filter_minPrice = 0;
    var filter_maxPrice = 99999999999999999;
    var filter_website;
    if (!req.query.friday && !req.query.pchome && !req.query.myfone && !req.query.momo)
        filter_website = { Friday: true, PChome24h: true, myfone: true, Momo: true };
    else
        filter_website = { Friday: req.query.friday, PChome24h: req.query.pchome, myfone: req.query.myfone, Momo: req.query.momo };
    var filter_keywords = "";
    if(req.query.filter_keyword)
        filter_keywords = req.query.filter_keyword;
    filter_keywords = filter_keywords.split(',');
    if(req.query.min_price)
        filter_minPrice = req.query.min_price;
    if(req.query.max_price)
        filter_maxPrice = req.query.max_price;

    if (req.query.keyword != undefined && req.query.keyword != "")
    {
        var title = req.query.keyword;
        updateHotKeywords(title);
        admin.database().ref('PChome').once('value').then(function (snapshot) {
            var result = snapshot.val();
            let products = new Array();
            for (var r in result) {
                var keywords = title.split(' ');
                var flag = false;
                for (var key in keywords) {
                    if (!(wildcard((result[r][0].title).toLowerCase(), '*' + keywords[key].toLowerCase() + '*'))) {
                        flag = true;
                    }                    
                }
                if(req.query.filter_keyword)
                {
                    for (var filter in filter_keywords) {
                        if (wildcard((result[r][0].title).toLowerCase(), '*' + filter_keywords[filter].toLowerCase() + '*')) {
                            flag = true;
                        }
                    }
                }                
                if (!flag)
                {
                    var count = 0;
                    var minPrice = 9999999999999;
                    var maxPrice = 0;
                    for(var i in result[r])
                    {

                        if ((wildcard((result[r][i].title).toLowerCase(), '*' + keywords[key].toLowerCase() + '*')) && checkWebsiteFilter(result[r][i].website, filter_website) && parseInt(result[r][i].price.replace(',', "")) >= filter_minPrice && parseInt(result[r][i].price.replace(',', "")) <= filter_maxPrice) 
                        {
                            var price = result[r][i].price.replace(',',"");
                            if (parseInt(price) > maxPrice)
                                maxPrice = parseInt(price);
                            if (parseInt(price) < minPrice)
                                minPrice = parseInt(price);
                            
                            count++;
                        }
                    }
                    if(count > 0)
                        products.push({title:result[r][0].title, p_id: r, minPrice: minPrice, maxPrice: maxPrice, count: count, keyword: title, image: result[r][0].image});
                }                    
            }
            if (products.length >= 2 && req.query.sort) {
                if (req.query.sort == "ASC") {
                    products = products.sort(function (a, b) {
                        return a.minPrice - b.minPrice;
                    });
                }
                else if (req.query.sort == "DESC"){
                    products = products.sort(function (a, b) {
                        return b.minPrice - a.minPrice;
                    });
                }
            }
            myURL[1] = myURL[1].replace(/&sort=DESC|&sort=ASC/gi, "");
            res.render('search', { title: "啾比比價網--搜尋結果", classify: "search", productList: products, keyword: title, username: username, hotProducts: hotProducts, URL: myURL[1] });
        }).catch(function (e) {
            console.log(e);
        });
    }
    else
    {
        res.send("<script> window.location.replace('./') </script>");
    }
    
});

app.get('/history', function (req, res) {
    var auth = req.session.uid;
    var username = auth ? req.session.mail : '訪客';
    var keyword;
    if(req.query.keyword != undefined)
        keyword = req.query.keyword;

    if(auth)
    {
        admin.database().ref('history/' + auth).once('value').then(function (snapshot) {
            var history = reverseOrder(snapshot.val());
            res.render('history', { title: "啾比比價網--歷史紀錄", classify: "history", username: username, keyword: keyword, history: history, hotProducts: hotProducts });
        })
    }
    else
    {
        var history = {};
        if(req.cookies.history)
            history = req.cookies.history;

        res.render('history', { title: "啾比比價網--歷史紀錄", classify: "history", username: username, keyword: keyword, history: history, hotProducts: hotProducts });
    }
    
});

app.get('/collect', function (req, res) {
    var auth = req.session.uid;
    var username = auth ? req.session.mail : '訪客';
    var keyword;
    var collections = [];
    if (req.query.keyword != undefined)
        keyword = req.query.keyword;
    if(auth)
    {        
        admin.database().ref('collect/' + auth).once('value', function (snapshot) {
            collections = reverseOrder(snapshot.val());
            res.render('collect', { title: "啾比比價網--我的收藏", classify: "collect", username: username, collections: collections, keyword: keyword, hotProducts: hotProducts});
        })
    }
    else
    {
        if(req.cookies.collections)
            collections = req.cookies.collections;
        console.log(collections);
        res.render('collect', { title: "啾比比價網--我的收藏", classify: "collect", username: username, collections: collections, keyword: keyword, hotProducts: hotProducts });
    }
        
    
});

app.get('/compare', function (req, res) {
    var productList;
    var auth = req.session.uid;
    var username = auth ? req.session.mail : '訪客';
    var thisURL = req.protocol + '://' + req.get('host') + req.originalUrl;

    var filter_minPrice = 0;
    var filter_maxPrice = 99999999999999999;
    var filter_website;
    if (!req.query.friday && !req.query.pchome && !req.query.myfone && !req.query.momo)
        filter_website = { Friday: true, PChome24h: true, myfone: true, Momo: true };
    else
        filter_website = { Friday: req.query.friday, PChome24h: req.query.pchome, myfone: req.query.myfone, Momo: req.query.momo };
    var filter_keywords = "";
    if (req.query.filter_keyword)
        filter_keywords = req.query.filter_keyword;
    filter_keywords = filter_keywords.split(',');
    if (req.query.min_price)
        filter_minPrice = req.query.min_price;
    if (req.query.max_price)
        filter_maxPrice = req.query.max_price;

    if (req.query.p_id != undefined && req.query.p_id != "" && req.query.keyword != undefined && req.query.keyword != "")
    {
        var p_id = req.query.p_id;
        var keyword = req.query.keyword;
        var minPrice = 99999999;
        var maxPrice = 0;

        var keyword = "";
        if (req.query.keyword != undefined)
            keyword = req.query.keyword;
        
        admin.database().ref('PChome/'+p_id).once('value').then(function (snapshot) {
            let products = new Array();
            var rIndex = new Array();
            var result = snapshot.val();
            var productCount = 0;
            for (var r in result) {
                var keywords = keyword.split(' ');
                var flag = false;
                for (var key in keywords) {
                    if (!(wildcard((result[r].title).toLowerCase(), '*' + keywords[key].toLowerCase() + '*'))) {
                        flag = true;
                    }
                }
                if (req.query.filter_keyword) {
                    for (var filter in filter_keywords) {
                        if (wildcard((result[r].title).toLowerCase(), '*' + filter_keywords[filter].toLowerCase() + '*')) {
                            flag = true;
                        }
                    }
                }     
                if (!flag)
                {
                    rIndex.push(r);                  
                }               
            }
            if(!auth)
            {
                var collections = [];
                if(req.cookies.collections)
                {
                    collections = req.cookies.collections;                    
                }
                for (index in rIndex) {
                    if (!checkWebsiteFilter(result[rIndex[index]].website, filter_website) || parseInt(result[rIndex[index]].price.replace(',', "")) < filter_minPrice || parseInt(result[rIndex[index]].price.replace(',', "")) > filter_maxPrice)
                        continue;
                    var isCollected = false;
                    for (col in collections) {
                        if (decodeURIComponent(result[rIndex[index]].url) === collections[col].url) {
                            isCollected = true;
                            break;
                        }                        
                    }
                    productCount++;
                    if (parseInt(result[rIndex[index]].price.replace(',', "")) > parseInt(maxPrice)) {
                        maxPrice = result[rIndex[index]].price.replace(',', "");
                    }
                    if (parseInt(result[rIndex[index]].price.replace(',', "")) < parseInt(minPrice))
                        minPrice = result[rIndex[index]].price.replace(',', "");

                    if (!isCollected)
                        products.push({ title: result[rIndex[index]].title, price: result[rIndex[index]].price.replace(',', ""), image: result[rIndex[index]].image, url: result[rIndex[index]].url, website: result[rIndex[index]].website, isCollected: false });
                    else
                        products.push({ title: result[rIndex[index]].title, price: result[rIndex[index]].price.replace(',', ""), image: result[rIndex[index]].image, url: result[rIndex[index]].url, website: result[rIndex[index]].website, isCollected: true });
                }
                if (products.length >= 2) {
                    if (req.query.sort) {
                        if (req.query.sort != "DESC") {
                            products = products.sort(function (a, b) {
                                return a.price - b.price;
                            });
                        }
                        else {
                            products = products.sort(function (a, b) {
                                return b.price - a.price;
                            });
                        }
                    }
                    else {
                        products = products.sort(function (a, b) {
                            return a.price - b.price;
                        });
                    }
                }
                
                var history = [];
                if(req.cookies.history)
                {
                    history = req.cookies.history;
                }
                var historyFlag = false;

                var myURL = thisURL.split('?');
                myURL[1] = myURL[1].replace(/&sort=DESC|&sort=ASC/gi, "");
                for(hIndex in history)
                {
                    if(history[hIndex].url === thisURL)
                        historyFlag = true;
                }
                if(!historyFlag)
                    history.push({ title: result[0].title, image: result[0].image, productCount: productCount, minPrice: minPrice, maxPrice: maxPrice, url: thisURL });
                res.cookie('history', history, { maxAge: 900000*100 ,httpOnly: true});
                res.render('compare', { title: result[0].title + " - 比價 - 啾比比價網", classify: "search", productList: products, p_name: result[0].title, username: username, keyword: keyword, hotProducts: hotProducts, URL: myURL[1] });
            }
               
            else{
                admin.database().ref('collect/' + auth).once('value').then(function (snapshott) {
                    var list = snapshott.val();                    
                    for (var index in rIndex) {
                        var isCollected = false;
                        for (var collectProduct in list) {                            
                            if (list[collectProduct].url === result[rIndex[index]].url) {
                                isCollected = true;
                                break;
                            }
                        }
                        productCount++;
                        if (parseInt(result[rIndex[index]].price.replace(',', "")) > parseInt(maxPrice))
                        {
                            maxPrice = result[rIndex[index]].price.replace(',', "");
                        }
                           
                        if (parseInt(result[rIndex[index]].price.replace(',', "")) < parseInt(minPrice))
                            minPrice = result[rIndex[index]].price.replace(',', "");

                        if (!isCollected)
                            products.push({ title: result[rIndex[index]].title, price: result[rIndex[index]].price.replace(',', ""), image: result[rIndex[index]].image, url: result[rIndex[index]].url, website: result[rIndex[index]].website, isCollected: false });
                        else
                            products.push({ title: result[rIndex[index]].title, price: result[rIndex[index]].price.replace(',', ""), image: result[rIndex[index]].image, url: result[rIndex[index]].url, website: result[rIndex[index]].website, isCollected: true });
                    }
                    if (products.length >= 2) {
                        if(req.query.sort)
                        {
                            if (req.query.sort != "DESC") {
                                products = products.sort(function (a, b) {
                                    return a.price - b.price;
                                });
                            }
                            else {
                                products = products.sort(function (a, b) {
                                    return b.price - a.price;
                                });
                            }
                        }
                        else
                        {
                            products = products.sort(function (a, b) {
                                return a.price - b.price;
                            });
                        }
                    }

                    var myURL = thisURL.split('?');
                    myURL[1] = myURL[1].replace(/&sort=DESC|&sort=ASC/gi, "");

                    res.render('compare', { title: result[0].title + " - 比價 - 啾比比價網", classify: "search", productList: products, p_name: result[0].title, username: username, keyword: keyword, hotProducts: hotProducts, url: myURL[1] });
                
                    admin.database().ref('history/' + auth).once('value').then(function (historyList) {
                        var history = historyList.val();
                        for (hIndex in history) {
                            if (history[hIndex].p_id == p_id && history[hIndex].keyword == keyword) {
                                admin.database().ref('history/' + auth).child(hIndex).remove();
                            }
                        }
                        console.log(req.originalUrl);
                        admin.database().ref('history/' + auth).push({ title: result[0].title, image: result[0].image, productCount: productCount, minPrice: minPrice, maxPrice: maxPrice,URL: thisURL });
                    })
                })
            }

            
            
        }).catch(function (e) {
            console.log(e);
        });
    }
    else
    {
        res.send("<script> window.location.replace('./') </script>");
    }
});

app.post('/signup', function(req,res){
    let email = req.body.email;
    let password = req.body.passwd;
    let password_check = req.body.pwd_check;
    if(password == password_check)
    {
        fireAuth.createUserWithEmailAndPassword(email, password)
            .then(function (user) {
                let saveUser = {
                    'email': email,
                    'password': password,
                    'user_type': "member",
                    'created_at': new Date(),
                    'updated_at': new Date(),
                    'key': user.uid
                };
                let ref = admin.database().ref('/users/' + user.uid);
                ref.set(saveUser);
                fireAuth.signInWithEmailAndPassword(email, password)
                    .then(function (user) {
                        res.redirect('/');
                    })
                    .catch(function (error) {
                        res.redirect('/');
                    });
            })
            .catch(function (error) {
                var errorCode = error.code;
                var errorMessage = error.message;
                return res.redirect('/');
            });
    }
        
    
})

app.post('/login', function(req,res){
    fireAuth.signInWithEmailAndPassword(req.body.email, req.body.passwd)
        .then(function (user) {
            req.session.uid = user.uid;
            req.session.mail = req.body.email;
            console.log(req.session.mail)
            backURL = req.header('Referer') || '/';
            res.redirect(backURL);
        })
        .catch(function (error) {
            console.log(error)
            backURL = req.header('Referer') || '/';
            res.redirect(backURL);
        });
})

app.post('/addtocollection', function(req,res){
    var title = req.body.title;
    var price = req.body.price;
    var image = req.body.image;
    var website = req.body.website;
    var url = req.body.urll;
    var uid = req.session.uid;
    var product = { title: title, price: price, image: image, website: website, url: decodeURIComponent(url)};
    if(product != undefined && uid)
    {
        admin.database().ref('collect/'+uid).push(product);
        res.send("成功加入收藏")
    }
    else if(product != undefined)
    {
        var collections = [];
        if(req.cookies.collections)
            collections = req.cookies.collections;
        collections.push(product);
        res.cookie('collections', collections, { maxAge: 900000*100, httpOnly: true });
        res.send("成功加入收藏")
    }
    else
    {
        res.send("收藏");
    }
})  

app.post('/clicklink', function (req, res) {
    var title = req.body.title;
    console.log(title);
    var price = req.body.price;
    var image = req.body.image;
    var website = req.body.website;
    var url = req.body.urll;
    var uid = req.session.uid;
        admin.database().ref('hotProducts').once('value').then(function(snapshot){
            var products = snapshot.val();
            var flag = false;
            var targetIndex;
            var clickTimes = 1;
            if(products != null)
            {
                for (index in products) {
                    if (products[index].url === url) {
                        flag = true;
                        targetIndex = index;
                        clickTimes = products[index].clickTimes+1;
                        break;
                    }
                }
                console.log(flag);
                if (flag) {
                    admin.database().ref('hotProducts').child(targetIndex).set({ clickTimes: clickTimes, title: products[targetIndex].title, price: products[targetIndex].price, image: products[targetIndex].image, website: products[targetIndex].website, url: products[targetIndex].url });
                }

                else {
                    admin.database().ref('hotProducts').push({ clickTimes: clickTimes, title: title, price: price, image: image, website: website, url: url });
                }
            }            
            else
                admin.database().ref('hotProducts').push({ clickTimes: clickTimes, title: title, price: price, image: image, website: website, url: url });
        })
})  

app.post('/removefromcollections',function(req,res){
    var key = req.body.key
    var auth = req.session.uid;
    if(key != undefined && key != "" && auth)
    {
        admin.database().ref('collect/'+auth).child(key).remove();
        res.send("移除收藏成功");
    }
    else
    {
        if(req.cookies.collections)
        {
            var collections = req.cookies.collections;
            console.log(collections);
            var isRemove = false;
            for(index in collections)
            {
                if(index == key)
                {
                    collections.splice(index, 1);
                    res.cookie('collections', collections, { maxAge: 900000 * 100, httpOnly: true });
                    res.send("移除收藏成功");
                    isRemove = true;
                }
            }
            if(!isRemove)
                res.send("移除收藏失敗");
        }
        else
            res.send("移除收藏失敗");
    }
})

function updateHotKeywords(keyword){
    admin.database().ref('hotKeywords').once('value').then(function(snapshot){
        var products = snapshot.val();
        var searchTimes = 1;
        if (products != null) {
            var flag = false;
            var targetIndex;
            for (index in products) {
                if (products[index].keyword === keyword) {
                    flag = true;
                    targetIndex = index;
                    searchTimes = products[index].searchTimes + 1;
                    break;
                }
            }
            if (flag) {
                admin.database().ref('hotKeywords').child(targetIndex).set({ keyword: keyword, searchTimes: searchTimes });
            }

            else {
                admin.database().ref('hotKeywords').push({ keyword: keyword, searchTimes: searchTimes });
            }
        }
        else
            admin.database().ref('hotKeywords').push({ keyword: keyword, searchTimes: searchTimes });
    })
}

function checkWebsiteFilter(website, website_filter){
    if (website_filter[website])
        return true;

    // console.log(website_filter);
    return false;
}


async function updateDataBase(){
    var pchomeProducts;
    var filter_keywords = ["Camera", "頭戴", "VR MOVE", "FlashFire", "動態控制器", "攝影機", "防塵組", "集線器", "充電底座", "風扇", "方向盤", "同捆", "主機","手把防滑矽膠保護套","防汗"];

    if(!productBrowser)
        productBrowser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });

    await getPCHomeData().then(
        products => pchomeProducts = products
    );
    for(var i in pchomeProducts)
    {
        console.log(i);
        var data = new Array();
        data.push(pchomeProducts[i]);
        await getFridaySearchData(pchomeProducts[i].title).then(
            products => Array.prototype.push.apply(data,products)
        );
        await getMomoSearchData(pchomeProducts[i].title).then(
            products => Array.prototype.push.apply(data, products)
        );
        await getmyfoneSearchData(pchomeProducts[i].title).then(
            products => Array.prototype.push.apply(data, products)
        );

        for(var k = 1; k < data.length; k++)
        {
            var rate;
            await compareImage(pchomeProducts[i].image, data[k].image).then(
                result => rate = result
            )
            console.log(rate);
            if(parseFloat(rate) > 25.2)
            {
                console.log("移除" + data[k].title);
                data.splice(k,1);
                k--;
            }
            else
            {
                console.log("留下" + data[k].title);
            }
        }

        
        data = data.filter(function (el) {
            var flag = true;
            for (key in filter_keywords) {
                if (wildcard(el.title.toLowerCase(), '*' + filter_keywords[key].toLowerCase() + '*'))
                {
                    
                    flag = false;
                    // console.log("移除" + el.title);
                }
            }

            
            return flag;
        });

        admin.database().ref('PChome').child(i).set(data);
    }
    console.log("end");
}


async function getPCHomeData() {
    const page = await productBrowser.newPage();
    await page.goto('https://24h.pchome.com.tw/store/DGBJAJ?style=2');
    const result = await page.evaluate(() => {
        let title_data = [];
        let titles = document.querySelectorAll('.col3f .c1f .prod_img img');
        for (var element of titles) {
            let text = element.alt;
            title_data.push({ text });
        }

        let price_data = [];
        let prices = document.querySelectorAll('#ProdListContainer .price .value');

        for (var element of prices) {
            let text = element.innerText;
            price_data.push({ text });
        }

        let img_data = [];
        let images = document.querySelectorAll('.col3f .c1f .prod_img img');

        for (var element of images) {
            let text = element.src;
            img_data.push({ text });
        }

        let url_data = [];
        let URLs = document.querySelectorAll("#ProdListContainer .col3f .nick a");

        for (var element of URLs) {
            let text = element.href;
            url_data.push({ text });
        }


        return { title_data, price_data, img_data, url_data };
    });

    var products = new Array();
    for (r in result.title_data) {
        products.push({ title: result.title_data[r].text, price: result.price_data[r].text, image: result.img_data[r].text, url: result.url_data[r].text, website: "PChome24h" });
    }

    return products;
}

async function getFridaySearchData(searchTitle) {
    console.log("friday start");
    // const browser = await puppeteer.launch({ headless: false });
    const page = await productBrowser.newPage();
    await page.goto('https://shopping.friday.tw/1/0/3/7122/202775/211216.html', { timeout: 0 });
    await page.waitFor('#keyword');
    await page.click('#keyword');
    await page.keyboard.type(searchTitle);
    await page.click('.search_but')
    await page.waitFor(".searchlist_area");
    const result = await page.evaluate(() => {
        let title_data = [];
        let titles = document.querySelectorAll(".searchlist_area .prodname h3");
        for (var element of titles) {
            let text = element.title;
            title_data.push({ text });
        }

        let price_data = [];
        let prices = document.querySelectorAll(".searchlist_area .price-table span strong");

        for (var element of prices) {
            let text = element.innerText;
            text = text.replace('$', '');
            price_data.push({ text });
        }

        let img_data = [];
        let images = document.querySelectorAll(".searchlist_area li img");
        for (var element of images) {
            let text = element.src;
            img_data.push({ text });
        }

        let url_data = [];
        let URLs = document.querySelectorAll(".searchlist_area .prodname h3 a");
        for (var element of URLs) {
            let text = element.href;
            url_data.push({ text });
        }

        return { title_data, price_data, img_data, url_data };
    });

    var products = new Array();
    for (r in result.title_data) {
        products.push({ title: result.title_data[r].text, price: result.price_data[r].text, image: result.img_data[r].text, url: result.url_data[r].text, website: "Friday" });
    }

    return products;
}

async function getMomoSearchData(searchTitle) {
    console.log("Momo start");
    // const browser = await puppeteer.launch({headless: false});
    const page = await productBrowser.newPage();
    try{
        page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36");
        await page.goto('https://www.momoshop.com.tw/search/searchShop.jsp?keyword=' + searchTitle, { timeout: 0 });
        await page.waitForNavigation();
        await page.waitFor('.listArea');
    }
    catch(e){
        console.log(e);
    }
    
    const result = await page.evaluate(() => {
        let title_data = [];
        let price_data = [];
        let img_data = [];
        let url_data = [];
        let titles = document.querySelectorAll(".searchPrdListArea .listArea ul li .prdName");
        if(titles.length > 0){
            for (var element of titles) {
                let text = element.innerText;
                title_data.push({ text });
            }

            
            let prices = document.querySelectorAll(".searchPrdListArea .listArea ul li .money .price");

            for (var element of prices) {
                let text = element.innerText;
                text = text.replace('$', '');
                price_data.push({ text });
            }

            
            let images = document.querySelectorAll(".searchPrdListArea .listArea ul li .prdImg");
            for (var element of images) {
                let text = element.src;
                img_data.push({ text });
            }

            
            let URLs = document.querySelectorAll(".searchPrdListArea .listArea ul li .goodsUrl");
            for (var element of URLs) {
                let text = element.href;
                url_data.push({ text });
            }

        }
        

        return { title_data, price_data, img_data, url_data };
    });

    var products = new Array();
    for (r in result.title_data) {
        products.push({ title: result.title_data[r].text, price: result.price_data[r].text, image: result.img_data[r].text, url: result.url_data[r].text, website: "Momo" });
    }
    // console.log(products);
    return products;
}

async function getmyfoneSearchData(searchTitle) {
    console.log("myfone start");
    // const browser = await puppeteer.launch({ headless: false });
    const page = await productBrowser.newPage();
    try {
        await page.goto('https://search.myfone.com.tw/searchResult.php?sort_id=ID_4726&keyword=' + searchTitle, { timeout: 0 });
        await page.waitFor('#rightBox');
    } catch (error) {
        console.log(error);
    }
    
    const result = await page.evaluate(() => {
        let title_data = [];
        let titles = document.querySelectorAll("#rightBox #sub_page_1 .categoryPdcSmall .title");
        for (var element of titles) {
            let text = element.innerText;
            title_data.push({ text });
        }

        let price_data = [];
        let prices = document.querySelectorAll("#rightBox #sub_page_1 .categoryPdcSmall .price");

        for (var element of prices) {
            let text = element.innerText;
            text = text.replace('$', '');
            price_data.push({ text });
        }

        let img_data = [];
        let images = document.querySelectorAll("#rightBox #sub_page_1 .categoryPdcSmall img");
        for (var element of images) {
            let text = element.getAttribute('data-original');
            img_data.push({ text });
        }

        let url_data = [];
        let URLs = document.querySelectorAll("#rightBox #sub_page_1 .categoryPdcSmall a");
        for (var element of URLs) {
            let text = element.href;
            url_data.push({ text });
        }

        return { title_data, price_data, img_data,url_data };
    });

    var products = new Array();
    for (r in result.title_data) {
        products.push({ title: result.title_data[r].text, price: result.price_data[r].text, image: result.img_data[r].text, url: result.url_data[r].text, website: "myfone" });
    }

    return products;
}


async function searchPCHomeData(title){
    var data;
    admin.database().ref('PChome').once('value').then( function (snapshot) {
        var result = snapshot.val();

        let products = new Array();
        for (r in result) {
            var keywords = title.split(' ');
            var flag = false;
            for (var key in keywords) {
                if (!wildcard(result[r].title.toLowerCase(), '*' + keywords[key].toLowerCase() + '*')) {
                    flag = true;
                }
            }
            if (!flag)
                products.push({ title: result[r].title, price: result[r].price, image: result[r].image, url: result[r].url });
        }    
        res.render('search', { title: "啾比比價網--搜尋結果", classify: "search", productList: productList });
    }).catch(function () {
        console.log("Promise Rejected");
    });
}


async function searchPCHomeDataFromFirebase(title,result) {

    let products = new Array();
    for (r in result) {
        var keywords = title.split(' ');
        var flag = false;
        for(var key in keywords)
        {
            if (!wildcard(result[r].title.toLowerCase(), '*' + keywords[key].toLowerCase() + '*'))
            {
                flag = true;
            }
        }
        if (!flag)
            products.push({ title: result[r].title, price: result[r].price, image: result[r].image,url: result[r].url });
    }    
    return products;
}

function reverseOrder(object){
    var keys = [];
    var newObject = [];
    for (var key in object) {
        keys.push(key);
    }
    for (var j = keys.length - 1; j >= 0; j--) {
        var value = object[keys[j]];
        newObject[keys[j]] = value;
    }
    return newObject;
}


// getMomoSearchData("上古卷軸");
updateDataBase();

setInterval(updateDataBase, 1000*60*15);

app.listen(port);