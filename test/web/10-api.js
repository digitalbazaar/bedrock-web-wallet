/*!
 * Copyright (c) 2022-2026 Digital Bazaar, Inc. All rights reserved.
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
  it('should successfully sign a presentation with default cryptosuite ' +
    '"eddsa-rdfc-2022" if no "acceptedCryptosuites" is provided.',
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
      expectedProofType: 'DataIntegrityProof',
      expectedCryptosuite: 'eddsa-rdfc-2022'
    });
  });
  it('should successfully sign a presentation with default cryptosuite ' +
    '"eddsa-rdfc-2022" if "acceptedCryptosuites" is an empty array.',
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
        acceptedCryptosuites: []
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
  it('should successfully sign a presentation with updated default signature ' +
    'suite if wallet signatureSuite config is changed.',
  async () => {
    // Intentionally change signatureSuite config to Ed25519Signature2020
    config.wallet.defaults.signatureSuite = 'Ed25519Signature2020';
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
      expectedProofType: 'Ed25519Signature2020'
    });
  });
  it('should successfully sign a presentation with "acceptedCryptosuites" ' +
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
        acceptedCryptosuites: [{cryptosuite: 'eddsa-rdfc-2022'}]
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
  it('should successfully sign a presentation with "acceptedCryptosuites" ' +
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
        acceptedCryptosuites: [{cryptosuite: 'Ed25519Signature2020'}]
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
    'in the "acceptedCryptosuites" list if all are supported.', async () => {
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
        acceptedCryptosuites: [
          {cryptosuite: 'eddsa-rdfc-2022'},
          {cryptosuite: 'Ed25519Signature2020'},
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
      expectedCryptosuite: 'eddsa-rdfc-2022'
    });
  });
  it('should successfully sign a presentation with the supported type ' +
    'from the "acceptedCryptosuites" list.', async () => {
    const acceptedCryptosuites = [
      [
        {cryptosuite: 'unsupportedType'},
        {cryptosuite: 'eddsa-rdfc-2022'},
      ],
      [
        {cryptosuite: 'unsupportedType1'},
        {cryptosuite: 'eddsa-rdfc-2022'},
        {cryptosuite: 'unsupportedType2'},
      ]
    ];
    let signedPresentation;
    let err;
    for(const cryptosuites of acceptedCryptosuites) {
      // create unsigned presentation
      const presentationId = `urn:uuid:${uuid()}`;
      const unsignedPresentation = createUnsignedPresentation({
        profileId, verifiableCredential, presentationId
      });
      try {
        signedPresentation = await webWallet.presentations.sign({
          challenge, domain, profileId, presentation: unsignedPresentation,
          acceptedCryptosuites: cryptosuites
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
    }
  });
  it('should fail to sign a presentation if all the types specified in ' +
    'the "acceptedCryptosuites" list are unsupported.', async () => {
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
        acceptedCryptosuites: [
          {cryptosuite: 'unsupportedType1'},
          {cryptosuite: 'unsupportedType2'},
          {cryptosuite: 'unsupportedType3'},
        ]
      });
    } catch(e) {
      err = e;
    }
    should.exist(err);
    should.not.exist(signedPresentation);
    err.message.should.contain(
      'No supported cryptosuite matches one of the accepted cryptosuites');
  });
});
