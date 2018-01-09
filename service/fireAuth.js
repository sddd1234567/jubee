var firebase = require("firebase");
var config = {
  apiKey: "AIzaSyAeDzWU087CGRfHTV0SWOCxFymI-UlYlN0",
  authDomain: "jubeecompare.firebaseapp.com",
  databaseURL: "https://jubeecompare.firebaseio.com",
  projectId: "jubeecompare",
  storageBucket: "jubeecompare.appspot.com",
  messagingSenderId: "1053313042687"
}
firebase.initializeApp(config);

module.exports = firebase.auth();