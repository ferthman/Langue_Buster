import { startApiServer } from './server.js';

void startApiServer({
  env: process.env,
}).then((server) => {
  const address = server.address();
  if (typeof address === 'object' && address && 'port' in address) {
    process.stdout.write(`API listening on port ${address.port}\n`);
  }
});
