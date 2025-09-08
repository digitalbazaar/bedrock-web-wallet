/*!
 * Copyright (c) 2022-2023 Digital Bazaar, Inc. All rights reserved.
 */
import * as webWallet from '@bedrock/web-wallet';
import {
  assertSignedPresentation, createProfile, createUnsignedPresentation,
  initializeWebWallet
} from './helpers.js';
import {config} from '@bedrock/web';
import {v4 as uuid} from 'uuid';
import {mockCredential as verifiableCredential} from './mock-data.js';

describe('presentations.sign()', function() {
  let profileId;
  const challenge = '48456d02-cfb8-4c7f-a50f-1c0d75ceaca1';
  const domain = window.location.origin;
  before(async () => {
    // initialize web wallet
    const edvBaseUrl = `${window.location.origin}/edvs`;
    await initializeWebWallet({edvBaseUrl});

    const testEmail = `test-${uuid()}@example.com`;
    const accountId = 'urn:uuid:ffaf5d84-7dc2-4f7b-9825-cc8d2e5a5d06';

    // create a profile for test
    const {profile} = await createProfile({
      name: 'test-profile',
      email: testEmail,
      accountId
    });
    profileId = profile.id;
  });
  it('should successfully sign a presentation with default proof type ' +
    '"Ed25519Signature2018" if no "acceptedProofTypes" is provided.',
  async () => {
    // create unsigned presentation
    const presentationId = `urn:uuid:${uuid()}`;
    const unsignedPresentation = createUnsignedPresentation({
      profileId, verifiableCredential, presentationId
    });
    let signedPresentation;
    let err;
    try {
      signedPresentation = await webWallet.presentations.sign({
        challenge, domain, profileId, presentation: unsignedPresentation,
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(signedPresentation);
    assertSignedPresentation({
      signedPresentation,
      credential: verifiableCredential,
      presentationId,
      profileId,
      expectedProofType: 'Ed25519Signature2018'
    });
  });
  it('should successfully sign a presentation with default proof type ' +
    '"Ed25519Signature2018" if "acceptedProofTypes" is an empty array.',
  async () => {
    // create unsigned presentation
    const presentationId = `urn:uuid:${uuid()}`;
    const unsignedPresentation = createUnsignedPresentation({
      profileId, verifiableCredential, presentationId
    });
    let signedPresentation;
    let err;
    try {
      signedPresentation = await webWallet.presentations.sign({
        challenge, domain, profileId, presentation: unsignedPresentation,
        acceptedProofTypes: []
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(signedPresentation);
    assertSignedPresentation({
      signedPresentation,
      credential: verifiableCredential,
      presentationId,
      profileId,
      expectedProofType: 'Ed25519Signature2018'
    });
  });
  it('should successfully sign a presentation with updated default signature ' +
    'suite if wallet signatureSuite config is changed.',
  async () => {
    // Intentionally change signatureSuite config to eddsa-2022
    config.wallet.defaults.signatureSuite = 'eddsa-2022';
    // create unsigned presentation
    const presentationId = `urn:uuid:${uuid()}`;
    const unsignedPresentation = createUnsignedPresentation({
      profileId, verifiableCredential, presentationId
    });
    let signedPresentation;
    let err;
    try {
      signedPresentation = await webWallet.presentations.sign({
        challenge, domain, profileId, presentation: unsignedPresentation,
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(signedPresentation);
    assertSignedPresentation({
      signedPresentation,
      credential: verifiableCredential,
      presentationId,
      profileId,
      expectedProofType: 'DataIntegrityProof',
      expectedCryptosuite: 'eddsa-2022'
    });
  });
  it('should successfully sign a presentation with "acceptedProofTypes" ' +
    '"eddsa-2022".', async () => {
    // create unsigned presentation
    const presentationId = `urn:uuid:${uuid()}`;
    const unsignedPresentation = createUnsignedPresentation({
      profileId, verifiableCredential, presentationId
    });
    let signedPresentation;
    let err;
    try {
      signedPresentation = await webWallet.presentations.sign({
        challenge, domain, profileId, presentation: unsignedPresentation,
        acceptedProofTypes: [{name: 'eddsa-2022'}]
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(signedPresentation);
    assertSignedPresentation({
      signedPresentation,
      credential: verifiableCredential,
      presentationId,
      profileId,
      expectedProofType: 'DataIntegrityProof',
      expectedCryptosuite: 'eddsa-2022'
    });
  });
  it('should successfully sign a presentation with "acceptedProofTypes" ' +
    '"eddsa-rdfc-2022".', async () => {
    // create unsigned presentation
    const presentationId = `urn:uuid:${uuid()}`;
    const unsignedPresentation = createUnsignedPresentation({
      profileId, verifiableCredential, presentationId
    });
    let signedPresentation;
    let err;
    try {
      signedPresentation = await webWallet.presentations.sign({
        challenge, domain, profileId, presentation: unsignedPresentation,
        acceptedProofTypes: [{name: 'eddsa-rdfc-2022'}]
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(signedPresentation);
    assertSignedPresentation({
      signedPresentation,
      credential: verifiableCredential,
      presentationId,
      profileId,
      expectedProofType: 'DataIntegrityProof',
      expectedCryptosuite: 'eddsa-rdfc-2022'
    });
  });
  it('should successfully sign a presentation with "acceptedProofTypes" ' +
    '"Ed25519Signature2020".', async () => {
    // create unsigned presentation
    const presentationId = `urn:uuid:${uuid()}`;
    const unsignedPresentation = createUnsignedPresentation({
      profileId, verifiableCredential, presentationId
    });
    let signedPresentation;
    let err;
    try {
      signedPresentation = await webWallet.presentations.sign({
        challenge, domain, profileId, presentation: unsignedPresentation,
        acceptedProofTypes: [{name: 'Ed25519Signature2020'}]
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(signedPresentation);
    assertSignedPresentation({
      signedPresentation,
      credential: verifiableCredential,
      presentationId,
      profileId,
      expectedProofType: 'Ed25519Signature2020'
    });
  });
  it('should successfully sign a presentation with the first type specified ' +
    'in the "acceptedProofTypes" list if all are supported.', async () => {
    // create unsigned presentation
    const presentationId = `urn:uuid:${uuid()}`;
    const unsignedPresentation = createUnsignedPresentation({
      profileId, verifiableCredential, presentationId
    });
    let signedPresentation;
    let err;
    try {
      signedPresentation = await webWallet.presentations.sign({
        challenge, domain, profileId, presentation: unsignedPresentation,
        acceptedProofTypes: [
          {name: 'eddsa-2022'},
          {name: 'Ed25519Signature2018'},
          {name: 'Ed25519Signature2020'},
        ]
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(signedPresentation);
    assertSignedPresentation({
      signedPresentation,
      credential: verifiableCredential,
      presentationId,
      profileId,
      expectedProofType: 'DataIntegrityProof',
      expectedCryptosuite: 'eddsa-2022'
    });
  });
  it('should successfully sign a presentation with the supported type ' +
    'from the "acceptedProofTypes" list.', async () => {
    const acceptedProofTypes = [
      [
        {name: 'unsupportedType'},
        {name: 'eddsa-2022'},
      ],
      [
        {name: 'unsupportedType'},
        {name: 'eddsa-2022'},
        {name: 'unsupportedType'},
      ]
    ];
    let signedPresentation;
    let err;
    for(const proofTypes of acceptedProofTypes) {
      // create unsigned presentation
      const presentationId = `urn:uuid:${uuid()}`;
      const unsignedPresentation = createUnsignedPresentation({
        profileId, verifiableCredential, presentationId
      });
      try {
        signedPresentation = await webWallet.presentations.sign({
          challenge, domain, profileId, presentation: unsignedPresentation,
          acceptedProofTypes: proofTypes
        });
      } catch(e) {
        err = e;
      }
      should.not.exist(err);
      should.exist(signedPresentation);
      assertSignedPresentation({
        signedPresentation,
        credential: verifiableCredential,
        presentationId,
        profileId,
        expectedProofType: 'DataIntegrityProof',
        expectedCryptosuite: 'eddsa-2022'
      });
    }
  });
  it('should fail to sign a presentation if all the types specified in ' +
    'the "acceptedProofTypes" list are unsupported.', async () => {
    // create unsigned presentation
    const presentationId = `urn:uuid:${uuid()}`;
    const unsignedPresentation = createUnsignedPresentation({
      profileId, verifiableCredential, presentationId
    });
    let signedPresentation;
    let err;
    try {
      signedPresentation = await webWallet.presentations.sign({
        challenge, domain, profileId, presentation: unsignedPresentation,
        acceptedProofTypes: [
          {name: 'unsupportedType'},
          {name: 'unsupportedType'},
          {name: 'unsupportedType'},
        ]
      });
    } catch(e) {
      err = e;
    }
    should.exist(err);
    should.not.exist(signedPresentation);
    err.message.should.contain(
      'No supported proof type matches one of the accepted proof types'
    );
  });
});

describe('presentations.match()', function() {
  it('should match credentials using Query By Example with batch ' +
    'processing',
  async () => {

    // Create a mock credential store with test credentials
    const mockCredentialStore = {
      local: {
        // Empty local store for simplicity
        find: async () => ({documents: []})
      },
      remote: {
        find: async () => {
          // Return mock credentials that match our test
          const mockCredentials = [
            {
              content: {
                '@context': ['https://www.w3.org/2018/credentials/v1'],
                type: ['VerifiableCredential', 'UniversityDegreeCredential'],
                credentialSubject: {
                  id: 'did:example:test1',
                  name: 'Alice',
                  degree: {
                    type: 'BachelorDegree',
                    name: 'Bachelor of Computer Science'
                  }
                }
              },
              meta: {id: 'credential-1'}
            },
            {
              content: {
                '@context': ['https://www.w3.org/2018/credentials/v1'],
                type: ['VerifiableCredential', 'DriverLicense'],
                credentialSubject: {
                  id: 'did:example:test2',
                  name: 'Bob'
                }
              },
              meta: {id: 'credential-2'}
            }
          ];

          // Simple mock: return all credentials,
          // let presentations.js do the filtering
          return {documents: mockCredentials};
        },
        convertVPRQuery: async () => {
          // Mock conversion - return a simple query
          return {queries: [{}]};
        }
      }
    };

    // Create VPR that should match only the university degree credential
    const verifiablePresentationRequest = {
      query: {
        type: 'QueryByExample',
        credentialQuery: {
          example: {
            type: 'UniversityDegreeCredential',
            credentialSubject: {
              degree: {
                type: 'BachelorDegree'
              }
            }
          }
        }
      }
    };

    // Call presentations.match() - this should trigger your batch processing!
    const {flat: matches} = await webWallet.presentations.match({
      verifiablePresentationRequest,
      credentialStore: mockCredentialStore
    });

    // Verify results
    matches.should.have.length(1);
    matches[0].record.content.credentialSubject.name.should.equal('Alice');
    matches[0].record.content.type
      .should.include('UniversityDegreeCredential');
  });
});
