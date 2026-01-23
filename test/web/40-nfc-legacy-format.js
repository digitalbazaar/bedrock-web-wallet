/*!
 * Copyright (c) 2025-2026 Digital Bazaar, Inc. All rights reserved.
 */
import * as webWallet from '@bedrock/web-wallet';

/**
 * Tests for NfcRenderingTemplate2024 legacy format backward compatibility.
 *
 * Legacy format (bedrock-web-wallet existing credentials):
 * {
 *  "type": "NfcRenderingTemplate2024",
 *  "payload": "z..." | "u..." | "data:..."  // required (NOT 'template')
 * }
 *
 * Key differences from TemplateRenderMethod:
 *
 * Uses 'payload' field instead of 'template'
 * No outputPreference object required (type implies NFC)
 * No renderProperty support
 *
 * Note: Detection tests (supportsNfc) are in 15-nfc-support.js.
 * This file focuses on rendering behavior (renderToNfc).
 */
describe('NFC Renderer', function() {
  describe('Legacy Format - NfcRenderingTemplate2024', function() {
    describe('Rendering with payload Field', function() {
      it('should render legacy format with base58 multibase payload',
        async () => {
          // 'z' prefix = base58, encodes "Hello NFC"
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'NfcRenderingTemplate2024',
              payload: 'zvSxRbq4UkKeJ'
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
          decoded.should.equal('Hello NFC');
        }
      );

      it('should render legacy format with base64url multibase payload',
        async () => {
          // 'u' prefix = base64url, encodes "Test Data"
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'NfcRenderingTemplate2024',
              payload: 'uVGVzdCBEYXRh'
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
          decoded.should.equal('Test Data');
        }
      );

      it('should render legacy format with data URL payload',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'NfcRenderingTemplate2024',
              payload: 'data:application/octet-stream;base64,TGVnYWN5IERhdGE='
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
          decoded.should.equal('Legacy Data');
        }
      );
    });

    describe('Field Handling', function() {
      it('should fail when using template field instead of payload',
        async () => {
          // NfcRenderingTemplate2024 MUST use 'payload', not 'template'
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'NfcRenderingTemplate2024',
              template: 'data:application/octet-stream;base64,SGVsbG8='
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
          err.message.should.contain('does not support NFC');
        }
      );

      it('should use payload and ignore template when both present',
        async () => {
          // payload takes precedence for legacy type
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'NfcRenderingTemplate2024',
              payload: 'data:application/octet-stream;base64,UGF5bG9hZCBVc2Vk',
              template:
                'data:application/octet-stream;base64,VGVtcGxhdGUgSWdub3JlZA=='
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
          decoded.should.equal('Payload Used');
          decoded.should.not.equal('Template Ignored');
        }
      );

      it('should ignore unknown fields in legacy format',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'NfcRenderingTemplate2024',
              payload: 'data:application/octet-stream;base64,SGVsbG8gTkZD',
              unknownField: 'ignored',
              anotherUnknown: 12345
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

    describe('Coexistence with TemplateRenderMethod', function() {
      it('should select legacy format from mixed render method array',
        async () => {
          // array with both legacy and modern formats
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: [
              {
                type: 'SvgRenderingTemplate2023',
                template: 'data:image/svg+xml;base64,PHN2Zz4...'
              },
              {
                type: 'NfcRenderingTemplate2024',
                payload: 'data:application/octet-stream;base64,TGVnYWN5IE5GQw=='
              }
            ]
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
          decoded.should.equal('Legacy NFC');
        }
      );

      it('should prefer TemplateRenderMethod over legacy when both have NFC',
        async () => {
          // implementation searches for TemplateRenderMethod first
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: [
              {
                type: 'TemplateRenderMethod',
                template:
                  'data:application/octet-stream;base64,TW9kZXJuIE5GQw==',
                outputPreference: {
                  mode: ['nfc']
                }
              },
              {
                type: 'NfcRenderingTemplate2024',
                payload: 'data:application/octet-stream;base64,TGVnYWN5IE5GQw=='
              }
            ]
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

          // should use modern format (TemplateRenderMethod)
          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('Modern NFC');
        }
      );

      it('should fallback to legacy when TemplateRenderMethod lacks NFC mode',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: [
              {
                type: 'TemplateRenderMethod',
                template: 'data:application/pdf;base64,JVBERi0...',
                outputPreference: {
                  mode: ['print']
                }
              },
              {
                type: 'NfcRenderingTemplate2024',
                payload: 'data:application/octet-stream;base64,TGVnYWN5IE5GQw=='
              }
            ]
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
          decoded.should.equal('Legacy NFC');
        }
      );
    });

    describe('Error Cases', function() {
      it('should fail when payload encoding is invalid',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'NfcRenderingTemplate2024',
              payload: 'xInvalidEncoding'
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

      it('should fail when payload is not a string',
        async () => {
          const credential = {
            '@context': ['https://www.w3.org/ns/credentials/v2'],
            type: ['VerifiableCredential'],
            renderMethod: {
              type: 'NfcRenderingTemplate2024',
              payload: {data: 'invalid'}
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
