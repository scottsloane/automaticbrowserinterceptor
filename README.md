# Automatic Browser Interceptor

Automatic Browser Interceptor is a tool designed to intercept and save specific http(s) requests made while using a chrome browser.

ABI launches a new chrome browser window and begins listening to all requests. If the request meets a filter criteria it is stored in a mongodb cluster.

## Configuration

Configuration is done in a config.json file.

```json
{
  "mongo": {
    "uri": "mongodb://localhost:22172/",
    "db": "bbi"
  },
  "UserDirectory": "tmp/chrome-testing",
  "Filter": ["website.com/graphql", "website.com/product"]
}
```

**mongo**: The uri to connect to, and the database name to use

**UserDirectory**: Where to place chrome user files

**Filter**: An array of url matches

## Updating Config

The remote config stored in the database can be updated with the local config by using the update script.

```
node update.js
```

## TODO

- Add auto-update (Testing)
- Add download config from mongo (Testing)
- Build for x86 platforms
- Remove filter from config and load from db every time (or just force an update every time?) (testing)

```json
{
  "Filter": [{ "projectName": ["url1", "url2"] }]
}
```
