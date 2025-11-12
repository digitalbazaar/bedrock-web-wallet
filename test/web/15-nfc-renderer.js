import * as webWallet from '@bedrock/web-wallet';
// console.log(webWallet.nfcRenderer);
// console.log(typeof webWallet.nfcRenderer.supportsNFC);

describe('NFC Renderer', function() {
  describe('supportsNFC()', function() {
    // Test to verify if a credential supports NFC rendering.
    it('should return true for credential with nfc-static renderSuite',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc-static',
            template: 'z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2rJQ'
          }
        };

        const result = webWallet.nfcRenderer.supportsNFC({credential});
        should.exist(result);
        result.should.equal(true);
      }
    );

    it('should return true for credential with nfc-dynamic renderSuite',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123',
            name: 'John Doe'
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc-dynamic',
            renderProperty: ['/credentialSubject/name']
          }
        };

        const result = webWallet.nfcRenderer.supportsNFC({credential});
        should.exist(result);
        result.should.equal(true);
      }
    );

    it('should return true for credential with generic nfc renderSuite',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            template: 'z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2rJQ'
          }
        };

        const result = webWallet.nfcRenderer.supportsNFC({credential});
        should.exist(result);
        result.should.equal(true);
      }
    );

    it('should work with legacy NfcRenderingTemplate2024 using payload field',
      async () => {
        const credential = {
          renderMethod: {
            type: 'NfcRenderingTemplate2024',
            // Using 'payload', not 'template'
            payload: 'z2drAj5bAkJFsTPKmBvG3Z'
          }
        };
        const result = await webWallet.nfcRenderer.renderToNfc({credential});
        should.exist(result.bytes);
      }
    );

    it('should return true for legacy NfcRenderingTemplate2024 type',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'NfcRenderingTemplate2024',
            template: 'z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2rJQ'
          }
        };

        const result = webWallet.nfcRenderer.supportsNFC({credential});
        should.exist(result);
        result.should.equal(true);
      }
    );

    it('should return true for credential with renderMethod array',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: [
            {
              type: 'SvgRenderingTemplate2023',
              template: 'some-svg-data'
            },
            {
              type: 'TemplateRenderMethod',
              renderSuite: 'nfc-static',
              template: 'z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2rJQ'
            }
          ]
        };

        const result = webWallet.nfcRenderer.supportsNFC({credential});
        should.exist(result);
        result.should.equal(true);
      }
    );

    it('should return false for credential without renderMethod',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123'
          }
        };

        const result = webWallet.nfcRenderer.supportsNFC({credential});
        should.exist(result);
        result.should.equal(false);
      }
    );

    it('should return false for credential with non-NFC renderMethod',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'SvgRenderingTemplate2023',
            template: 'some-svg-data'
          }
        };

        const result = webWallet.nfcRenderer.supportsNFC({credential});
        should.exist(result);
        result.should.equal(false);
      }
    );
  });

  describe('renderToNfc() - Static Rendering', function() {
    it('should successfully render static NFC with multibase-encoded template',
      async () => {
        // Base58 encoded "Hello NFC"
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc-static',
            template: 'z2drAj5bAkJFsTPKmBvG3Z'
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
      }
    );

    it('should successfully render static NFC with base64url-encoded payload',
      async () => {
        // Base64URL encoded "Test Data"
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc-static',
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
        should.exist(result.bytes);
        result.bytes.should.be.an.instanceof(Uint8Array);
      }
    );

    it('should successfully render static NFC with data URI format',
      async () => {
        // Base64 encoded "NFC Data"
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc-static',
            template: 'data:application/octet-stream;base64,TkZDIERhdGE='
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
        // Verify decoded content
        const decoded = new TextDecoder().decode(result.bytes);
        decoded.should.equal('NFC Data');
      }
    );

    it('should use template field when both template and payload exist',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc-static',
            // "Hello NFC"
            template: 'z2drAj5bAkJFsTPKmBvG3Z',
            // "Different"
            payload: 'uRGlmZmVyZW50'
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
      }
    );

    it('should work with legacy NfcRenderingTemplate2024 type',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'NfcRenderingTemplate2024',
            template: 'z2drAj5bAkJFsTPKmBvG3Z'
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
      }
    );

    it('should fail when static payload is missing',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc-static'
            // No template or payload field
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
        err.message.should.contain('template or payload');
      }
    );

    it('should fail when payload encoding is invalid',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc-static',
            template: 'xInvalidEncoding123'
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

  describe('renderToNfc() - Dynamic Rendering', function() {
    it('should successfully render dynamic NFC with single renderProperty',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123',
            name: 'Alice Smith'
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc-dynamic',
            renderProperty: ['/credentialSubject/name']
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
        // Verify content
        const decoded = new TextDecoder().decode(result.bytes);
        decoded.should.equal('Alice Smith');
      }
    );

    it('should successfully render dynamic NFC with multiple renderProperty',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123',
            firstName: 'Alice',
            lastName: 'Smith'
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc-dynamic',
            renderProperty: [
              '/credentialSubject/firstName',
              '/credentialSubject/lastName'
            ]
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
        // Verify content (concatenated)
        const decoded = new TextDecoder().decode(result.bytes);
        decoded.should.equal('AliceSmith');
      }
    );

    it('should handle numeric values in dynamic rendering',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123',
            age: 25
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc-dynamic',
            renderProperty: ['/credentialSubject/age']
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
        decoded.should.equal('25');

      }
    );

    it('should handle object values in dynamic rendering',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123',
            address: {
              street: '123 Main St',
              city: 'Boston'
            }
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc-dynamic',
            renderProperty: ['/credentialSubject/address']
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
        // Should be JSON stringified
        const decoded = new TextDecoder().decode(result.bytes);
        const parsed = JSON.parse(decoded);
        parsed.street.should.equal('123 Main St');
        parsed.city.should.equal('Boston');
      }
    );

    it('should handle array access in JSON pointer',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123',
            skills: ['JavaScript', 'Python', 'Rust']
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc-dynamic',
            renderProperty: ['/credentialSubject/skills/0']
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
        decoded.should.equal('JavaScript');
      }
    );

    it('should handle special characters in JSON pointer',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123',
            'field/with~slash': 'test-value'
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc-dynamic',
            renderProperty: ['/credentialSubject/field~1with~0slash']
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
        decoded.should.equal('test-value');
      }
    );

    it('should fail when renderProperty is missing',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123',
            name: 'Alice'
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc-dynamic'
            // No renderProperty
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
        err.message.should.contain('renderProperty');
      }
    );

    it('should fail when renderProperty path does not exist',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123',
            name: 'Alice'
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc-dynamic',
            renderProperty: ['/credentialSubject/nonExistentField']
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
        err.message.should.contain('Property not found');
      }
    );

    it('should fail when renderProperty is empty array',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123'
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc-dynamic',
            renderProperty: []
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
        err.message.should.contain('cannot be empty');
      }
    );
  });

  describe('renderToNfc() - Generic NFC Suite', function() {
    it('should prioritize static rendering when both payload and ' +
      'renderProperty exist', async () => {
      const credential = {
        '@context': ['https://www.w3.org/ns/credentials/v2'],
        type: ['VerifiableCredential'],
        credentialSubject: {
          id: 'did:example:123',
          name: 'Alice'
        },
        renderMethod: {
          type: 'TemplateRenderMethod',
          renderSuite: 'nfc',
          // "Hello NFC"
          template: 'z2drAj5bAkJFsTPKmBvG3Z',
          renderProperty: ['/credentialSubject/name']
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
      // Should use static rendering (template), not dynamic
      const decoded = new TextDecoder().decode(result.bytes);
      // If it was dynamic, it would be "Alice"
      decoded.should.not.equal('Alice');
    });

    it('should fallback to dynamic rendering when only renderProperty exists',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123',
            name: 'Bob'
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc',
            renderProperty: ['/credentialSubject/name']
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
        decoded.should.equal('Bob');
      }
    );

    it('should fail when neither payload nor renderProperty exist',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          credentialSubject: {
            id: 'did:example:123'
          },
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'nfc'
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
        err.message.should.contain('neither payload nor renderProperty');
      }
    );
  });

  describe('renderToNfc() - Error Cases', function() {
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

    it('should fail when renderSuite is unsupported',
      async () => {
        const credential = {
          '@context': ['https://www.w3.org/ns/credentials/v2'],
          type: ['VerifiableCredential'],
          renderMethod: {
            type: 'TemplateRenderMethod',
            renderSuite: 'unsupported-suite',
            template: 'some-data'
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

  describe('NFC Renderer - EAD Credential Tests (from URL)', function() {
    let eadCredential;

    // Fetch the credential once before all tests
    before(async function() {
      // Increase timeout for network request
      this.timeout(5000);

      try {
        const response = await fetch(
          'https://gist.githubusercontent.com/gannan08/b03a8943c1ed1636a74e1f1966d24b7c/raw/fca19c491e2ab397d9c547e1858ba4531dd4e3bf/full-example-ead.json'
        );

        if(!response.ok) {
          throw new Error(`Failed to fetch credential: ${response.status}`);
        }

        eadCredential = await response.json();
        console.log('✓ EAD Credential loaded from URL');
      } catch(error) {
        console.error('Failed to load EAD credential:', error);
        // Skip all tests if credential can't be loaded
        this.skip();
      }
    });

    describe('supportsNFC() - EAD from URL', function() {
      it('should return false for EAD credential without renderMethod',
        function() {
          // Skip if credential wasn't loaded
          if(!eadCredential) {
            this.skip();
          }

          // Destructure to exclude renderMethod
          // Create credential copy without renderMethod
          const credentialWithoutRenderMethod = {...eadCredential};
          delete credentialWithoutRenderMethod.renderMethod;

          const result = webWallet.nfcRenderer.supportsNFC({
            credential: credentialWithoutRenderMethod
          });

          should.exist(result);
          result.should.equal(false);
        }
      );

      it('should return true for EAD credential with renderMethod',
        function() {
          if(!eadCredential) {
            this.skip();
          }

          const result = webWallet.nfcRenderer.supportsNFC({
            credential: eadCredential
          });

          should.exist(result);
          result.should.equal(true);
        }
      );

      it('should return true when adding nfc-dynamic renderMethod',
        function() {
          if(!eadCredential) {
            this.skip();
          }

          const credentialWithDynamic = {
            ...eadCredential,
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderSuite: 'nfc-dynamic',
              renderProperty: ['/credentialSubject/givenName']
            }
          };

          const result = webWallet.nfcRenderer.supportsNFC({
            credential: credentialWithDynamic
          });

          should.exist(result);
          result.should.equal(true);
        }
      );

      it('should return true when adding nfc-static renderMethod',
        function() {
          if(!eadCredential) {
            this.skip();
          }

          const credential = {
            ...eadCredential,
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderSuite: 'nfc-static',
              template: 'z2drAj5bAkJFsTPKmBvG3Z'
            }
          };

          const result = webWallet.nfcRenderer.supportsNFC({
            credential
          });

          should.exist(result);
          result.should.equal(true);
        }
      );
    });

    describe('renderToNfc() - EAD Single Field Extraction', function() {
      it('should extract givenName from EAD credential',
        async function() {
          if(!eadCredential) {
            this.skip();
          }

          const credential = {
            ...eadCredential,
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderSuite: 'nfc-dynamic',
              renderProperty: ['/credentialSubject/givenName']
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
          decoded.should.equal('JOHN');
        }
      );

      it('should extract familyName from EAD credential',
        async function() {
          if(!eadCredential) {
            this.skip();
          }

          const credential = {
            ...eadCredential,
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderSuite: 'nfc-dynamic',
              renderProperty: ['/credentialSubject/familyName']
            }
          };

          const result = await webWallet.nfcRenderer.renderToNfc({credential});
          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('SMITH');
        }
      );

      it('should extract full name (concatenated)',
        async function() {
          if(!eadCredential) {
            this.skip();
          }

          const credential = {
            ...eadCredential,
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderSuite: 'nfc-dynamic',
              renderProperty: [
                '/credentialSubject/givenName',
                '/credentialSubject/additionalName',
                '/credentialSubject/familyName'
              ]
            }
          };

          const result = await webWallet.nfcRenderer.renderToNfc({credential});
          const decoded = new TextDecoder().decode(result.bytes);
          decoded.should.equal('JOHNJACOBSMITH');
        }
      );
    });

    describe('renderToNfc() - EAD Image Data', function() {
      it('should extract large image data URI',
        async function() {
          if(!eadCredential) {
            this.skip();
          }

          const credential = {
            ...eadCredential,
            renderMethod: {
              type: 'TemplateRenderMethod',
              renderSuite: 'nfc-dynamic',
              renderProperty: ['/credentialSubject/image']
            }
          };

          const result = await webWallet.nfcRenderer.renderToNfc({credential});

          should.exist(result);
          should.exist(result.bytes);

          const decoded = new TextDecoder().decode(result.bytes);
          // Use regex to check starts with
          decoded.should.match(/^data:image\/png;base64,/);

          // Verify it's the full large image (should be > 50KB)
          result.bytes.length.should.be.greaterThan(50000);
        }
      );
    });

  });

});

