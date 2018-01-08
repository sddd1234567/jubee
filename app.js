var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var port = Number(process.env.PORT || 3000);
var cookieParser = require('cookie-parser');
var engine = require('ejs-locals');
var path = require('path');
const puppeteer = require('puppeteer');
var wildcard = require('node-wildcard');

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





app.get('/', function (req, res) {
    res.render('index', { title: "啾比比價網--首頁" });
});

app.get('/search', async function (req, res) {
    var productList;

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
            res.render('search', { title: "啾比比價網--搜尋結果", classify: "search", productList: products, keyword: title });
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
    res.render('history', { title: "啾比比價網--歷史紀錄",classify:"history"});
});

app.get('/collect', function (req, res) {
    res.render('collect', { title: "啾比比價網--我的收藏", classify: "collect" });
});

app.get('/compare', function (req, res) {
    var productList;

    if (req.query.p_id != undefined && req.query.p_id != "" && req.query.keyword != undefined && req.query.keyword != "")
    {
        var p_id = req.query.p_id;
        var keyword = req.query.keyword
        admin.database().ref('PChome/'+p_id).once('value').then(function (snapshot) {
            var result = snapshot.val();
            let products = new Array();
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
                    products.push({ title: result[r].title, price: result[r].price.replace(',', ""), image: result[r].image, url: result[r].url, website: result[r].website});
                }                    
            }
            products = products.sort(function (a, b) {
                return a.price - b.price;
            });
            res.render('compare', { title: result[0].title + " - 比價 - 啾比比價網", classify: "search", productList: products, p_name: result[0].title });
        }).catch(function (e) {
            console.log(e);
        });
    }
    else
    {
        res.send("<script> window.location.replace('./') </script>");
    }
});



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

// getMomoSearchData("上古卷軸");
initialPChomeDataBase();

setInterval(initialPChomeDataBase, 1000*60*15);

app.listen(port);