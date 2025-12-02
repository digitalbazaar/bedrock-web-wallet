/*!
 * Copyright (c) 2024 Digital Bazaar, Inc. All rights reserved.
 */
import {
  DEFAULT_DERIVATION_PATH,
  generateMnemonic,
  walletFromMnemonic,
} from '../../lib/ethereum/index.js';

describe('Ethereum Module', function() {
  describe('generateMnemonic()', function() {
    it('should generate a 12-word mnemonic by default', function() {
      const mnemonic = generateMnemonic();

      should.exist(mnemonic);
      mnemonic.should.be.a('string');

      const words = mnemonic.trim().split(/\s+/);
      words.length.should.equal(12);
    });

    it('should generate a 24-word mnemonic with strength=256', function() {
      const mnemonic = generateMnemonic({strength: 256});

      should.exist(mnemonic);
      const words = mnemonic.trim().split(/\s+/);
      words.length.should.equal(24);
    });

    it('should generate unique mnemonics each time', function() {
      const mnemonic1 = generateMnemonic();
      const mnemonic2 = generateMnemonic();

      mnemonic1.should.not.equal(mnemonic2);
    });
  });

  describe('walletFromMnemonic()', function() {
    const testMnemonic =
      'abandon abandon abandon abandon abandon abandon ' +
      'abandon abandon abandon abandon abandon about';

    it('should derive a wallet from a valid mnemonic', function() {
      const wallet = walletFromMnemonic({mnemonic: testMnemonic});

      should.exist(wallet);
      should.exist(wallet.address);
      should.exist(wallet.privateKey);
      should.exist(wallet.publicKey);
      should.exist(wallet.derivationPath);
      should.exist(wallet.mnemonic);
    });

    it('should return a valid Ethereum address (0x + 40 hex chars)',
      function() {
        const wallet = walletFromMnemonic({mnemonic: testMnemonic});
        wallet.address.should.match(/^0x[a-fA-F0-9]{40}$/);
      });

    it('should return a valid private key (0x + 64 hex chars)', function() {
      const wallet = walletFromMnemonic({mnemonic: testMnemonic});
      wallet.privateKey.should.match(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should use default derivation path m/49\'/60\'/0\'/0/0', function() {
      const wallet = walletFromMnemonic({mnemonic: testMnemonic});

      wallet.derivationPath.should.equal(DEFAULT_DERIVATION_PATH);
      wallet.derivationPath.should.equal('m/49\'/60\'/0\'/0/0');
    });

    it('should derive the same wallet from the same mnemonic', function() {
      const wallet1 = walletFromMnemonic({mnemonic: testMnemonic});
      const wallet2 = walletFromMnemonic({mnemonic: testMnemonic});

      wallet1.address.should.equal(wallet2.address);
      wallet1.privateKey.should.equal(wallet2.privateKey);
      wallet1.publicKey.should.equal(wallet2.publicKey);
    });

    it('should derive different wallets from different mnemonics', function() {
      const mnemonic1 = generateMnemonic();
      const mnemonic2 = generateMnemonic();

      const wallet1 = walletFromMnemonic({mnemonic: mnemonic1});
      const wallet2 = walletFromMnemonic({mnemonic: mnemonic2});

      wallet1.address.should.not.equal(wallet2.address);
      wallet1.privateKey.should.not.equal(wallet2.privateKey);
    });

    it('should support custom derivation path', function() {
      const customPath = 'm/44\'/60\'/0\'/0/0';
      const wallet = walletFromMnemonic({
        mnemonic: testMnemonic,
        path: customPath
      });

      wallet.derivationPath.should.equal(customPath);
    });

    it('should derive different addresses for different paths', function() {
      const path1 = 'm/49\'/60\'/0\'/0/0';
      const path2 = 'm/49\'/60\'/0\'/0/1';

      const wallet1 = walletFromMnemonic({mnemonic: testMnemonic, path: path1});
      const wallet2 = walletFromMnemonic({mnemonic: testMnemonic, path: path2});

      wallet1.address.should.not.equal(wallet2.address);
    });

    it('should throw error for invalid mnemonic', function() {
      let error;
      try {
        walletFromMnemonic({mnemonic: 'invalid mnemonic phrase'});
      } catch(e) {
        error = e;
      }

      should.exist(error);
    });

    it('should include the mnemonic in the returned wallet', function() {
      const wallet = walletFromMnemonic({mnemonic: testMnemonic});
      wallet.mnemonic.should.equal(testMnemonic);
    });
  });

  describe('Integration: generateMnemonic + walletFromMnemonic', function() {
    it('should create a complete wallet from generated mnemonic', function() {
      // Generate mnemonic
      const mnemonic = generateMnemonic();

      // Derive wallet
      const wallet = walletFromMnemonic({mnemonic});

      // Verify all fields exist
      should.exist(wallet.address);
      should.exist(wallet.privateKey);
      should.exist(wallet.publicKey);
      wallet.derivationPath.should.equal('m/49\'/60\'/0\'/0/0');
      wallet.mnemonic.should.equal(mnemonic);

      // Verify formats
      wallet.address.should.match(/^0x[a-fA-F0-9]{40}$/);
      wallet.privateKey.should.match(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should allow wallet recovery from mnemonic', function() {
      // Simulate: User creates wallet
      const mnemonic = generateMnemonic();
      const originalWallet = walletFromMnemonic({mnemonic});

      // Simulate: User loses device, recovers with mnemonic
      const recoveredWallet = walletFromMnemonic({mnemonic});

      // Same mnemonic = same wallet
      recoveredWallet.address.should.equal(originalWallet.address);
      recoveredWallet.privateKey.should.equal(originalWallet.privateKey);
    });
  });
});
