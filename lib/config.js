/*!
 * Copyright (c) 2015-2022 Digital Bazaar, Inc. All rights reserved.
 */
export const config = {
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
