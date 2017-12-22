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
})

app.get('/search', function (req, res) {
    res.render('search', { title: "啾比比價網--首頁" });
})

app.listen(port);