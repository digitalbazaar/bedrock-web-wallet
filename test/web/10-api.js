/*!
 * Copyright (c) 2022-2023 Digital Bazaar, Inc. All rights reserved.
 */
import * as vc from '@digitalbazaar/vc';
import * as webWallet from '@bedrock/web-wallet';
import {mockCredential} from './mock-data.js';
import {v4 as uuid} from 'uuid';

describe('presentations.sign()', function() {
  let profile;
  before(async () => {
    // initialize web wallet
    await webWallet.initialize();
    const testEmail = `test-${uuid()}@email.com`;
    // create a profile
    const profileContent = {
      name: 'test',
      shared: false,
      type: [
        'User',
        'Person'
      ]
    };
    const profileAgentContent = {
      email: testEmail,
      name: 'root',
      type: ['User', 'Person'],
      access: 'full'
    };
    const profileOptions = {
      didMethod: 'v1',
      didOptions: {
        mode: 'test'
      }
    };
    ({profile} = await webWallet.helpers.createProfile({
      profileAgentContent, profileContent, profileOptions
    }));
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
