/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
import {createCredentialStores} from '@bedrock/web-wallet';

describe('createCredentialStores()', function() {
  // make local/remote diverge so a mix-up between the two is observable;
  // pre-fix code paired the LOCAL store with the REMOTE options block
  const credentialStoreConfig = {
    local: {options: {addBundleContentsFirst: false}},
    remote: {options: {addBundleContentsFirst: true}}
  };
  // sentinel EDV clients; `ensureIndex` is called during store construction
  const localEdvClient = {id: 'urn:edv:local', ensureIndex: () => {}};
  const remoteEdvClient = {id: 'urn:edv:remote', ensureIndex: () => {}};

  it('should create the local store from its own options and EDV client.',
    async () => {
      const {local} = createCredentialStores({
        credentialStoreConfig, localEdvClient, remoteEdvClient
      });
      // local store must use the LOCAL options block (regression guard:
      // previously it used `remote.options`)
      local.addBundleContentsFirst.should.equal(false);
      // and must be wired to the local EDV client
      local.edvClient.should.equal(localEdvClient);
    });

  it('should create the remote store from its own options and EDV client.',
    async () => {
      const {remote} = createCredentialStores({
        credentialStoreConfig, localEdvClient, remoteEdvClient
      });
      remote.addBundleContentsFirst.should.equal(true);
      remote.edvClient.should.equal(remoteEdvClient);
    });

  it('should not let the local store inherit the remote store\'s options.',
    async () => {
      const {local, remote} = createCredentialStores({
        credentialStoreConfig, localEdvClient, remoteEdvClient
      });
      local.addBundleContentsFirst.should.not.equal(
        remote.addBundleContentsFirst);
    });
});
