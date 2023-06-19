const cla = require("command-line-args");
const inquirer = require("inquirer");

const CDP = require("chrome-remote-interface");
const chromeLauncher = require("chrome-launcher");
const { MongoClient } = require("mongodb");

const axios = require("./node_modules/axios/dist/node/axios.cjs"); // This is needed for pkg to work
const os = require("os");

const fs = require("fs");
const crypto = require("crypto");

const Config = require("./config/index.js");


const client = new MongoClient(config.mongo.uri, { useUnifiedTopology: true });

const hash = (data) => {
  const h = crypto.createHash("sha256");
  h.update(data);
  return h.digest("hex");
};

const checkForUpdates = async () => {
  const json = (await axios.get(
    "https://api.github.com/repos/GoogleChrome/chrome-launcher/releases/latest"
  )).data;

  const version = json.tag_name;
  console.log(version);
    
};



(async () => {

  const getProjectFromUrl = (url) => {
    for (let project of Object.keys(config.Filter)) {
      if (config.Filter[project].some((x) => url.includes(x))) return project;
    }
    return null;
  };


  const config = new Config();
  if (!config.Load()) {
    console.log("Config file not found, creating one...");

    // TODO: Add a prompt to ask for the mongo uri and db name

    config.Set("mongo", {
      uri: "mongodb://localhost:27017",
      db: "chrome",
    });
    config.Set("UserDirectory", "./chrome");
    config.Set("Filter", {
      "project1": ["project1.com"],
      "project2": ["project2.com"],
    });
    config.Save();
  }

  await checkForUpdates();

  try {
    await client.connect();
  } catch (err) {
    console.log(err);
    process.exit(1);
  }

  const db = client.db(config.mongo.db);

  const chrome = await chromeLauncher.launch({
    chromeFlags: [
      "--window-size=1200,800",
      `--user-data-dir=${config.UserDirectory}`,
      // "--auto-open-devtools-for-tabs",
    ],
  });

  chrome.process.on("close", () => {
    console.log("Chrome disconnected");
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  });

  const Requests = {};

  const Stats = {
    Loaded: 0,
    Filtered: 0,
    Saved: 0,
    Skipped: 0,
  };

  CDP({ port: chrome.port }, async function (client) {
    try {
      const { Network, Page } = client;

      await Network.enable();
      await Page.enable();

      // Intercept and log all network requests
      Network.requestWillBeSent((params) => {
        // This just got complicated
        let project = getProjectFromUrl(params.request.url);
        if (project) {
          console.log(params.request.url, project)
          Requests[params.requestId] = {
            project: project,
            request: params,
          };
        } else {
          Stats.Filtered++;
        }
      });

      // Save response data for all network requests
      Network.on("responseReceived", async (params) => {
        Stats.Loaded++;
        if (Requests[params.requestId])
          Requests[params.requestId].response = params;
      });

      Network.on("loadingFinished", async (params) => {
        if (Requests[params.requestId]) {
          // console.log("Loading finished:", params.requestId);
          const response = await Network.getResponseBody({
            requestId: params.requestId,
          }).catch((err) => console.log(err));
          if (response && response.body) {
            // console.log("Response body:", response.body.length);
            let doc = {
              url: Requests[params.requestId].request.request.url,
              body: response.body,
              headers: {
                request: Requests[params.requestId].request.request.headers,
                response: Requests[params.requestId].response.response.headers,
              },
            };
            if (Requests[params.requestId].request.request.hasPostData)
              doc.postData =
                Requests[params.requestId].request.request.postData;
            doc.hash = hash(
              JSON.stringify({
                url: doc.url,
                body: doc.body,
                postData: doc.postData,
              })
            );
            // console.log(doc);
            let found = await db
              .collection(Requests[params.requestId].project)
              .findOne({
                hash: doc.hash,
              });
            if (!found) {
              Stats.Saved++;
              await db
                .collection(Requests[params.requestId].project)
                .insertOne(doc);
            } else {
              Stats.Skipped++;
            }
            delete Requests[params.requestId];
            console.log(Stats);
          }
        }
      });

      // Navigate to a URL
      await Page.navigate({
        url: "https://www.carrierenterprise.com/product/1104245627571201",
      });

      // Page.on("frameNavigated", async (params) => {
      //   console.log("Navigated to:", params.frame.url);
      // })

      // Page.on("loadEventFired", () => {
        // console.log("Page loaded!");
      // });
    } catch (err) {
      console.error(err);
    }
  }).on("error", function (err) {
    console.error("Cannot connect to Chrome:", err);
  });
})();
