/*!
 * Copyright (c) 2015-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from 'bedrock-web';

// set bedrock-web-wallet default config
config.wallet = {
  // FIXME: do not use `referenceId` and put that information on the server,
  // rather have profile agent information store a location to read EDV IDs
  // from based on local names; remove this from the shared web app config
  DEFAULT_EDVS: {
    users: _getReferenceId('users'),
    credentials: _getReferenceId('credentials'),
  },
  defaultSignatureSuite: 'Ed25519Signature2018'
};

function _getReferenceId(name) {
  return `${encodeURIComponent(window.location.hostname)}:` +
    `${encodeURIComponent(name)}`;
}
