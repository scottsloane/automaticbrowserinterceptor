const crypto = require("crypto");

const hash = (data) => {
  const h = crypto.createHash("sha256");
  h.update(data);
  return h.digest("hex");
};

class Intercept {
  constructor() {
    this.Requests = {};

    this.Stats = {
      Loaded: 0,
      Filtered: 0,
      Saved: 0,
      Skipped: 0,
    };
  }

  async Attatch(client, config, db) {
    const getProjectFromUrl = (url) => {
      for (let project of Object.keys(config.Get("Filter"))) {
        if (config.Get("Filter")[project].some((x) => url.includes(x)))
          return project;
      }
      return null;
    };

    const { Network, Page } = client;

    await Network.enable();
    await Page.enable();

    // Intercept and log all network requests
    Network.requestWillBeSent((params) => {
      // This just got complicated
      let project = getProjectFromUrl(params.request.url);
      if (project) {
        console.log(params.request.url, project);
        this.Requests[params.requestId] = {
          project: project,
          request: params,
        };
      } else {
        this.Stats.Filtered++;
      }
    });

    // Save response data for all network requests
    Network.on("responseReceived", async (params) => {
      this.Stats.Loaded++;
      if (this.Requests[params.requestId])
        this.Requests[params.requestId].response = params;
    });

    Network.on("loadingFinished", async (params) => {
      if (this.Requests[params.requestId]) {
        // console.log("Loading finished:", params.requestId);
        const response = await Network.getResponseBody({
          requestId: params.requestId,
        }).catch((err) => console.log(err));
        if (response && response.body) {
          // console.log("Response body:", response.body.length);
          let doc = {
            url: this.Requests[params.requestId].request.request.url,
            body: response.body,
            headers: {
              request: this.Requests[params.requestId].request.request.headers,
              response:
                this.Requests[params.requestId].response.response.headers,
            },
          };
          if (this.Requests[params.requestId].request.request.hasPostData)
            doc.postData =
              this.Requests[params.requestId].request.request.postData;
          doc.hash = hash(
            JSON.stringify({
              url: doc.url,
              body: doc.body,
              postData: doc.postData,
            })
          );
          // Add meta data to doc
          doc.timestamp = Date.now();
          doc.ip = config.Get("ip");
          doc.username = config.Get("username");

          // console.log(doc);
          let found = await db
            .collection(this.Requests[params.requestId].project)
            .findOne({
              hash: doc.hash,
            });
          if (!found) {
            this.Stats.Saved++;
            await db
              .collection(this.Requests[params.requestId].project)
              .insertOne(doc);
          } else {
            this.Stats.Skipped++;
          }
          console.log(this.Stats);
        }
        delete this.Requests[params.requestId];
      }
    });
  }
}

module.exports = Intercept;
