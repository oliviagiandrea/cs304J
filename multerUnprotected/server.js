// start app with either 'npm run dev' or 'node server.js'
// go to http://149.130.15.5:3000/

const express = require('express');
const bodyParser= require('body-parser');
const multer = require('multer');
const app = express();

const { Connection } = require('./connection.js');
app.use(async function(req, res, next) {
  await Connection.open();
  next();
});

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/imgs')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
var upload = multer({ storage: storage })

app.get('/', (req, res) => {
  uploads.find().toArray()
  .then(results => {
    res.render('index.ejs', {uploads: results});
  })
  .catch(error => console.error(error));
});

app.post('/upload', upload.single('photo'), (req, res) => {
  // get data from form
  var upload_data = req.body;
  console.log(upload_data);
  // add filepath
  var fPath = (req.file.path).replace("public/imgs/", "");
  console.log(fPath);
  upload_data['imagepath'] = fPath;
  // insert recipe into mongodb
  Connection.db.collection("uploads").insertOne(upload_data)
    .then(results => {
      res.redirect('/');
    })
    .catch(error => console.error(error))
});

app.listen(3000, function() {
  console.log('listening on 3000');
});
