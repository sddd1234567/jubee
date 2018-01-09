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
        hotProducts = products;
    }
})


app.get('/', function (req, res) {
    var auth = req.session.uid;
    var username = auth ? req.session.mail : '訪客';
    res.render('index', { title: "啾比比價網--首頁", username: username});
});

app.get('/search', async function (req, res) {
    var productList;
    var auth = req.session.uid;
    var username = auth ? req.session.mail : '訪客';
    console.log(username);
    if (req.query.p_name != undefined && req.query.p_name != "")
    {
        var title = req.query.p_name;
        admin.database().ref('PChome').once('value').then(function (snapshot) {
            var result = snapshot.val();
            let products = new Array();
            for (var r in result) {
                var keywords = title.split(' ');
                var flag = false;
                for (var key in keywords) {
                    // console.log(result[r][0].title);
                    if (!(wildcard((result[r][0].title).toLowerCase(), '*' + keywords[key].toLowerCase() + '*'))) {
                        flag = true;
                    }
                    // console.log(result[r][0].title);
                }
                if (!flag)
                {
                    var count = 0;
                    var minPrice = 9999999999999;
                    var maxPrice = 0;
                    for(var i in result[r])
                    {
                        if ((wildcard((result[r][i].title).toLowerCase(), '*' + keywords[key].toLowerCase() + '*'))) 
                        {
                            var price = result[r][i].price.replace(',',"");
                            if (parseInt(price) > maxPrice)
                                maxPrice = parseInt(price);
                            if (parseInt(price) < minPrice)
                                minPrice = parseInt(price);
                            // products.push({ title: result[r][i].title, price: result[r][i].price, image: result[r][i].image, url: result[r][i].url });
                            count++;
                        }
                    }
                    products.push({title:result[r][0].title, p_id: r, minPrice: minPrice, maxPrice: maxPrice, count: count, keyword: title, image: result[r][0].image});
                }
                    
            }
            res.render('search', { title: "啾比比價網--搜尋結果", classify: "search", productList: products, keyword: title, username: username, hotProducts: hotProducts });
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
        res.redirect('/');
    }
    
});

app.get('/collect', function (req, res) {
    var auth = req.session.uid;
    var username = auth ? req.session.mail : '訪客';
    var keyword;
    if (req.query.keyword != undefined)
        keyword = req.query.keyword;
    if(auth)
    {        
        admin.database().ref('collect/' + auth).once('value', function (snapshot) {
            var collections = reverseOrder(snapshot.val());
            res.render('collect', { title: "啾比比價網--我的收藏", classify: "collect", username: username, collections: collections, keyword: keyword, hotProducts: hotProducts});
        })
    }
    else
        res.redirect('/');
    
});

app.get('/compare', function (req, res) {
    var productList;
    var auth = req.session.uid;
    var username = auth ? req.session.mail : '訪客';
    console.log(username);
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
                if (!flag)
                {
                    rIndex.push(r);
                    if(!auth)
                        products.push({ title: result[r].title, price: result[r].price.replace(',', ""), image: result[r].image, url: result[r].url, website: result[r].website, isCollected: false });
                    
                }               
            }
            if(!auth)
            {
                products = products.sort(function (a, b) {
                    return a.price - b.price;
                });
                res.render('compare', { title: result[0].title + " - 比價 - 啾比比價網", classify: "search", productList: products, p_name: result[0].title, username: username, keyword: keyword, hotProducts: hotProducts });
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
                    products = products.sort(function (a, b) {
                        return a.price - b.price;
                    });
                    res.render('compare', { title: result[0].title + " - 比價 - 啾比比價網", classify: "search", productList: products, p_name: result[0].title, username: username, keyword: keyword, hotProducts: hotProducts });
                
                    admin.database().ref('history/' + auth).once('value').then(function (historyList) {
                        var history = historyList.val();
                        for (hIndex in history) {
                            if (history[hIndex].p_id == p_id && history[hIndex].keyword == keyword) {
                                admin.database().ref('history/' + auth).child(hIndex).remove();
                            }
                        }
                        admin.database().ref('history/' + auth).push({ title: result[0].title, image: result[0].image, productCount: productCount, minPrice: minPrice, maxPrice: maxPrice, p_id: p_id, keyword: keyword });
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
    console.log(url);
    var uid = req.session.uid;
    var product = {title: title, price: price, image: image, website: website, url: url};
    if(product != undefined && uid)
    {
        console.log(product);
        admin.database().ref('collect/'+uid).push(product);
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
            console.log("gettt");
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
        res.send("移除收藏失敗");
    }
})


async function initialPChomeDataBase(){
    var pchomeProducts;
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
        admin.database().ref('PChome').child(i).set(data);
    }
    console.log("end");
}


async function getPCHomeData() {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] } );
    const page = await browser.newPage();
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


    await browser.close();
    return products;
}

async function getFridaySearchData(searchTitle) {
    console.log("friday start");
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] } );
    // const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
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

    await browser.close();
    return products;
}

async function getMomoSearchData(searchTitle) {
    console.log("Momo start");
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    // const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
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
    await browser.close();    
    return products;
}

async function getmyfoneSearchData(searchTitle) {
    console.log("myfone start");
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] } );
    // const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
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

    await browser.close();
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

function reverseOrder(object)
{
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
// initialPChomeDataBase();

setInterval(initialPChomeDataBase, 1000*60*15);

app.listen(port);