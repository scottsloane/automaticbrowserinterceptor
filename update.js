const axios = require("./node_modules/axios/dist/node/axios.cjs"); // This is needed for pkg to work
const os = require("os");

(async() => {
    console.log(os.platform(),os.arch())
    
    const json = (await axios.get(
      "https://api.github.com/repos/GoogleChrome/chrome-launcher/releases/latest"
    )).data;

    const version = json.tag_name;
    console.log(version);
})()