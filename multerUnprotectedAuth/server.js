// start app with either 'npm run dev' or 'node server.js'
// go to http://149.130.15.5:3000/

const express = require('express');
const session = require('express-session');
const bodyParser= require('body-parser');
const multer = require('multer');
const app = express();

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://og102:asm707@cluster0.dn6vs.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
// uploads somewhere else ... not a publicly accessible folder
// force uploads to go through a route (fs module)
// rename files with random string of chars as well!
app.use('/uploads', express.static('uploads'));

// set up session options: https://www.npmjs.com/package/express-session?ref=hackernoon.com#sessionoptions
// const oneDay = 1000 * 60 * 60 * 24;
app.use(session({
  secret: "supersecretkeymwahahaha",
  saveUninitialized:true,
  resave: false
  // cookie: { maxAge: oneDay },
}));

var userSession;

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/imgs')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
var upload = multer({ storage: storage })

client.connect(function(err, db) {
	if (err) throw err;
  console.log('Connected to Database');
  const dbo = db.db('uploadTest');
	const users = dbo.collection('users');
  const uploads = dbo.collection('uploads');

  app.get('/', (req, res) => {
    userSession = req.session;
    if(userSession.username) {
      res.write(`<h1>Hello ${userSession.username} h1><br>`);
      return;
    } else {
      return res.redirect('/login');
    }
  });

  app.get('/login',(req,res) => {
    return res.render('login.ejs', {error: null});
  });

  app.post('/register', (req,res) => {
    var userData = req.body;
    userSession = req.session;    
    var existingUsers = users.find({username: userData.username}).toArray();
    console.log("existingUsers:", existingUsers);
    if (existingUsers.length > 0 ) {
      var errorString = "Error: A user with that username already exists. Please select another.";
      return res.render('login.ejs', {error: errorString});
    } else {
      users.insertOne(userData)
      .then(results => {
        console.log(results);
        userSession.userId = results.insertedId;
        userSession.username = userData.username;
        userSession.password = userData.password;
        return res.redirect('/photos/' + userSession.userId.toString());
      })
      .catch(error => console.error(error))
    }
  });

  app.post('/login', async (req,res) => {
    userSession = req.session;
    var userData = req.body;
    var existingUser = await users.findOne({username: userData.username});
    if (existingUser.length === 0 ) {
      var errorString = "Error: Username not found.";
      return res.render('login.ejs', {error: errorString});
    } else {
      if (existingUser.password !== userData.password) {
        var errorString = "Error: Incorrect password.";
        return res.render('login.ejs', {error: errorString});
      } else {
        userSession.userId = existingUser._id.toString();
        userSession.username = existingUser.username;
        userSession.password = existingUser.password;
        return res.redirect('/photos/' + userSession.userId);
      }
    }
  });

  app.get('/logout', (req,res) => {
    req.session.destroy((err) => {
      if (err) {
        return console.log(err);
      }
      return res.redirect('/login');
    });
  });

  app.get('/photos/:userId', async (req, res) => {
    userSession = req.session;
    userIdFromUrl = req.params.userId;
    if (!(userSession.userId)) {
      return res.redirect('/login');
    // }
    } else if (userSession.userId !== userIdFromUrl) {
      var errorString = (`You are currently logged in as ${userSession.username}, and are only allowed to view your own uploads.`);
      return res.render('index.ejs', {uploads: null, user: userSession, error: errorString});
    // } else if (userSession.username) {
    //   res.write(`<h1>Hello ${userSession.username}<h1><br>`);
    }
    var results = await uploads.find({userId: userSession.userId}).toArray();
    return res.render('index.ejs', {uploads: results, user: userSession, error: null});
  });

  app.post('/upload', upload.single('photo'), (req, res) => {
    userSession = req.session;
    if (!(userSession.userId)) {
      return res.redirect('/login');
    }
    // get data from form
    var upload_data = req.body;
    console.log(upload_data);
    // add filepath
    var fPath = (req.file.path).replace("public/imgs/", "");
    console.log(fPath);
    upload_data['imagePath'] = fPath;
    // add userId from session
    upload_data['userId'] = userSession.userId;
    // insert recipe into mongodb
    uploads.insertOne(upload_data)
      .then(results => {
        return res.redirect('/photos/' + userSession.userId.toString());
      })
      .catch(error => console.error(error))
  });

  app.listen(3000, function() {
    console.log('listening on 3000');
  });
})