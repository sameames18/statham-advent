import { createServer } from 'node:http';
import { createHandler } from './app.js';
import { loadCatalog } from './catalog.js';
import { ConfigError, readConfig } from './config.js';

let config;
try {
  config = readConfig();
} catch (err) {
  if (!(err instanceof ConfigError)) throw err;
  console.error(`Stathmas can't start: ${err.message}`);
  process.exit(1);
}

const catalog = loadCatalog({ secret: config.secret });
const server = createServer(createHandler(catalog, config));

server.listen(config.port, () => {
  console.log(`Stathmas is running at http://localhost:${config.port}`);
  if (config.timeTravel) console.log('Preview mode is on: add ?preview=2026-12-14 to the URL to pretend it\'s another day. Never run a real December like this.');
});
