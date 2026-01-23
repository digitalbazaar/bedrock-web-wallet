/*!
 * Copyright (c) 2025-2026 Digital Bazaar, Inc. All rights reserved.
 */
import * as webWallet from '@bedrock/web-wallet';

/**
 * Tests for renderToNfc() template decoding functionality.
 *
 * Supported encoding formats:
 *
 * Multibase base58: prefix 'z' (e.g., 'z2drAj5bAkJFsTPKmBvG3Z').
 * Multibase base64url: prefix 'u' (e.g., 'uVGVzdCBEYXRh').
 * Data URL: 'data:application/octet-stream;base64,...'.
 */
describe('NFC Renderer', function() {
  describe('renderToNfc() - Template Decoding', function() {
    describe('Multibase Encoding', function() {
      it('should decode base58 multibase template (z prefix)',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              // 'z' = base58, encodes "Hello NFC"
              template: 'zvSxRbq4UkKeJ',
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);
          should.exist(result.bytes);
          result.bytes.should.be.an.instanceof(Uint8Array);
          result.bytes.length.should.be.greaterThan(0);

          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('Hello NFC');
        }
      );

      it('should decode base64url multibase template (u prefix)',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              // 'u' = base64url, encodes "Test Data"
              template: 'uVGVzdCBEYXRh',
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);
          should.exist(result.bytes);
          result.bytes.should.be.an.instanceof(Uint8Array);

          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('Test Data');
        }
      );
    });

    describe('Data URL Encoding', function() {
      it('should decode data URL with base64 encoding',
        async () => {
          // standard data URL format with octet-stream media type
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,TkZDIERhdGE=',
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);
          should.exist(result.bytes);
          result.bytes.should.be.an.instanceof(Uint8Array);

          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('NFC Data');
        }
      );

      it('should decode data URL with complex base64 payload',
        async () => {
          // larger payload to verify full decoding works
          // encodes: "This is a longer test payload for NFC transmission"
          const base64Payload =
            btoa('This is a longer test payload for NFC transmission');
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: `data:application/octet-stream;base64,${base64Payload}`,
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);

          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should
            .equal('This is a longer test payload for NFC transmission');
        }
      );
    });

    describe('Field Priority', function() {
      it('should use template field and ignore payload field ' +
        'for TemplateRenderMethod',
      async () => {
        // per spec: TemplateRenderMethod uses 'template',
        // unknown fields ignored
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            // "Hello NFC" - this should be used
            template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
            // "Different" - this should be ignored
            payload: 'uRGlmZmVyZW50',
            outputPreference: {
              mode: ['nfc']
            }
          }
        };

        let result;
        let err;
        try {
          result = await webWallet.nfcRenderer.renderToNfc({credential});
        } catch(e) {
          err = e;
        }

        should.not.exist(err);
        should.exist(result);
        should.exist(result.bytes);

        const decoded = new TextDecoder().decode(result.bytes);
        decoded.should.equal('Hello NFC');
        decoded.should.not.equal('Different');
      });
    });

    describe('Decoding with renderProperty', function() {
      it('should decode template when renderProperty is present',
        async () => {
          // currently renderProperty is for transparency,
          // template is still decoded. In the future it might change w.r.t
          // dynamic rendering.
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            credentialSubject: {
              greeting: 'Hello'
            },
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              renderProperty: ['/credentialSubject/greeting'],
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);
          should.exist(result.bytes);

          // decodes template content, NOT the credential field value
          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('Hello NFC');
          decoded.should.not.equal('Hello');
        }
      );

      it('should decode template with multiple renderProperty fields',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            credentialSubject: {
              firstName: 'Alice',
              lastName: 'Smith'
            },
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              renderProperty: [
                '/credentialSubject/firstName',
                '/credentialSubject/lastName'
              ],
              outputPreference: {
                mode: ['nfc']
              }
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.not.exist(err);
          should.exist(result);

          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('Hello NFC');
        }
      );
    });
  });
});
