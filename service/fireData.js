//firebase admin
var admin = require("firebase-admin");
var serviceAccount = require("./jubeecompare-firebase-adminsdk-f9u14-4d9a4ab82c.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://jubeecompare.firebaseio.com"
});

module.exports = admin.database();