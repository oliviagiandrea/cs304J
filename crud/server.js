require("dotenv").config()
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const uid = 8234;

app.get("/", (req, res) => {
  return res.render("index.ejs", {error: null});
});

app.get("/insert", (req, res) => {
  return res.render("insert.ejs", {error: null});
});

app.post("/insert", async (req, res) => {
  try {
    const tt = req.body.movieTt;
    const title = req.body.movieTitle;
    const release = req.body.movieRelease;
    var errorList = [];
    // not using else ifs here because we want to check each condition
    if (tt.length === 0) {
      errorList.append("Missing Input: Movie's TT is Missing.");
    }
    if (title.length === 0) {
      errorList.append("Missing Input: Title is Missing.");
    }
    if (title.length === 0) {
      errorList.append("Missing Input: Release year is Missing..");
    }
      
    // if there are no error messages
    if (errorList.length === 0) {
      await client.connect();
      // use hardcoded uid value for addedby from top of server.js
      const user = await client.db("wmdb").collection("staff").findOne({uid: uid});
      const inserted = await client.db("wmdb").collection("movie").insertOne({tt: parseInt(tt), title: title, release: release, addedby: {uid: user.uid, name: user.name}});
      await client.close();
      // if the insert was successful
      if (inserted.acknowledged) {
        // flash('Form submission successful.')
        console.log('Form submission successful');
        // store in session ('flashes') :D
        return res.redirect("/update/" + tt);
      } else {
        // most likely a duplicate error
        console.log('Duplicate error');
        errorList.append("Movie already exists; Movie with tt = " + tt.toString() + " is already in database.");
        return res.render("insert.html", {error: errorList})
      }
    } else {
      // re-render the page, displaying any form entry errors we found earlier
      console.log('invalid inputs');
      return res.render("insert.html", {error: errorList})
    }
  } catch (err) {
    // something else has gone wrong somewhere
    console.log(err);
    // flash err
    return res.redirect("/")
  }
});

app.get("/search", (req, res) => {
  return res.render("search.ejs", {error: null});
});

app.post("/search", async (req, res) => {
  const query = req.body.searchTitle;
  const queryRegex = new RegExp(query, "i");
  var errorList = [];
  // 'search' button was pressed, but no info was entered
  if (query.length === 0) {
    errorList = ['Sorry, no movies found with a title like "' + query + '".'];
    return res.render("search.ejs", {error: errorList});
  } else {
    await client.connect();
    // use a regex expression to ignore case and look for partial matches
    const match = await client.db("wmdb").collection("movie").findOne({title: { $regex: queryRegex}});
    await client.close();
    if (match) {
      return res.redirect("/update/" + match.tt);
    } else {
      errorList = ['Sorry, no movies found with a title like "' + query + '".'];
      return res.render("search.ejs", {error: errorList});
    }
  }
});


app.get("/select", async (req, res) => {
  await client.connect();
  // only select data from tt and title fields
  const projection = { tt: 1, title: 1 };
  // be sure to include the "toArray", or await won't work
  const incompleteMovies = await client.db("wmdb").collection("movie").find({ $or: [ { release: null }, { director: null } ] }).project(projection).toArray();
  await client.close();
  return res.render("select.ejs", {error: null, movies: incompleteMovies});
});

app.post("/select", async (req, res) => {
  tt = req.body.menuTt;
  try {
    return res.redirect('/update/' + tt);
  } catch (err) {
    error = ['Movie not found.']
    return render_template('select.html', {error: error})
  }
});

app.get("/update/:movieId", async (req, res) => {
  await client.connect();
  const movieId = parseInt(req.params.movieId);
  const foundMovie = await client.db("wmdb").collection("movie").findOne({tt: movieId});
  await client.close();
  return res.render("update.ejs", {error: null, movie: foundMovie});
});

app.post("/update/:movieId", async (req, res) => {
  const oldTt = parseInt(req.params.movieId);
  const title = req.body.movieTitle;
  var errorList = [];

  if (req.body.submit === 'update') {
    // updating a movie
    const newTt = parseInt(req.body.movieTt);
    const release = req.body.movieRelease;
    const addedBy = req.body.movieAddedby;
    var directorNm = parseInt(req.body.movieDirector);
    await client.connect();
    // if a director id was entered, find the appropriate director obj
    if (directorNm) {
      // then replace director nm with director object
      directorNm = await client.db("wmdb").collection("person").findOne({nm: directorNm});
    }
    // update the movie entry in wmdb
    const updated = await client.db("wmdb").collection("movie").updateOne(
      {tt: oldTt}, 
      { $set: {
        tt: newTt,
        title: title,
        release: release,
        addedby: addedBy,
        director: directorNm
      }}
    );
    await client.close();
    // if the movie entry was updated successfully 
    if (updated) {
      console.log('Form submission successful.')
      // we can reroute to newTt regardless of whether the tt was updated or not
      return res.redirect('/update/' + newTt.toString());
    } else {
      // there was an error during updating the db entry, probably because tt already exists
      // so re-render oldTt's update page
      errorList = [updated];
      await client.connect();
      const foundMovie = await client.db("wmdb").collection("movie").findOne({tt: oldTt});
      await client.close();
      return res.render("update.ejs", {error: errorList, movie: foundMovie});
    }
  } else {
    // deleting a movie
    await client.connect();
    const deleted = await client.db("wmdb").collection("movie").deleteOne({tt: oldTt});
    await client.close();
    // if the movie entry was successfully deleted
    if (deleted) {
      console.log('Movie (' + title + ') was deleted successfully.');
      return res.render("index.ejs", {error: null});
    } else {
      errorList = [deleted];
      await client.connect();
      const foundMovie = await client.db("wmdb").collection("movie").findOne({tt: oldTt});
      await client.close();
      return res.render("update.ejs", {error: errorList, movie: foundMovie});
    }
  }
});

app.listen(3000, function() {
  console.log("listening on 3000");
});
