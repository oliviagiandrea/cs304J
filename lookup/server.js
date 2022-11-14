require("dotenv").config()
const express = require("express");
const bodyParser = require("body-parser");
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.set("view engine", "ejs");

const helper = require("./helper.js");

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

client.connect(function(err, db) {
	if (err) throw err;
  console.log("Connected to Database");
  const dbo = db.db("wmdb");
  const people = dbo.collection("people");
  const movie = dbo.collection("movie");

  app.get("/", (req, res) => {
    return res.render("index.ejs", {error: null, movies: null, people: null, query: null});
  });

  app.get("/nm/:personId", async (req, res) => {
    const personId = parseInt(req.params.personId);
    const foundPerson = await people.findOne({nm: personId});
    if (!foundPerson) {
      const errorString = "Sorry, no person with that ID is in the database."
      return res.render("index.ejs", {error: errorString, movies: null, people: null, query: null});
    }
    console.log(foundPerson);
    return res.render("person.ejs", {person: foundPerson});
  });

  app.get("/tt/:movieId", async (req, res) => {
    const movieId = parseInt(req.params.movieId);
    const foundMovie = await movie.findOne({tt: movieId});
    if (!foundMovie) {
      const errorString = "Sorry, no person with that ID is in the database."
      return res.render("index.ejs", {error: errorString, movies: null, people: null, query: null});
    }
    console.log(foundMovie);
    return res.render("movie.ejs", {movie: foundMovie});
  });

  app.get("/query", async (req, res) => {
    // query and kind will always not be null because html form has validation
    const queryString = req.query.query;
    const queryRegex = new RegExp(queryString, "i");
    const kindString = req.query.kind;
    var errorString, matches = null;

    if (kindString === "person") {
      matches = await people.find({name: { $regex: queryRegex}}).toArray();
      console.log(matches);
      if (matches.length === 0) {
        errorString = "Sorry, no actors found."
        return res.render("index.ejs", {error: errorString, people: null, movies: null, query: null});
      } else if (matches.length === 1) {
        const personId = matches[0].nm;
        return res.redirect("/nm/" + personId);
      }
      return res.render("index.ejs", {error: null, people: matches, movies: null, query: queryString});
    } else {
      // if we're here, it means kindString === "movie"
      matches = await movie.find({title: { $regex: queryRegex}}).toArray();
      if (matches.length === 0) {
        errorString = "Sorry, no movies found."
        return res.render("index.ejs", {error: errorString, movies: null, people: null, query: null});
      } else if (matches.length === 1) {
        const movieId = matches[0].tt;
        return res.redirect("/tt/" + movieId);
      }
      return res.render("index.ejs", {error: null, movies: matches, people: null, query: queryString});
    }
  });

  app.listen(3000, function() {
    console.log("listening on 3000");
  });
})