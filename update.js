const { MongoClient, ObjectId } = require("mongodb");
const Config = require("./config/index.js");

(async () => {
  const config = new Config();
  if (!config.Load("./config.json")) {
    console.log("Config file not found");
    process.exit(1);
  } else {
    const client = new MongoClient(config.Get("mongo").uri, {
      useUnifiedTopology: true,
    });
    try {
      await client.connect();
      const db = client.db("abi");
      const collection = db.collection("config");
      let doc = await collection.findOne({});
      if (!doc) {
        await collection.insertOne(config.Get());
      } else {
        let newdoc = config.Get();
        newdoc._id = doc._id;
        await collection.replaceOne({}, config.Get());
      }
    } catch (err) {
      console.log(err);
      process.exit(1);
    }
    process.exit(0);
  }
})();
