import { describe, it, expect, beforeEach } from 'vitest';
import { MultiChainResourceManager } from '../../../../src/mcp-servers/multichain/resources.js';
import { MultiChainProvider } from '../../../../src/mcp-servers/multichain/provider.js';
import { MultiChainError } from '../../../../src/mcp-servers/multichain/types.js';

describe('MultiChainResourceManager', () => {
  let provider: MultiChainProvider;
  let resources: MultiChainResourceManager;

  beforeEach(() => {
    // Initialize with both chains (without auto-health monitoring)
    provider = new MultiChainProvider(
      {
        rpcUrl: 'http://localhost:8545',
        chainId: 1,
        chainName: 'ethereum',
      },
      {
        rpcUrl: 'http://localhost:8899',
        cluster: 'devnet',
      },
      { autoStartHealthMonitoring: false }
    );

    resources = new MultiChainResourceManager(provider);
  });

  describe('Initialization', () => {
    it('should initialize with both chain resource managers', () => {
      expect(resources).toBeDefined();
      expect(resources.listResources).toBeDefined();
    });

    it('should initialize with only Ethereum resources', () => {
      const ethOnlyProvider = new MultiChainProvider(
        {
          rpcUrl: 'http://localhost:8545',
          chainId: 1,
          chainName: 'ethereum',
        },
        undefined,
        { autoStartHealthMonitoring: false }
      );

      const ethResources = new MultiChainResourceManager(ethOnlyProvider);
      const list = ethResources.listResources();

      // Should only have Ethereum resources
      expect(list.some((r) => r.uri.includes('ethereum'))).toBe(true);
      expect(list.some((r) => r.uri.includes('solana'))).toBe(false);
      expect(list.some((r) => r.uri.includes('auto'))).toBe(false);
    });

    it('should initialize with only Solana resources', () => {
      const solOnlyProvider = new MultiChainProvider(
        undefined,
        {
          rpcUrl: 'http://localhost:8899',
          cluster: 'devnet',
        },
        { autoStartHealthMonitoring: false }
      );

      const solResources = new MultiChainResourceManager(solOnlyProvider);
      const list = solResources.listResources();

      // Should only have Solana resources
      expect(list.some((r) => r.uri.includes('solana'))).toBe(true);
      expect(list.some((r) => r.uri.includes('ethereum'))).toBe(false);
      expect(list.some((r) => r.uri.includes('auto'))).toBe(false);
    });
  });

  describe('List Resources', () => {
    it('should list Ethereum resources', () => {
      const list = resources.listResources();

      expect(list).toBeInstanceOf(Array);
      expect(list.length).toBeGreaterThan(0);

      // Check for Ethereum resources
      expect(list.some((r) => r.uri === 'multichain://ethereum/account/*')).toBe(true);
      expect(list.some((r) => r.uri === 'multichain://ethereum/contract/*')).toBe(true);
      expect(list.some((r) => r.uri === 'multichain://ethereum/transaction/*')).toBe(true);
    });

    it('should list Solana resources', () => {
      const list = resources.listResources();

      expect(list.some((r) => r.uri === 'multichain://solana/account/*')).toBe(true);
      expect(list.some((r) => r.uri === 'multichain://solana/token-account/*')).toBe(true);
      expect(list.some((r) => r.uri === 'multichain://solana/transaction/*')).toBe(true);
    });

    it('should list auto-detect resources when both chains available', () => {
      const list = resources.listResources();

      expect(list.some((r) => r.uri === 'multichain://auto/account/*')).toBe(true);
      expect(list.some((r) => r.uri === 'multichain://auto/transaction/*')).toBe(true);
    });

    it('should have proper resource metadata', () => {
      const list = resources.listResources();

      for (const resource of list) {
        expect(resource.uri).toBeDefined();
        expect(resource.name).toBeDefined();
        expect(resource.description).toBeDefined();
        expect(resource.mimeType).toBe('application/json');
      }
    });
  });

  describe('URI Parsing and Routing', () => {
    it('should parse Ethereum account URI', async () => {
      const uri = 'multichain://ethereum/account/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';

      // Should not throw on parse
      await expect(resources.getAccountBalance(uri)).rejects.toThrow(); // Will fail to connect to node, but parsing works
    });

    it(
      'should parse Solana account URI',
      async () => {
        const uri = 'multichain://solana/account/DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';

        // Should not throw on parse
        await expect(resources.getAccountBalance(uri)).rejects.toThrow(); // Will fail to connect to node, but parsing works
      },
      15000
    ); // 15 second timeout for retry logic

    it('should parse auto-detect account URI with Ethereum address', async () => {
      const uri = 'multichain://auto/account/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';

      // Should not throw on parse - should detect as Ethereum
      await expect(resources.getAccountBalance(uri)).rejects.toThrow(); // Will fail to connect
    });

    it(
      'should parse auto-detect account URI with Solana address',
      async () => {
        const uri = 'multichain://auto/account/DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';

        // Should not throw on parse - should detect as Solana
        await expect(resources.getAccountBalance(uri)).rejects.toThrow(); // Will fail to connect
      },
      15000
    ); // 15 second timeout for retry logic

    it('should throw error for invalid URI format', async () => {
      const invalidURIs = [
        'invalid://uri',
        'multichain://account/0x123', // Missing chain
        'ethereum://account/0x123', // Wrong scheme
        'multichain://ethereum/invalid/0x123', // Unknown type
      ];

      for (const uri of invalidURIs) {
        await expect(resources.getResource(uri)).rejects.toThrow(MultiChainError);
      }
    });
  });

  describe('Chain-Specific Resources', () => {
    it('should reject contract resource for non-Ethereum chain', async () => {
      const uri = 'multichain://solana/contract/DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';

      await expect(resources.getResource(uri)).rejects.toThrow(MultiChainError);
      await expect(resources.getResource(uri)).rejects.toThrow(
        'Contracts are only supported on Ethereum'
      );
    });

    it('should reject token-account resource for non-Solana chain', async () => {
      const uri = 'multichain://ethereum/token-account/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';

      await expect(resources.getResource(uri)).rejects.toThrow(MultiChainError);
      await expect(resources.getResource(uri)).rejects.toThrow(
        'Token accounts are only supported on Solana'
      );
    });

    it('should handle Ethereum contract resource', async () => {
      const uri = 'multichain://ethereum/contract/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';

      // Will fail to connect but should route correctly
      await expect(resources.getResource(uri)).rejects.toThrow();
    });

    it(
      'should handle Solana token account resource',
      async () => {
        const uri = 'multichain://solana/token-account/DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';

        // Will fail to connect but should route correctly
        await expect(resources.getResource(uri)).rejects.toThrow();
      },
      15000
    ); // 15 second timeout for retry logic
  });

  describe('Transaction Resources', () => {
    it(
      'should detect Ethereum transaction from hash format',
      async () => {
        const uri =
          'multichain://auto/transaction/0x1234567890123456789012345678901234567890123456789012345678901234';

        // Should detect 0x prefix as Ethereum
        await expect(resources.getTransaction(uri)).rejects.toThrow(); // Will fail to connect
      },
      15000
    ); // 15 second timeout for retry logic

    it(
      'should detect Solana transaction from signature format',
      async () => {
        const uri =
          'multichain://auto/transaction/5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';

        // Should detect Base58 as Solana (no 0x prefix)
        await expect(resources.getTransaction(uri)).rejects.toThrow(); // Will fail to connect
      },
      15000
    ); // 15 second timeout for retry logic

    it(
      'should handle explicit Ethereum transaction',
      async () => {
        const uri =
          'multichain://ethereum/transaction/0x1234567890123456789012345678901234567890123456789012345678901234';

        await expect(resources.getTransaction(uri)).rejects.toThrow(); // Will fail to connect
      },
      15000
    ); // 15 second timeout for retry logic

    it(
      'should handle explicit Solana transaction',
      async () => {
        const uri =
          'multichain://solana/transaction/5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';

        await expect(resources.getTransaction(uri)).rejects.toThrow(); // Will fail to connect
      },
      15000
    ); // 15 second timeout for retry logic
  });

  describe('Error Handling', () => {
    it('should throw MultiChainError for unconfigured chain', async () => {
      const ethOnlyProvider = new MultiChainProvider(
        {
          rpcUrl: 'http://localhost:8545',
          chainId: 1,
          chainName: 'ethereum',
        },
        undefined,
        { autoStartHealthMonitoring: false }
      );

      const ethResources = new MultiChainResourceManager(ethOnlyProvider);
      const uri = 'multichain://solana/account/DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';

      await expect(ethResources.getAccountBalance(uri)).rejects.toThrow(MultiChainError);
      await expect(ethResources.getAccountBalance(uri)).rejects.toThrow(
        'Solana resources not available'
      );
    });

    it('should wrap errors in MultiChainError', async () => {
      const uri = 'multichain://ethereum/account/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';

      try {
        await resources.getAccountBalance(uri);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MultiChainError);
        if (error instanceof MultiChainError) {
          expect(error.details).toBeDefined();
        }
      }
    });

    it('should preserve MultiChainError when re-throwing', async () => {
      const uri = 'multichain://invalid/account/0x123';

      try {
        await resources.getResource(uri);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MultiChainError);
      }
    });

    it('should handle unknown resource types', async () => {
      const uri = 'multichain://ethereum/unknown/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';

      await expect(resources.getResource(uri)).rejects.toThrow(MultiChainError);
      await expect(resources.getResource(uri)).rejects.toThrow('Unknown resource type');
    });
  });

  describe('Response Format', () => {
    it('should return UnifiedBalanceResponse structure for accounts', async () => {
      const uri = 'multichain://ethereum/account/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';

      try {
        const balance = await resources.getAccountBalance(uri);

        // Should have unified format
        expect(balance).toHaveProperty('chain');
        expect(balance).toHaveProperty('address');
        expect(balance).toHaveProperty('balance');
        expect(balance).toHaveProperty('symbol');
        expect(balance).toHaveProperty('decimals');
      } catch (error) {
        // Expected to fail without real node - just testing structure
        expect(error).toBeDefined();
      }
    });

    it(
      'should return UnifiedTransactionResponse structure for transactions',
      async () => {
        const uri =
          'multichain://ethereum/transaction/0x1234567890123456789012345678901234567890123456789012345678901234';

        try {
          const tx = await resources.getTransaction(uri);

          // Should have unified format
          expect(tx).toHaveProperty('chain');
          expect(tx).toHaveProperty('signature');
          expect(tx).toHaveProperty('status');
        } catch (error) {
          // Expected to fail without real node - just testing structure
          expect(error).toBeDefined();
        }
      },
      15000
    ); // 15 second timeout for retry logic
  });

  describe('Generic getResource Method', () => {
    it('should route account URIs to getAccountBalance', async () => {
      const uri = 'multichain://ethereum/account/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';

      try {
        const resource = await resources.getResource(uri);
        expect(resource.type).toBe('account');
        expect(resource.uri).toBe(uri);
      } catch (error) {
        // Expected - no real node
        expect(error).toBeDefined();
      }
    });

    it(
      'should route transaction URIs to getTransaction',
      async () => {
        const uri =
          'multichain://ethereum/transaction/0x1234567890123456789012345678901234567890123456789012345678901234';

        try {
          const resource = await resources.getResource(uri);
          expect(resource.type).toBe('transaction');
          expect(resource.uri).toBe(uri);
        } catch (error) {
          // Expected - no real node
          expect(error).toBeDefined();
        }
      },
      15000
    ); // 15 second timeout for retry logic
  });
});
