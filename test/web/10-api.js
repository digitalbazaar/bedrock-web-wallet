/*!
 * Copyright (c) 2022-2023 Digital Bazaar, Inc. All rights reserved.
 */
import * as vc from '@digitalbazaar/vc';
import * as webWallet from '@bedrock/web-wallet';
import {
  assertSignedPresentation, createProfile, initializeWebWallet
} from './helpers.js';
import {mockCredential} from './mock-data.js';
import {v4 as uuid} from 'uuid';

describe('presentations.sign()', function() {
  let profile;
  before(async () => {
    // initialize web wallet
    const edvBaseUrl = `${window.location.origin}/edvs`;
    await initializeWebWallet({edvBaseUrl});

    const testEmail = `test-${uuid()}@example.com`;
    const accountId = 'urn:uuid:ffaf5d84-7dc2-4f7b-9825-cc8d2e5a5d06';

    // create a profile for test
    ({profile} = await createProfile({
      name: 'test-profile',
      email: testEmail,
      accountId
    }));
  });
  it('should successfully sign a presentation with default proof type ' +
    '"Ed25519Signature2018"', async () => {
    const profileId = profile.id;
    const presentationId = 'urn:uuid:3e793029-d699-4096-8e74-5ebd956c3137';
    const unsignedPresentation = vc.createPresentation({
      holder: profileId,
      id: presentationId,
      verifiableCredential: mockCredential
    });
    let signedPresentation;
    let err;
    try {
      signedPresentation = await webWallet.presentations.sign({
        challenge: '48456d02-cfb8-4c7f-a50f-1c0d75ceaca1',
        domain: window.location.origin,
        presentation: unsignedPresentation,
        profileId
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(signedPresentation);
    assertSignedPresentation({
      signedPresentation,
      credential: mockCredential,
      presentationId,
      profileId,
      expectedProofType: 'Ed25519Signature2018'
    });
  });
});
