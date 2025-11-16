import { describe, it, expect, beforeEach } from 'vitest';
import { MultiChainProvider } from '../../../../src/mcp-servers/multichain/provider.js';
import { EthereumProvider } from '../../../../src/mcp-servers/ethereum/provider.js';
import { SolanaProvider } from '../../../../src/mcp-servers/solana/provider.js';
import {
  SupportedChain,
  MultiChainError,
  MultiChainErrorCode,
} from '../../../../src/mcp-servers/multichain/types.js';

describe('MultiChainProvider', () => {
  describe('Initialization', () => {
    it('should initialize with both providers', () => {
      const provider = new MultiChainProvider(
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

      expect(provider.getEthereumProvider()).toBeInstanceOf(EthereumProvider);
      expect(provider.getSolanaProvider()).toBeInstanceOf(SolanaProvider);
    });

    it('should initialize with only Ethereum provider', () => {
      const provider = new MultiChainProvider(
        {
          rpcUrl: 'http://localhost:8545',
          chainId: 1,
          chainName: 'ethereum',
        },
        undefined,
        { autoStartHealthMonitoring: false }
      );

      expect(provider.getEthereumProvider()).toBeInstanceOf(EthereumProvider);
      expect(() => provider.getSolanaProvider()).toThrow(MultiChainError);
    });

    it('should initialize with only Solana provider', () => {
      const provider = new MultiChainProvider(
        undefined,
        {
          rpcUrl: 'http://localhost:8899',
          cluster: 'devnet',
        },
        { autoStartHealthMonitoring: false }
      );

      expect(provider.getSolanaProvider()).toBeInstanceOf(SolanaProvider);
      expect(() => provider.getEthereumProvider()).toThrow(MultiChainError);
    });

    it('should throw error when accessing unconfigured Ethereum provider', () => {
      const provider = new MultiChainProvider(
        undefined,
        {
          rpcUrl: 'http://localhost:8899',
          cluster: 'devnet',
        },
        { autoStartHealthMonitoring: false }
      );

      expect(() => provider.getEthereumProvider()).toThrow(MultiChainError);
      expect(() => provider.getEthereumProvider()).toThrow('Ethereum provider not configured');
    });

    it('should throw error when accessing unconfigured Solana provider', () => {
      const provider = new MultiChainProvider(
        {
          rpcUrl: 'http://localhost:8545',
          chainId: 1,
          chainName: 'ethereum',
        },
        undefined,
        { autoStartHealthMonitoring: false }
      );

      expect(() => provider.getSolanaProvider()).toThrow(MultiChainError);
      expect(() => provider.getSolanaProvider()).toThrow('Solana provider not configured');
    });
  });

  describe('Chain Detection', () => {
    let provider: MultiChainProvider;

    beforeEach(() => {
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
    });

    it('should detect Ethereum addresses', () => {
      const ethereumAddresses = [
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        '0x0000000000000000000000000000000000000000',
        '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      ];

      for (const address of ethereumAddresses) {
        const chain = provider.detectChainFromAddress(address);
        expect(chain).toBe(SupportedChain.ETHEREUM);
      }
    });

    it('should detect Solana addresses', () => {
      const solanaAddresses = [
        'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        '11111111111111111111111111111111',
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      ];

      for (const address of solanaAddresses) {
        const chain = provider.detectChainFromAddress(address);
        expect(chain).toBe(SupportedChain.SOLANA);
      }
    });

    it('should throw error for invalid addresses', () => {
      const invalidAddresses = [
        'invalid',
        '0x123', // Too short
        'not-an-address',
        '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG', // Invalid hex
      ];

      for (const address of invalidAddresses) {
        expect(() => provider.detectChainFromAddress(address)).toThrow(MultiChainError);
      }
    });
  });

  describe('Routing', () => {
    let provider: MultiChainProvider;

    beforeEach(() => {
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
    });

    it('should route to Ethereum provider', async () => {
      const result = await provider.routeToChain(SupportedChain.ETHEREUM, undefined, async (p) => {
        expect(p).toBeInstanceOf(EthereumProvider);
        return 'ethereum-result';
      });

      expect(result).toBe('ethereum-result');
    });

    it('should route to Solana provider', async () => {
      const result = await provider.routeToChain(SupportedChain.SOLANA, undefined, async (p) => {
        expect(p).toBeInstanceOf(SolanaProvider);
        return 'solana-result';
      });

      expect(result).toBe('solana-result');
    });

    it('should auto-detect and route to Ethereum', async () => {
      const ethereumAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';

      const result = await provider.routeToChain(
        SupportedChain.AUTO,
        ethereumAddress,
        async (p) => {
          expect(p).toBeInstanceOf(EthereumProvider);
          return 'auto-ethereum';
        }
      );

      expect(result).toBe('auto-ethereum');
    });

    it('should auto-detect and route to Solana', async () => {
      const solanaAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';

      const result = await provider.routeToChain(SupportedChain.AUTO, solanaAddress, async (p) => {
        expect(p).toBeInstanceOf(SolanaProvider);
        return 'auto-solana';
      });

      expect(result).toBe('auto-solana');
    });

    it('should throw error for AUTO without address', async () => {
      await expect(
        provider.routeToChain(SupportedChain.AUTO, undefined, async () => 'result')
      ).rejects.toThrow(MultiChainError);

      await expect(
        provider.routeToChain(SupportedChain.AUTO, undefined, async () => 'result')
      ).rejects.toThrow('Address required for auto-detection');
    });

    it('should throw error for invalid chain', async () => {
      await expect(
        provider.routeToChain('invalid' as SupportedChain, undefined, async () => 'result')
      ).rejects.toThrow(MultiChainError);
    });

    it('should throw error when routing to unconfigured chain', async () => {
      const ethereumOnlyProvider = new MultiChainProvider(
        {
          rpcUrl: 'http://localhost:8545',
          chainId: 1,
          chainName: 'ethereum',
        },
        undefined,
        { autoStartHealthMonitoring: false }
      );

      await expect(
        ethereumOnlyProvider.routeToChain(SupportedChain.SOLANA, undefined, async () => 'result')
      ).rejects.toThrow(MultiChainError);

      await expect(
        ethereumOnlyProvider.routeToChain(SupportedChain.SOLANA, undefined, async () => 'result')
      ).rejects.toThrow('Solana provider not configured');
    });
  });

  describe('Health Monitoring', () => {
    let provider: MultiChainProvider;

    beforeEach(() => {
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
    });

    it('should check Ethereum health (expect failure without node)', async () => {
      const health = await provider.checkChainHealth(SupportedChain.ETHEREUM);

      expect(health.chain).toBe(SupportedChain.ETHEREUM);
      expect(health.lastChecked).toBeInstanceOf(Date);
      expect(typeof health.latency).toBe('number');
      expect(typeof health.healthy).toBe('boolean');
      // Without local node, should be unhealthy
      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
    });

    it('should check Solana health (expect failure without node)', async () => {
      const health = await provider.checkChainHealth(SupportedChain.SOLANA);

      expect(health.chain).toBe(SupportedChain.SOLANA);
      expect(health.lastChecked).toBeInstanceOf(Date);
      expect(typeof health.latency).toBe('number');
      expect(typeof health.healthy).toBe('boolean');
      // Without local node, should be unhealthy
      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
    }, 10000); // 10 second timeout for retry logic

    it('should get overall status (expect failures without nodes)', async () => {
      const status = await provider.getStatus();

      expect(status.ethereum).toBeDefined();
      expect(status.solana).toBeDefined();
      expect(typeof status.overallHealthy).toBe('boolean');
      expect(status.ethereum.chain).toBe(SupportedChain.ETHEREUM);
      expect(status.solana.chain).toBe(SupportedChain.SOLANA);
      // Both chains should be unhealthy without nodes
      expect(status.ethereum.healthy).toBe(false);
      expect(status.solana.healthy).toBe(false);
      expect(status.overallHealthy).toBe(false);
    }, 10000); // 10 second timeout for retry logic

    it('should cache health status', async () => {
      // First call - populates cache
      await provider.getStatus();

      // Get cached health
      const ethereumHealth = provider.getCachedHealth(SupportedChain.ETHEREUM);
      expect(ethereumHealth).toBeDefined();
      expect(typeof ethereumHealth).toBe('object');
      expect('chain' in ethereumHealth).toBe(true);

      const solanaHealth = provider.getCachedHealth(SupportedChain.SOLANA);
      expect(solanaHealth).toBeDefined();
      expect(typeof solanaHealth).toBe('object');
      expect('chain' in solanaHealth).toBe(true);
    }, 10000); // 10 second timeout for retry logic

    it('should get all cached health', async () => {
      await provider.getStatus();

      const allHealth = provider.getCachedHealth();
      expect(allHealth).toBeInstanceOf(Map);
      if (allHealth instanceof Map) {
        expect(allHealth.size).toBeGreaterThan(0);
      }
    }, 10000); // 10 second timeout for retry logic

    it('should return unhealthy status for unconfigured provider', async () => {
      const ethereumOnlyProvider = new MultiChainProvider(
        {
          rpcUrl: 'http://localhost:8545',
          chainId: 1,
          chainName: 'ethereum',
        },
        undefined,
        { autoStartHealthMonitoring: false }
      );

      const health = await ethereumOnlyProvider.checkChainHealth(SupportedChain.SOLANA);
      expect(health.healthy).toBe(false);
      expect(health.error).toBe('Provider not configured');
    });
  });

  describe('Failover', () => {
    let provider: MultiChainProvider;

    beforeEach(() => {
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
    });

    it('should execute on detected chain', async () => {
      const ethereumAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';

      const result = await provider.executeWithFailover(ethereumAddress, {
        ethereum: async () => 'ethereum-result',
        solana: async () => 'solana-result',
      });

      expect(result).toBe('ethereum-result');
    });

    it('should execute on Solana when address is Solana', async () => {
      const solanaAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';

      const result = await provider.executeWithFailover(solanaAddress, {
        ethereum: async () => 'ethereum-result',
        solana: async () => 'solana-result',
      });

      expect(result).toBe('solana-result');
    });

    it('should try both chains when detection fails', async () => {
      const invalidAddress = 'invalid-address';
      let ethereumAttempted = false;
      let solanaAttempted = false;

      try {
        await provider.executeWithFailover(invalidAddress, {
          ethereum: async () => {
            ethereumAttempted = true;
            throw new Error('Ethereum failed');
          },
          solana: async () => {
            solanaAttempted = true;
            throw new Error('Solana failed');
          },
        });
      } catch (error) {
        expect(error).toBeInstanceOf(MultiChainError);
        if (error instanceof MultiChainError) {
          expect(error.code).toBe(MultiChainErrorCode.BOTH_CHAINS_FAILED);
        }
      }

      // Should have tried both
      expect(ethereumAttempted).toBe(true);
      expect(solanaAttempted).toBe(true);
    });

    it('should succeed if first chain works when detection fails', async () => {
      const invalidAddress = 'invalid-address';

      const result = await provider.executeWithFailover(invalidAddress, {
        ethereum: async () => 'ethereum-success',
        solana: async () => {
          throw new Error('Should not reach here');
        },
      });

      expect(result).toBe('ethereum-success');
    });

    it('should fallback to second chain when first fails', async () => {
      const invalidAddress = 'invalid-address';

      const result = await provider.executeWithFailover(invalidAddress, {
        ethereum: async () => {
          throw new Error('Ethereum failed');
        },
        solana: async () => 'solana-fallback',
      });

      expect(result).toBe('solana-fallback');
    });
  });

  describe('Error Handling', () => {
    it('should throw MultiChainError with proper context', async () => {
      const provider = new MultiChainProvider(
        {
          rpcUrl: 'http://localhost:8545',
          chainId: 1,
          chainName: 'ethereum',
        },
        undefined,
        { autoStartHealthMonitoring: false }
      );

      try {
        await provider.routeToChain(SupportedChain.SOLANA, undefined, async () => 'result');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MultiChainError);
        if (error instanceof MultiChainError) {
          expect(error.chain).toBe(SupportedChain.SOLANA);
          expect(error.code).toBe(MultiChainErrorCode.CHAIN_NOT_CONFIGURED);
        }
      }
    });

    it('should wrap operation errors in MultiChainError', async () => {
      const provider = new MultiChainProvider(
        {
          rpcUrl: 'http://localhost:8545',
          chainId: 1,
          chainName: 'ethereum',
        },
        undefined,
        { autoStartHealthMonitoring: false }
      );

      try {
        await provider.routeToChain(SupportedChain.ETHEREUM, undefined, async () => {
          throw new Error('Operation failed');
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MultiChainError);
        if (error instanceof MultiChainError) {
          expect(error.chain).toBe(SupportedChain.ETHEREUM);
          expect(error.code).toBe(MultiChainErrorCode.CHAIN_UNAVAILABLE);
          expect(error.details?.['error']).toContain('Operation failed');
        }
      }
    });
  });
});
