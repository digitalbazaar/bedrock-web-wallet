/*!
 * Copyright (c) 2022 Digital Bazaar, Inc. All rights reserved.
 */
// import local config
import './config.js';

export * from './account.js';
// FIXME: use `export * as` syntax once webpack is fixed to support it
// export * as capabilities from './capabilities.js';
// export * as credentialHelpers from './credentialHelpers.js';
// export * as helpers from './helpers.js';
// export * as users from './users.js';
// export * as validator from './validator.js';
// export * as zcap from './zcap.js';
import * as ageCredentialHelpers from './ageCredentialHelpers.js';
import * as capabilities from './capabilities.js';
import * as credentialHelpers from './credentialHelpers.js';
import * as helpers from './helpers.js';
import * as presentations from './presentations.js';
import * as users from './users.js';
import * as validator from './validator.js';
import * as zcap from './zcap.js';
export {
  ageCredentialHelpers, capabilities, credentialHelpers, helpers,
  presentations, users, validator, zcap
};
export {
  getCredentialStore, getProfileEdvClient, initialize, profileManager
} from './state.js';
export {documentLoader} from './documentLoader.js';
export {suites as cryptoSuites} from './cryptoSuites.js';
