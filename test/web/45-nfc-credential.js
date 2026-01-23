/*!
 * Copyright (c) 2025-2026 Digital Bazaar, Inc. All rights reserved.
 */
import * as webWallet from '@bedrock/web-wallet';

/**
 * Integration tests using real-world credentials fetched from URLs.
 *
 * These tests verify NFC rendering works with actual production credentials
 * without any modifications to their data model.
 *
 * Test credentials:
 * 1. EAD (Employment Authorization Document) - Legacy NfcRenderingTemplate2024.
 * 2. FirstResponder (EMT) - New TemplateRenderMethod with
 * outputPreference.mode.
 */
describe('NFC Renderer', function() {
  describe('Integration - Real Credentials', function() {

    // =========================================================================
    // EAD Credential - Legacy Format (NfcRenderingTemplate2024)
    // =========================================================================
    describe('EAD Credential (Legacy NfcRenderingTemplate2024)', function() {
      let eadCredential;

      before(async function() {
        this.timeout(10000);

        try {
          const response = await fetch(
            'https://gist.githubusercontent.com/gannan08/' +
            'b03a8943c1ed1636a74e1f1966d24b7c/raw/' +
            'fca19c491e2ab397d9c547e1858ba4531dd4e3bf/full-example-ead.json'
          );

          if(!response.ok) {
            throw new Error(
              `Failed to fetch EAD credential: ${response.status}`);
          }

          eadCredential = await response.json();
          console.log('EAD Credential loaded from URL');
        } catch(error) {
          console.error('Failed to load EAD credential:', error);
          this.skip();
        }
      });

      it('should have NfcRenderingTemplate2024 type in renderMethod',
        function() {
          if(!eadCredential) {
            this.skip();
          }

          // verify credential structure as expected
          should.exist(eadCredential.renderMethod);

          // find NFC render method
          const renderMethods = Array.isArray(eadCredential.renderMethod) ?
            eadCredential.renderMethod : [eadCredential.renderMethod];

          const nfcMethod = renderMethods.find(
            rm => rm.type === 'NfcRenderingTemplate2024'
          );

          should.exist(nfcMethod,
            'Expected NfcRenderingTemplate2024 in credential');
          should.exist(nfcMethod.payload,
            'Expected payload field in legacy format');
        }
      );

      it('should detect NFC support for EAD credential',
        function() {
          if(!eadCredential) {
            this.skip();
          }

          const result = webWallet.nfcRenderer.supportsNfc({
            credential: eadCredential
          });

          should.exist(result);
          result.should.equal(true);
        }
      );

      it('should render EAD credential to NFC bytes',
        async function() {
          if(!eadCredential) {
            this.skip();
          }

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({
              credential: eadCredential
            });
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);
          should.exist(result.bytes);
          result.bytes.should.be.an.instanceof(Uint8Array);
          result.bytes.length.should.be.greaterThan(0);
        }
      );
    });

    // =========================================================================
    // FirstResponder Credential - New Format (TemplateRenderMethod)
    // =========================================================================
    describe('FirstResponder Credential (TemplateRenderMethod)', function() {
      let frCredential;

      before(async function() {
        this.timeout(10000);

        try {
          const response = await fetch(
            'https://gist.githubusercontent.com/bparth24/' +
            'ba5663f641dcadca3f36e75b8151216e/raw/' +
            'e62042e638ab03274c78319efd041d7f91c2206e/' +
            'FirstResponderCredentialWithProofV3.json'
          );

          if(!response.ok) {
            throw new Error(
              `Failed to fetch FirstResponder credential: ${response.status}`
            );
          }

          frCredential = await response.json();
          console.log('FirstResponder Credential loaded from URL');
        } catch(error) {
          console.error('Failed to load FirstResponder credential:', error);
          this.skip();
        }
      });

      it('should have TemplateRenderMethod with NFC mode in renderMethod',
        function() {
          if(!frCredential) {
            this.skip();
          }

          // verify credential structure as expected
          should.exist(frCredential.renderMethod);

          // find NFC render method
          const renderMethods = Array.isArray(frCredential.renderMethod) ?
            frCredential.renderMethod : [frCredential.renderMethod];

          const nfcMethod = renderMethods.find(rm =>
            rm.type === 'TemplateRenderMethod' &&
            rm.outputPreference?.mode?.includes('nfc')
          );

          should.exist(nfcMethod,
            'Expected TemplateRenderMethod with NFC mode in credential'
          );
          should.exist(nfcMethod.template, 'Expected template field');
          should.exist(nfcMethod.outputPreference, 'Expected outputPreference');
          nfcMethod.outputPreference.mode.should.include('nfc');
        }
      );

      it('should detect NFC support for FirstResponder credential',
        function() {
          if(!frCredential) {
            this.skip();
          }

          const result = webWallet.nfcRenderer.supportsNfc({
            credential: frCredential
          });

          should.exist(result);
          result.should.equal(true);
        }
      );

      it('should render FirstResponder credential to NFC bytes',
        async function() {
          if(!frCredential) {
            this.skip();
          }

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({
              credential: frCredential
            });
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);
          should.exist(result.bytes);
          result.bytes.should.be.an.instanceof(Uint8Array);
          result.bytes.length.should.be.greaterThan(0);
        }
      );
    });

    // =========================================================================
    // Credential Structure Inspection (for debugging)
    // =========================================================================
    describe('Credential Structure Inspection', function() {
      let eadCredential;
      let frCredential;

      before(async function() {
        this.timeout(10000);

        try {
          const [eadResponse, frResponse] = await Promise.all([
            fetch(
              'https://gist.githubusercontent.com/gannan08/' +
              'b03a8943c1ed1636a74e1f1966d24b7c/raw/' +
              'fca19c491e2ab397d9c547e1858ba4531dd4e3bf/full-example-ead.json'
            ),
            fetch(
              'https://gist.githubusercontent.com/bparth24/' +
              'ba5663f641dcadca3f36e75b8151216e/raw/' +
              'e62042e638ab03274c78319efd041d7f91c2206e/' +
              'FirstResponderCredentialWithProofV3.json'
            )
          ]);

          if(eadResponse.ok) {
            eadCredential = await eadResponse.json();
          }
          if(frResponse.ok) {
            frCredential = await frResponse.json();
          }
        } catch(error) {
          console.error('Failed to load credentials for inspection:', error);
        }
      });

      it('should log EAD credential renderMethod structure',
        function() {
          if(!eadCredential) {
            this.skip();
          }

          const renderMethods = Array.isArray(eadCredential.renderMethod) ?
            eadCredential.renderMethod : [eadCredential.renderMethod];

          console.log('EAD renderMethod types:',
            renderMethods.map(rm => rm.type));

          const nfcMethod = renderMethods.find(
            rm => rm.type === 'NfcRenderingTemplate2024'
          );
          if(nfcMethod) {
            console.log('EAD NFC method fields:', Object.keys(nfcMethod));
          }
        }
      );

      it('should log FirstResponder credential renderMethod structure',
        function() {
          if(!frCredential) {
            this.skip();
          }

          const renderMethods = Array.isArray(frCredential.renderMethod) ?
            frCredential.renderMethod : [frCredential.renderMethod];

          console.log('FirstResponder renderMethod types:',
            renderMethods.map(rm => rm.type));

          const nfcMethod = renderMethods.find(rm =>
            rm.type === 'TemplateRenderMethod' &&
            rm.outputPreference?.mode?.includes('nfc')
          );
          if(nfcMethod) {
            console.log('FirstResponder NFC method fields:',
              Object.keys(nfcMethod));
            console.log('FirstResponder NFC outputPreference:',
              nfcMethod.outputPreference);
          }
        }
      );
    });
  });
});
