// start app with either 'npm run dev' or 'node server.js'
// go to http://149.130.15.5:3000/

require("dotenv").config()
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser= require('body-parser');
const multer = require('multer');
const path = require('path'); 
const flash = require('connect-flash');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.set('view engine', 'ejs');

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// for styles, not uploads!
app.use(express.static('public'));

const { Connection } = require('./controllers/connection.js')
app.use(function(req, res, next) {
  req.rootPath = __dirname;
  next();
});
app.use('/uploads', async (req, res, next) => {
  if ((req.baseUrl.startsWith("/uploads") && (req.originalUrl.endsWith(".jpg") || req.originalUrl.endsWith(".png") || req.originalUrl.endsWith(".jpeg")))) {
    const uId = req.cookies.userId;
    // if /photos, check if user is logged in
    if (!uId) {
      // if not, redirect to login page
      return res.redirect('/login');
    } else {
      console.log("let's see if you're authorized....");
      // if user is logged in, are they the uploader of the photo?
      await Connection.open();
      const author = await Connection.db.collection('uploads').findOne({imagePath: req.originalUrl.slice(1)});
      if (!author) {
        console.log("Error: Photo titled", req.originalUrl.slice(9), "does not exist in uploads.");  // display error message
        return res.redirect('/photos/' + uId);
      } else {
        if (uId !== author.userId) {
          // if user is not photo uploader, redirect (/photos), give authorization error
          console.log("Error: You are only authorized to access your own uploads, and you are not the uploader of this photo.");
          return res.redirect('/photos/' + uId);
        } else {
          // if so, show picture!
          next();
        }
      }
    }
  } else {
    // if not /uploads, whatever, move along
    console.log("moving along");
    next();
  }
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')) );

app.use('/uploads', express.static('uploads'));
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
var upload = multer({ storage: storage })

app.use(session({
  secret: "secretKey",
  saveUninitialized:true,
  resave: false
}));

var userSession;

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
        res.cookie('userId', userSession.userId)
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
    } else if (userSession.userId !== userIdFromUrl) {
      var errorString = (`You are currently logged in as ${userSession.username}, and are only allowed to view your own uploads.`);
      return res.render('index.ejs', {uploads: null, user: userSession, error: errorString});
    }
    var results = await uploads.find({userId: userSession.userId}).toArray();
    return res.render('index.ejs', {uploads: results, user: userSession, error: null});
  });

  app.post('/upload', upload.single('photo'), async (req, res) => {
    userSession = req.session;
    if (!(userSession.userId)) {
      return res.redirect('/login');
    }
    // get data from form
    var upload_data = req.body;
    console.log(upload_data);
    // add filepath
    var fPath = (req.file.path).replace("public/imgs/", "").replace("\\", "/");
    console.log(fPath);
    upload_data.imagePath = fPath;
    // ensure no duplicate naming conventions for uploaded images
    const duplicateEntry = await uploads.findOne({imagePath: upload_data.imagePath});
    if (duplicateEntry != null) {
      console.log("Error: Another uploaded image already exists with that title. Please rename your image and try again.");
      return res.redirect('/photos/' + userSession.userId.toString());
    }
    // add userId from session
    upload_data.userId = userSession.userId;
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