/*!
 * Copyright (c) 2022-2023 Digital Bazaar, Inc. All rights reserved.
 */
import * as vc from '@digitalbazaar/vc';
import * as webWallet from '@bedrock/web-wallet';
import {createAccount, createProfile} from './helpers.js';
import {mockCredential} from './mock-data.js';
import {v4 as uuid} from 'uuid';

describe('presentations.sign()', function() {
  let profile;
  before(async () => {
    // create an account for test
    const testEmail = `test-${uuid()}@example.com`;
    await createAccount({email: testEmail});
    // initialize web wallet
    await webWallet.initialize();
    // create a profile
    const profile = await createProfile({
      name: 'br-web-wallet-test',
      email: testEmail
    });
    console.log(profile, '<><><><>profile');
  });
  it('should successfully sign a presentation with accepted proof type ' +
    'eddsa-2022', async () => {
    const profileId = profile.id;
    const unsignedPresentation = vc.createPresentation({
      holder: profileId,
      id: 'urn:uuid:3e793029-d699-4096-8e74-5ebd956c3137',
      verifiableCredential: mockCredential
    });
    let signedPresentation;
    try {
      signedPresentation = await webWallet.presentations.sign({
        challenge: '48456d02-cfb8-4c7f-a50f-1c0d75ceaca1',
        domain: window.location.origin,
        presentation: unsignedPresentation,
        profileId,
        acceptedProofTypes: ['eddsa-2022']
      });
    } catch(e) {
      console.log(e);
    }
    console.log(signedPresentation);
  });
});
