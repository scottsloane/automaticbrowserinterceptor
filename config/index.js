const fs = require("fs");

class Config {
  constructor() {
    this.config = {};
  }

  Load(path) {
    if (typeof path === "string") {
      console.log("Loading config from file:", path)
      console.log(process.cwd())
      if (!fs.existsSync(path)) {
        console.log("Config file path not found");
        return false};
      try {
        this.config = JSON.parse(fs.readFileSync(path));
      } catch (e) {
        console.log(e);
        process.exit(1);
      }
      return true;
    } else if (typeof path === "object") {
      this.config = path;
      return true;
    }
  }

  Set(key, value) {
    this.config[key] = value;
  }

  Get(key) {
    if(!key)  return this.config;
    return this.config[key];
  }

  Save() {
    fs.writeFileSync("./config.json", JSON.stringify(this.config, null, 2));
  }
}

module.exports = Config;
