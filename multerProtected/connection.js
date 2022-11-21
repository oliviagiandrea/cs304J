require("dotenv").config()
const { MongoClient, ServerApiVersion } = require('mongodb');

class Connection {
  static async open() {
    if (this.db) return this.db;
    const client = new MongoClient(this.url, this.options);
    await client.connect();
    this.db = client.db('wmdb');
    return this.db;
  }
}

Connection.db = null;
Connection.url = process.env.MONGO_URI;
Connection.options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1
};

module.exports = { Connection };