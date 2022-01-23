/*!
 * Copyright (c) 2015-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from 'bedrock-web';

// re-export shared config
export {config};

// set bedrock-web-wallet default config
config.wallet = {
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
