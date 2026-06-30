/*!
 * Copyright (c) 2026 Digital Bazaar, Inc. All rights reserved.
 */
import {getStoreConstructorArgs, getStoreOptions} from '@bedrock/web-wallet';

describe('getStoreOptions()', function() {
  it('should return the local store\'s own "options" block.', async () => {
    // local and remote options diverge so the source block is observable
    const credentialStore = {
      local: {options: {addBundleContentsFirst: false}},
      remote: {options: {addBundleContentsFirst: true}}
    };
    const options = getStoreOptions({credentialStore, store: 'local'});
    // must reflect the LOCAL value, not the remote one
    options.should.eql({addBundleContentsFirst: false});
  });

  it('should return the remote store\'s own "options" block.', async () => {
    const credentialStore = {
      local: {options: {addBundleContentsFirst: false}},
      remote: {options: {addBundleContentsFirst: true}}
    };
    const options = getStoreOptions({credentialStore, store: 'remote'});
    options.should.eql({addBundleContentsFirst: true});
  });

  it('should throw for an unknown store.', async () => {
    const credentialStore = {
      local: {options: {}},
      remote: {options: {}}
    };
    let err;
    try {
      getStoreOptions({credentialStore, store: 'bogus'});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.message.should.contain('bogus');
  });
});

describe('getStoreConstructorArgs()', function() {
  // make local/remote diverge so a mix-up between the two is observable;
  // pre-fix code paired the LOCAL store with the REMOTE options block
  const credentialStore = {
    local: {options: {addBundleContentsFirst: false, source: 'local'}},
    remote: {options: {addBundleContentsFirst: true, source: 'remote'}}
  };
  // sentinel EDV clients; only identity matters for these assertions
  const localEdvClient = {id: 'urn:edv:local'};
  const remoteEdvClient = {id: 'urn:edv:remote'};

  it('should pair the local store with its own options and EDV client.',
    async () => {
      const {local} = getStoreConstructorArgs({
        credentialStore, localEdvClient, remoteEdvClient
      });
      // local store must use the LOCAL options block (regression guard:
      // previously it used `remote.options`)
      local.source.should.equal('local');
      local.addBundleContentsFirst.should.equal(false);
      // and must be wired to the local EDV client
      local.edvClient.should.equal(localEdvClient);
    });

  it('should pair the remote store with its own options and EDV client.',
    async () => {
      const {remote} = getStoreConstructorArgs({
        credentialStore, localEdvClient, remoteEdvClient
      });
      remote.source.should.equal('remote');
      remote.addBundleContentsFirst.should.equal(true);
      remote.edvClient.should.equal(remoteEdvClient);
    });

  it('should not let the local store inherit the remote store\'s options.',
    async () => {
      const {local, remote} = getStoreConstructorArgs({
        credentialStore, localEdvClient, remoteEdvClient
      });
      local.source.should.not.equal(remote.source);
      local.addBundleContentsFirst.should.not.equal(
        remote.addBundleContentsFirst);
    });
});
