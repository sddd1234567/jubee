var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var port = Number(process.env.PORT || 80);
var cookieParser = require('cookie-parser');
var engine = require('ejs-locals');
var path = require('path');

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

app.get('/search', function (req, res) {
    res.render('search', { title: "啾比比價網--搜尋結果",classify: "search" });
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


app.listen(port);