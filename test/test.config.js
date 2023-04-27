/*!
 * Copyright (c) 2022 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from '@bedrock/core';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'url';
import path from 'path';
import '@bedrock/https-agent';
import '@bedrock/karma';
import '@bedrock/mongodb';

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

config.karma.suites['bedrock-web-wallet'] = path.join('web', '**', '*.js');
config.karma.config.proxies = {
  '/': 'https://localhost:18443'
};
config.karma.config.proxyValidateSSL = false;
config.karma.config.webpack.resolve.fallback.events =
  require.resolve('events/');
