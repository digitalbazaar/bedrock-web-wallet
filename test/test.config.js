/*!
 * Copyright (c) 2022-2023 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from '@bedrock/core';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// MongoDB
config.mongodb.name = 'bedrock_web_wallet_test';
// drop all collections on initialization
config.mongodb.dropCollections = {};
config.mongodb.dropCollections.onInit = true;
config.mongodb.dropCollections.collections = [];

config.mocha.tests.push(path.join(__dirname, 'mocha'));

// allow self-signed certs in test framework
config['https-agent'].rejectUnauthorized = false;
config['https-agent'].keepAlive = true;

// do not require an authentication session for tests
config['kms-http'].requireAuthentication = false;

config.server.host = 'localhost:9876';
config.kms.allowedHost = config.server.host;

config.profile.kms.baseUrl = `${config.server.baseUri}/kms`;
config.profile.kms.ipAllowList = ['127.0.0.1/32'];

// do not require an authentication session for tests
config['kms-http'].requireAuthentication = false;

config.karma.suites['bedrock-web-wallet'] = path.join('web', '**', '*.js');

// use session
config.express.useSession = true;
config.express.jsonErrorLevel = 'full';

config.karma.config.proxies = {
  '/': 'https://localhost:18443/'
};
config.karma.config.proxyValidateSSL = false;
config.karma.config.webpack.resolve.fallback.events =
  require.resolve('events/');
config.karma.config.webpack.resolve = {
  modules: [
    path.resolve(__dirname, '..', 'node_modules'),
    path.resolve(__dirname, 'node_modules')
  ]
};

// do not fetch v1 dids from testnet
config['did-io'].methodOverrides.v1.disableFetch = true;
