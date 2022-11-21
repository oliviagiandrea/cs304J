// CAREFUL! students must edit their .env file before this starter will work!!

// start app with 'npm run dev' in a terminal window
// go to http://localhost:3000/ to view your deployment!
// every time you change something in server.js and save, your deployment will automatically reload

// to exit, type 'ctrl + c', then press the enter key in a terminal window
  // if you're prompted with 'terminate batch job (y/n)?', type 'y', then press the enter key in the same terminal

require("dotenv").config()
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

const { Connection } = require('./connection.js');
app.use(async function(req, res, next) {
  await Connection.open();
  next();
});

app.get('/', (req, res) => {
  return res.render('index.ejs');
});

app.listen(3000, function() {
  console.log('listening on 3000');
});