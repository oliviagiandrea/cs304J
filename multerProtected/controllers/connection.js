const MongoClient = require('mongodb').MongoClient;

class Connection {
    static async open() {
        if (this.db) return this.db;
        this.db = await MongoClient.connect(this.url, this.options);
        return this.db;
    }
}

Connection.db = null;
Connection.url = 'mongodb+srv://og102:asm707@cluster0.dn6vs.mongodb.net/?retryWrites=true&w=majority';
Connection.options = {
    useNewUrlParser:    true,
    useUnifiedTopology: true,
};

module.exports = { Connection };