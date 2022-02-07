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
  defaultSignatureSuite: 'Ed25519Signature2018',
  credentialStorage: {
    defaults: {
      stores: {
        local: false,
        remote: {
          meta: {displayable: true}
        }
      }
    },
    types: {
      'https://w3id.org/age/v1': {
        AgeVerificationCredential: {
          stores: {
            local: {
              meta: {
                dependent: true,
                displayable: false
              }
            },
            remote: {
              meta: {
                dependent: true,
                displayable: false
              }
            }
          }
        },
        OverAgeTokenCredential: {
          stores: {
            local: {
              meta: {
                dependent: true,
                displayable: false
              }
            },
            remote: false
          },
          // FIXME: determine the right location for this
          virtualProperties: {
            name: 'Over Age Token Credential',
            description:
              'This credential can be used to prove that you are over ' +
              'a particular age.'
          }
        },
        PersonalPhotoCredential: {
          stores: {
            local: {
              meta: {
                dependent: true,
                displayable: false
              }
            },
            remote: {
              meta: {
                dependent: true,
                displayable: false
              }
            }
          }
        },
        AgeVerificationContainerCredential: {
          stores: {
            local: {
              meta: {displayable: false}
            },
            remote: {
              meta: {displayable: false}
            }
          },
          bundle: {
            // bundle definition
            include: {
              // qualified types
              AgeVerificationCredential: 'https://w3id.org/age/v1',
              OverAgeTokenCredential: 'https://w3id.org/age/v1',
              PersonalPhotoCredential: 'https://w3id.org/age/v1'
            }
          }
        }
      }
    }
  }
};

function _getReferenceId(name) {
  return `${encodeURIComponent(window.location.hostname)}:` +
    `${encodeURIComponent(name)}`;
}
