/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
import * as webWallet from '@bedrock/web-wallet';

const {exchanges} = webWallet;

// served by the mock routes in `test.js`
const interactionUrl = id =>
  `${window.location.origin}/test/interactions/${id}?iuv=1`;

describe('exchanges.createClientInteractionFromUrl()', function() {
  it('should create an interaction from an interaction URL.', async () => {
    const interaction = await exchanges.createClientInteractionFromUrl({
      interactionUrl: interactionUrl('z1')
    });
    interaction.origin.should.equal(window.location.origin);
    const protocols = await interaction.getProtocols();
    protocols.vcapi.should.equal(
      `${window.location.origin}/test/exchanges/z1`);
  });
  it('should fail when the URL has no "iuv=1".', async () => {
    let err;
    try {
      await exchanges.createClientInteractionFromUrl({
        interactionUrl: `${window.location.origin}/test/interactions/z1`
      });
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('NotSupportedError');
  });
  it('should fail when the URL is not "https:".', async () => {
    let err;
    try {
      await exchanges.createClientInteractionFromUrl({
        interactionUrl: 'http://localhost/test/interactions/z1?iuv=1'
      });
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('NotSupportedError');
  });
  it('should fail when the protocols cannot be fetched.', async () => {
    let err;
    try {
      await exchanges.createClientInteractionFromUrl({
        interactionUrl: `${window.location.origin}/test/not-found?iuv=1`
      });
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('DataError');
  });
});

describe('exchanges.start()', function() {
  it('should fail without an event or an interaction.', async () => {
    let err;
    try {
      await exchanges.start();
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('TypeError');
  });
  it('should start a VC-API exchange without a CHAPI event.', async () => {
    const interaction = await exchanges.createClientInteractionFromUrl({
      interactionUrl: interactionUrl('z2')
    });
    const exchange = await exchanges.start({interaction});
    exchange.protocol.should.equal('vcapi');
    // the mock exchange answers with a VPR
    const {value, done} = await exchange.next();
    done.should.equal(false);
    value.verifiablePresentationRequest.challenge.should.equal('z2');
  });
  it('should fail when no protocol is supported.', async () => {
    const interaction = await exchanges.createClientInteractionFromUrl({
      interactionUrl: interactionUrl('unsupported')
    });
    let err;
    try {
      await exchanges.start({interaction});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.message.should.equal(
      'The interaction is not compatible with this wallet.');
  });
});

describe('exchanges.isInteractionUrl()', function() {
  it('should accept an "https:" URL with "iuv=1".', async () => {
    exchanges.isInteractionUrl({url: interactionUrl('z3')}).should.equal(true);
  });
  it('should reject a URL without "iuv=1".', async () => {
    exchanges.isInteractionUrl({
      url: `${window.location.origin}/test/interactions/z3`
    }).should.equal(false);
  });
  it('should reject a URL that is not "https:".', async () => {
    exchanges.isInteractionUrl({
      url: 'http://localhost/test/interactions/z3?iuv=1'
    }).should.equal(false);
  });
  it('should reject a value that is not a URL.', async () => {
    exchanges.isInteractionUrl({url: 'not a URL'}).should.equal(false);
  });
});
