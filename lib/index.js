/*!
 * Copyright (c) 2022-2026 Digital Bazaar, Inc. All rights reserved.
 */
// import local config
import './config.js';

export * from './account.js';
// FIXME: use `export * as` syntax once webpack is fixed to support it
import * as ageCredentialHelpers from './ageCredentialHelpers.js';
import * as capabilities from './capabilities.js';
import * as cryptosuites from './cryptosuites.js';
import * as exchanges from './exchanges/index.js';
import * as helpers from './helpers.js';
import * as inbox from './inbox.js';
import * as nfcRenderer from './nfcRenderer.js';
import * as presentations from './presentations.js';
import * as users from './users.js';
import * as validator from './validator.js';
import * as zcap from './zcap.js';
export {
  ageCredentialHelpers, capabilities, cryptosuites, exchanges,
  helpers, inbox, nfcRenderer, presentations, users, validator, zcap
};
export {
  getCredentialStore, getProfileEdvClient, initialize, profileManager
} from './state.js';
export {documentLoader} from './documentLoader.js';
