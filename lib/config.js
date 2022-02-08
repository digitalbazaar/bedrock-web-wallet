/*!
 * Copyright (c) 2015-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {config} from 'bedrock-web';

// set bedrock-web-wallet default config
config.wallet = {
  defaults: {
    edvBaseUrl: `https://localhost:55443/edvs`,
    // FIXME: do not use `referenceId` and put that information on the server,
    // rather have profile agent information store a location to read EDV IDs
    // from based on local names; remove this from the shared web app config
    edvs: {
      users: _getReferenceId('users'),
      credentials: _getReferenceId('credentials')
    },
    kmsBaseUrl: `https://localhost:50443/kms`,
    kmsModule: 'ssm-v1',
    signatureSuite: 'Ed25519Signature2018'
  },
  caches: {
    edvClients: {
      // 24 hr
      maxAge: 24 * 60 * 60 * 5000
    },
    credentialStores: {
      // 24 hr
      maxAge: 24 * 60 * 60 * 5000
    }
  },
  credentialStore: {
    local: {
      defaults: {
        store: false
      },
      // filters are defined in priority order
      filters: [{
        context: 'https://w3id.org/age/v1',
        type: 'AgeVerificationContainerCredential',
        // local version is displayable
        meta: {displayable: true},
        // local version bundles over age tokens
        bundleContents: [{
          context: 'https://w3id.org/age/v1',
          type: 'AgeVerificationCredential',
          dependent: true,
          meta: {displayable: false},
          bundleContents: [{
            context: 'https://w3id.org/age/v1',
            type: 'PersonalPhotoCredential',
            dependent: true,
            meta: {displayable: false}
          }]
        }, {
          context: 'https://w3id.org/age/v1',
          type: 'OverAgeTokenCredential',
          dependent: true,
          meta: {displayable: false}
        }]
      }]
    },
    remote: {
      defaults: {
        meta: {displayable: true}
      },
      // filters are defined in priority order
      filters: [{
        context: 'https://w3id.org/age/v1',
        type: 'AgeVerificationContainerCredential',
        // remote version is not displayable
        meta: {displayable: false},
        // remote version does not bundle overage tokens
        bundleContents: [{
          context: 'https://w3id.org/age/v1',
          type: 'AgeVerificationCredential',
          dependent: true,
          meta: {displayable: false},
          contents: [{
            context: 'https://w3id.org/age/v1',
            type: 'PersonalPhotoCredential',
            dependent: true,
            meta: {displayable: false}
          }]
        }]
      }, {
        context: 'https://w3id.org/age/v1',
        type: 'OverAgeTokenCredential',
        store: false
      }]
    }
  }
};

function _getReferenceId(name) {
  return `${encodeURIComponent(window.location.hostname)}:` +
    `${encodeURIComponent(name)}`;
}
