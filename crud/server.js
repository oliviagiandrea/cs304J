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
      errorList.push("Missing Input: Movie's TT is Missing.");
    }
    if (title.length === 0) {
      errorList.push("Missing Input: Title is Missing.");
    }
    if (title.length === 0) {
      errorList.push("Missing Input: Release year is Missing..");
    }
      
    // if there are no error messages
    if (errorList.length === 0) {
      // use hardcoded uid value for addedby from top of server.js
      const user = await Connection.db.collection("staff").findOne({uid: uid});
      try {
        const inserted = await Connection.db.collection("movie").insertOne({
          tt: parseInt(tt), 
          title: title, 
          release: release, 
          addedby: {uid: user.uid, name: user.name}
        });
        console.log('Form submission successful'); // flash
        // store in session ('flashes') :D
        return res.redirect("/update/" + tt);
      } catch (err) {
        // most likely a duplicate error
        console.log('Duplicate error'); // flash
        errorList.push("Movie already exists; Movie with tt = " + tt.toString() + " is already in database.");
        return res.render("insert.ejs", {error: errorList})
      }
    } else {
      // re-render the page, displaying any form entry errors we found earlier
      console.log('invalid inputs'); // flash
      return res.render("insert.ejs", {error: errorList})
    }
  } catch (err) {
    // something else has gone wrong somewhere
    console.log(err); // flash
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
    // use a regex expression to ignore case and look for partial matches
    const match = await Connection.db.collection("movie").findOne({title: { $regex: queryRegex}});
    if (match) {
      return res.redirect("/update/" + match.tt);
    } else {
      errorList = ['Sorry, no movies found with a title like "' + query + '".'];
      return res.render("search.ejs", {error: errorList});
    }
  }
});


app.get("/select", async (req, res) => {
  // only select data from tt and title fields
  const projection = { tt: 1, title: 1 };
  // be sure to include the "toArray", or await won't work
  const incompleteMovies = await Connection.db.collection("movie").find({ $or: [ { release: null }, { director: null } ] }).project(projection).toArray();
  return res.render("select.ejs", {error: null, movies: incompleteMovies});
});

app.post("/select", async (req, res) => {
  tt = req.body.menuTt;
  try {
    return res.redirect('/update/' + tt);
  } catch (err) {
    errorList = ['Movie not found.']
    return render_template('select.ejs', {error: errorList})
  }
});

app.get("/update/:movieId", async (req, res) => {
  const movieId = parseInt(req.params.movieId);
  const foundMovie = await Connection.db.collection("movie").findOne({tt: movieId});
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
    var addedBy = req.body.movieAddedby;
    var directorNm = parseInt(req.body.movieDirector);
    if ([directorNm, newTt].includes(NaN)) {
      errorList = ["Director and/or TT value must be a number."];
      const foundMovie = await Connection.db.collection("movie").findOne({tt: oldTt});
      return res.render("update.ejs", {error: errorList, movie: foundMovie});
    }
    // if a director id was entered, find the appropriate director obj
    if (directorNm !== null) {
      // then replace director nm with director object
      directorNm = await Connection.db.collection("people").findOne({nm: parseInt(directorNm)});
      if (directorNm === null) {
        errorList = ["Director does not exist"];
        const foundMovie = await Connection.db.collection("movie").findOne({tt: oldTt});
        return res.render("update.ejs", {error: errorList, movie: foundMovie});
      }
    }
    // if a addedby uid was entered, find the appropriate staff obj
    if (addedBy !== null) {
      addedBy = await Connection.db.collection("staff").findOne({uid: parseInt(addedBy)});
    }
    // update the movie entry in wmdb
    const updated = await Connection.db.collection("movie").updateOne(
      {tt: oldTt}, 
      { $set: {
        tt: newTt,
        title: title,
        release: release,
        addedby: addedBy,
        director: directorNm
      }}
    );
    // if the movie entry was updated successfully 
    if (updated) {
      console.log('Form submission successful.') // flash
      // we can reroute to newTt regardless of whether the tt was updated or not
      return res.redirect('/update/' + newTt.toString());
    } else {
      // there was an error during updating the db entry, probably because tt already exists
      // so re-render oldTt's update page
      errorList = [updated];
      const foundMovie = await Connection.db.collection("movie").findOne({tt: oldTt});
      return res.render("update.ejs", {error: errorList, movie: foundMovie});
    }
  } else {
    // deleting a movie
    const deleted = await Connection.db.collection("movie").deleteOne({tt: oldTt});
    // if the movie entry was successfully deleted
    if (deleted) {
      console.log('Movie (' + title + ') was deleted successfully.'); // flash
      return res.render("index.ejs", {error: null});
    } else {
      errorList = [deleted];
      const foundMovie = await Connection.db.collection("movie").findOne({tt: oldTt});
      return res.render("update.ejs", {error: errorList, movie: foundMovie});
    }
  }
});

app.listen(3000, function() {
  console.log("listening on 3000");
});
