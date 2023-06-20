const CDP = require("chrome-remote-interface");
const chromeLauncher = require("chrome-launcher");
const { MongoClient } = require("mongodb");
const commandLineArgs = require("command-line-args");

const Config = require("./config/index.js");
const Intercept = require("./intercept/index.js");

const optionDefinitions = [{ name: "db", type: String, defaultOption: true }];

const options = commandLineArgs(optionDefinitions);

(async () => {
  const config = new Config();
  if (!config.Load("./config.json")) {
    console.log("Config file not found");
    if (options.db) {
      console.log("Using command line db option");
      console.log("Attempting to load configuration from database");

      const uclient = new MongoClient(options.db, {
        useUnifiedTopology: true,
      });

      await uclient.connect();

      let doc = await uclient.db("abi").collection("config").findOne({});
      if (!doc) {
        console.log("No configuration found in database");
        process.exit(1);
      }

      config.Load(doc);
      config.Save();
    } else {
      console.log("Please create a config.json file");
      console.log("or pass a database connection string with the --db option");
      process.exit(1);
    }
  } else {
    console.log("Updating configuration from database");
    const uclient = new MongoClient(config.Get("mongo").uri, {
      useUnifiedTopology: true,
    });

    await uclient.connect();

    let doc = await uclient.db("abi").collection("config").findOne({});
    if (!doc) {
      console.log("No configuration found in database");
      process.exit(1);
    }

    config.Load(doc);
    config.Save();
  }

  const client = new MongoClient(config.Get("mongo").uri, {
    useUnifiedTopology: true,
  });

  try {
    await client.connect();
  } catch (err) {
    console.log(err);
    process.exit(1);
  }

  const db = client.db(config.Get("mongo").db);

  const chrome = await chromeLauncher.launch({
    chromeFlags: [
      "--window-size=1200,800",
      `--user-data-dir=${config.Get("UserDirectory")}`,
      // "--auto-open-devtools-for-tabs",
    ],
  });

  chrome.process.on("close", () => {
    console.log("Chrome disconnected");
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  });

  CDP({ port: chrome.port }, async function (client) {
    try {
      const intercept = new Intercept();
      intercept.Attatch(client, config, db);

      const { Page, Target } = client;

      Target.on("targetCreated", async (params) => {
        if (params.targetInfo.type != "page") {
          return;
        }

        const { targetId } = params.targetInfo;
        const findTarget = (targets) => {
          return targets.find((target) => target.id === targetId);
        };

        CDP(
          { target: findTarget, port: chrome.port },
          async function (newclient) {
            let newIntercept = new Intercept();
            newIntercept.Attatch(newclient, config, db);
          }
        );
      });

      await Target.setDiscoverTargets({ discover: true });
      await Page.enable();

      // Navigate to a URL
      await Page.navigate({
        url: config.Get("page"),
      });
    } catch (err) {
      console.error(err);
    }
  }).on("error", function (err) {
    console.error("Cannot connect to Chrome:", err);
  });
})();
