/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
import * as webWallet from '@bedrock/web-wallet';
import {createProfile, initializeWebWallet} from './helpers.js';

describe('helpers.createCapabilities()', function() {
  let profileId;
  before(async () => {
    // initialize web wallet
    const edvBaseUrl = `${window.location.origin}/edvs`;
    await initializeWebWallet({edvBaseUrl});

    const testEmail = `test-${globalThis.crypto.randomUUID()}@example.com`;
    // must match the account authorized by the test passport mock in `test.js`
    const accountId = 'urn:uuid:ffaf5d84-7dc2-4f7b-9825-cc8d2e5a5d06';

    // create a profile for test; this provisions a `profile:core:edv` meter
    const {profile} = await createProfile({
      name: 'test-profile',
      email: testEmail,
      accountId
    });
    profileId = profile.id;
  });
  it('should create an EDV documents capability.', async () => {
    // exercises the `urn:edv:documents` branch, which previously threw
    // `TypeError: profileManager.getMeters is not a function` because the
    // pinned `@bedrock/web-profile-manager` renamed `getMeters()` to
    // `getProfileMeters()` and changed its return shape (see issue #118)
    let capabilities;
    let err;
    try {
      capabilities = await webWallet.helpers.createCapabilities({
        profileId,
        request: {
          invocationTarget: {type: 'urn:edv:documents'},
          controller: profileId,
          allowedAction: ['read', 'write']
        }
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(capabilities);
    capabilities.should.be.an('array');
    capabilities.length.should.equal(1);
    const [zcap] = capabilities;
    zcap.should.have.property('invocationTarget');
    zcap.invocationTarget.should.be.a('string');
    zcap.invocationTarget.should.match(/\/documents$/);
  });
});
