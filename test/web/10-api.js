/*!
 * Copyright (c) 2022-2023 Digital Bazaar, Inc. All rights reserved.
 */
import * as vc from '@digitalbazaar/vc';
import * as webWallet from '@bedrock/web-wallet';
import {
  assertSignedPresentation, createProfile, initializeWebWallet
} from './helpers.js';
import {v4 as uuid} from 'uuid';
import {mockCredential as verifiableCredential} from './mock-data.js';

describe('presentations.sign()', function() {
  let profileId;
  let unsignedPresentation;
  const presentationId = 'urn:uuid:3e793029-d699-4096-8e74-5ebd956c3137';
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
    // create an unsigned presentation
    unsignedPresentation = vc.createPresentation({
      holder: profileId,
      id: presentationId,
      verifiableCredential
    });
  });
  it('should successfully sign a presentation with default proof type ' +
    '"Ed25519Signature2018" if no "acceptedProofTypes" is provided.',
  async () => {
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
      acceptedProofTypes: 'Ed25519Signature2018'
    });
  });
  it('should successfully sign a presentation with default proof type ' +
    '"Ed25519Signature2018" if "acceptedProofTypes" is an empty array.',
  async () => {
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
  it('should successfully sign a presentation with "acceptedProofTypes" ' +
    'eddsa-2022.', async () => {
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
      cryptosuite: 'eddsa-2022'
    });
  });
});
