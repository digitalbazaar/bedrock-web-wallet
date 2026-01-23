/*!
 * Copyright (c) 2025-2026 Digital Bazaar, Inc. All rights reserved.
 */
import * as webWallet from '@bedrock/web-wallet';

/**
 * Tests for renderToNfc() error handling.
 *
 * Error categories:
 *
 * Missing/invalid credential or renderMethod.
 * Invalid template encoding (unsupported multibase, malformed data URL).
 * Invalid template type (non-string).
 */
describe('NFC Renderer', function() {
  describe('renderToNfc() - Error Cases', function() {
    describe('Missing Credential or RenderMethod', function() {
      it('should fail when credential has no renderMethod',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            credentialSubject: {
              id: 'did:example:123'
            }
          };

          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({credential});
          } catch(e) {
            err = e;
          }

          should.exist(err);
          should.not.exist(result);
          err.message.should.contain('does not support NFC rendering');
        }
      );

      it('should fail when credential parameter is missing',
        async () => {
          let result;
          let err;
          try {
            result = await webWallet.nfcRenderer.renderToNfc({});
          } catch(e) {
            err = e;
          }

          should.exist(err);
          should.not.exist(result);
        }
      );
    });

    describe('Invalid Data URL', function() {
      it('should fail when data URL has wrong media type',
        async () => {
          // NFC templates require application/octet-stream
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:text/plain;base64,SGVsbG8=',
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

          should.exist(err);
          should.not.exist(result);
          err.message.should.contain('media type');
        }
      );

      it('should fail when data URL format is malformed',
        async () => {
          // missing encoding and data portion
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream',
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

          should.exist(err);
          should.not.exist(result);
          err.message.should.contain('Invalid data URL');
        }
      );

      it('should fail when data URL encoding is unsupported',
        async () => {
          // only base64 encoding is supported
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;hex,48656c6c6f',
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

          should.exist(err);
          should.not.exist(result);
          err.message.should.contain('encoding');
        }
      );

      it('should fail when base64 data is invalid',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'data:application/octet-stream;base64,!!!invalid!!!',
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

          should.exist(err);
          should.not.exist(result);
          // error message varies by environment (browser vs Node)
        }
      );
    });

    describe('Invalid Multibase Encoding', function() {
      it('should fail when template has unknown encoding format',
        async () => {
          // doesn't match data URL or multibase pattern
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 'xInvalidEncoding123',
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

          should.exist(err);
          should.not.exist(result);
          err.message.should.contain('encoding format');
        }
      );
    });

    describe('Invalid Template Type', function() {
      it('should fail when template is an object instead of string',
        async () => {
          // W3C spec allows template as object with id/mediaType
          // but current implementation only
          // supports string templates for NFC.
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: {
                id: 'https://example.com/template.bin',
                mediaType: 'application/octet-stream'
              },
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

          should.exist(err);
          should.not.exist(result);
        }
      );

      it('should fail when template is a number',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: 12345,
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

          should.exist(err);
          should.not.exist(result);
        }
      );

      it('should fail when template is null',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'TemplateRenderMethod',
              template: null,
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

          should.exist(err);
          should.not.exist(result);
        }
      );
    });
  });
});
