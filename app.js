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

app.get('/', function (req, res) {
    res.render('index', { title: "啾比比價網--首頁" });
});

app.get('/search', async function (req, res) {
    var productList;

    if (req.query.p_name != undefined && req.query.p_name != "")
    {
        var title = req.query.p_name;
        await searchPCHomeDataFromFirebase(title).then(
            products => productList = products
        );
        console.log(productList);
        res.render('search', { title: "啾比比價網--搜尋結果", classify: "search", productList: productList });
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
    res.render('compare', { title: "啾比比價網--比價", classify: "compare" });
});






async function getPCHomeData() {
    const browser = await puppeteer.launch();
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


        return { title_data, price_data, img_data };
    });

    var products = new Array();
    for (r in result.title_data) {
        products.push({ title: result.title_data[r].text, price: result.price_data[r].text, image: result.img_data[r].text });
    }

    console.log(products);

    await browser.close();
}

async function getFridayData() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://shopping.friday.tw/1/0/3/7122/202775/211216.html');
    const result = await page.evaluate(() => {
        let title_data = [];
        let titles = document.querySelectorAll('#prodlist .product_name');
        for (var element of titles) {
            let text = element.innerText;
            title_data.push({ text });
        }

        let price_data = [];
        let prices = document.querySelectorAll('#prodlist .price_txt');

        for (var element of prices) {
            let text = element.innerText;
            price_data.push({ text });
        }

        let img_data = [];
        let images = document.querySelectorAll('#prodlist li a img');

        for (var element of images) {
            let text = element.src;
            img_data.push({ text });
        }

        return { title_data, price_data, img_data };
    });
    //  console.log(result.price_data);
    var products = new Array();
    for (r in result.title_data) {
        products.push({ title: result.title_data[r].text, price: result.price_data[r].text, image: result.img_data[r].text });
    }

    console.log(products);

    await browser.close();
}

async function getudnData() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http://shopping.udn.com/mall/cus/cat/Cc1c01.do?dc_cateid_0=F_014_025_008&dc_maxproductnum_0=60');
    const result = await page.evaluate(() => {
        let title_data = [];
        let titles = document.querySelectorAll('.detail_list_tb .sp_name');
        for (var element of titles) {
            let text = element.innerText;
            title_data.push({ text });
        }

        let price_data = [];
        let prices = document.querySelectorAll('.detail_list_tb .pd_price .pd_hlight');

        for (var element of prices) {
            let text = element.innerText;
            price_data.push({ text });
        }

        let img_data = [];
        let images = document.querySelectorAll('.detail_list_tb img');
        for (var element of images) {
            let text = "http:" + element.getAttribute('data-src');
            img_data.push({ text });
        }

        return { title_data, price_data, img_data };
    });

    var products = new Array();
    console.log(result);
    for (r in result.title_data) {
        products.push({ title: result.title_data[r].text, price: result.price_data[r].text, image: result.img_data[r].text });
    }

    console.log(products);

    await browser.close();
}

async function getKuai3Data() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http://www.tkec.com.tw/dic2.aspx?cid=629&aid=10180&hid=92725');
    const result = await page.evaluate(() => {
        let title_data = [];
        let titles = document.querySelectorAll('#ctl00_ContentPlaceHolder1_dic2UC1_PnData .prod_item h3 a');
        for (var element of titles) {
            let text = element.title;
            title_data.push({ text });
        }

        let price_data = [];
        let prices = document.querySelectorAll('#ctl00_ContentPlaceHolder1_dic2UC1_PnData .prod_item .price span');

        for (var element of prices) {
            let text = element.innerText;
            text = text.replace('$', '');
            price_data.push({ text });
        }

        let img_data = [];
        let images = document.querySelectorAll('#ctl00_ContentPlaceHolder1_dic2UC1_PnData .prod_item a img');
        for (var element of images) {
            let text = element.src;
            img_data.push({ text });
        }

        return { title_data, price_data, img_data };
    });

    var products = new Array();
    console.log(result);
    for (r in result.title_data) {
        products.push({ title: result.title_data[r].text, price: result.price_data[r].text, image: result.img_data[r].text });
    }

    console.log(products);

    await browser.close();
}

async function getFridaySearchData(searchTitle) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://shopping.friday.tw/1/0/3/7122/202775/211216.html');
    await page.click('#keyword');
    await page.keyboard.type(searchTitle);
    await page.click('.search_but')
    await page.waitForNavigation();
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

        return { title_data, price_data, img_data };
    });

    var products = new Array();
    for (r in result.title_data) {
        products.push({ title: result.title_data[r].text, price: result.price_data[r].text, image: result.img_data[r].text });
    }

    console.log(products);

    await browser.close();
}

async function getUdnSearchData(searchTitle) {
    const browser = await puppeteer.launch({
        headless: true
    });
    const page = await browser.newPage();
    await page.goto('http://shopping.udn.com/mall/cus/cat/Cc1c01.do?dc_cateid_0=F_014_025_008');
    await page.click('#searchbarForm #autocompletebar');
    await page.keyboard.type(searchTitle);
    await page.click('#searchbarForm .sel_a');
    await page.click('#F_014_025_008');
    await page.click('.top_search_btn');
    await page.waitForNavigation();
    const result = await page.evaluate(() => {
        let title_data = [];
        let titles = document.querySelectorAll(".result_main .lv3_item_list .lv3_item img");
        for (var element of titles) {
            let text = element.alt;
            title_data.push({ text });
        }

        let price_data = [];
        let prices = document.querySelectorAll(".result_main .lv3_item_list .lv3_item .pd_price");

        for (var element of prices) {
            let text = element.innerText;
            text = text.replace('$', '');
            price_data.push({ text });
        }

        let img_data = [];
        let images = document.querySelectorAll(".result_main .lv3_item_list .lv3_item img");
        for (var element of images) {
            let text = element.src;
            img_data.push({ text });
        }

        return { title_data, price_data, img_data };
    });

    var products = new Array();
    for (r in result.title_data) {
        products.push({ title: result.title_data[r].text, price: result.price_data[r].text, image: result.img_data[r].text });
    }

    console.log(products);

    await browser.close();
}

async function getmyfoneSearchData(searchTitle) {
    const browser = await puppeteer.launch({
        headless: true
    });
    const page = await browser.newPage();
    await page.goto('https://search.myfone.com.tw/searchResult.php?sort_id=ID_4726&keyword=' + searchTitle);
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

        return { title_data, price_data, img_data };
    });

    var products = new Array();
    for (r in result.title_data) {
        products.push({ title: result.title_data[r].text, price: result.price_data[r].text, image: result.img_data[r].text });
    }

    console.log(products);

    await browser.close();
}



async function searchPCHomeDataFromFirebase(title) {
    const browser = await puppeteer.launch();
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


        return { title_data, price_data, img_data };
    });

    let products = new Array();
    for (r in result.title_data) {
        if (wildcard(result.title_data[r].text.toLowerCase(), '*' + title.toLowerCase() + '*'))
            products.push({ title: result.title_data[r].text, price: result.price_data[r].text, image: result.img_data[r].text });
    }
    

    await browser.close();
    return products;
}


app.listen(port);