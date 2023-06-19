const fs = require('fs');

class Config {

  constructor() {
    this.config = {}
  }

  Load() {
    if(!fs.existsSync('./config.json')) return false;
    try {
      this.config = require('./config.json');
    }catch(e) {
      return false;
    }
    return true;
  }

  Set(key, value) {
    this.config[key] = value;
  }

  Save() {
    fs.writeFileSync('./config.json', JSON.stringify(this.config, null, 2));
  }

}

module.exports = Config;