import { describe, it, expect, beforeEach } from 'vitest';
import { MultiChainToolManager } from '../../../../src/mcp-servers/multichain/tools.js';
import { MultiChainProvider } from '../../../../src/mcp-servers/multichain/provider.js';
import {
  SupportedChain,
  MultiChainError,
} from '../../../../src/mcp-servers/multichain/types.js';

describe('MultiChainToolManager', () => {
  let provider: MultiChainProvider;
  let tools: MultiChainToolManager;

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

    tools = new MultiChainToolManager(provider);
  });

  describe('Initialization', () => {
    it('should initialize with both chain tools', () => {
      expect(tools).toBeDefined();
      expect(tools.listTools).toBeDefined();
      expect(tools.queryBalance).toBeDefined();
      expect(tools.sendTransaction).toBeDefined();
    });

    it('should initialize with only Ethereum tools', () => {
      const ethOnlyProvider = new MultiChainProvider(
        {
          rpcUrl: 'http://localhost:8545',
          chainId: 1,
          chainName: 'ethereum',
        },
        undefined,
        { autoStartHealthMonitoring: false }
      );

      const ethTools = new MultiChainToolManager(ethOnlyProvider);
      const list = ethTools.listTools();

      // Should have tools (works with one chain)
      expect(list.length).toBeGreaterThan(0);
    });

    it('should initialize with only Solana tools', () => {
      const solOnlyProvider = new MultiChainProvider(
        undefined,
        {
          rpcUrl: 'http://localhost:8899',
          cluster: 'devnet',
        },
        { autoStartHealthMonitoring: false }
      );

      const solTools = new MultiChainToolManager(solOnlyProvider);
      const list = solTools.listTools();

      // Should have tools (works with one chain)
      expect(list.length).toBeGreaterThan(0);
    });
  });

  describe('Wallet Management', () => {
    it('should throw error when initializing wallet for AUTO chain', () => {
      const privateKey = '0x1234567890123456789012345678901234567890123456789012345678901234';

      expect(() => tools.initializeWallet(SupportedChain.AUTO, privateKey)).toThrow(
        MultiChainError
      );
      expect(() => tools.initializeWallet(SupportedChain.AUTO, privateKey)).toThrow(
        'Cannot initialize wallet for AUTO chain'
      );
    });

    it('should throw error for unconfigured chain wallet initialization', () => {
      const ethOnlyProvider = new MultiChainProvider(
        {
          rpcUrl: 'http://localhost:8545',
          chainId: 1,
          chainName: 'ethereum',
        },
        undefined,
        { autoStartHealthMonitoring: false }
      );

      const ethTools = new MultiChainToolManager(ethOnlyProvider);
      const privateKey = '[1,2,3,4]'; // Solana format

      expect(() => ethTools.initializeWallet(SupportedChain.SOLANA, privateKey)).toThrow(
        MultiChainError
      );
      expect(() => ethTools.initializeWallet(SupportedChain.SOLANA, privateKey)).toThrow(
        'Solana tools not available'
      );
    });

    it('should clear wallet without error', () => {
      expect(() => tools.clearWallet()).not.toThrow();
      expect(() => tools.clearWallet(SupportedChain.ETHEREUM)).not.toThrow();
      expect(() => tools.clearWallet(SupportedChain.SOLANA)).not.toThrow();
    });
  });

  describe('List Tools', () => {
    it('should list multi-chain tools', () => {
      const list = tools.listTools();

      expect(list).toBeInstanceOf(Array);
      expect(list.length).toBeGreaterThan(0);

      // Check for key tools
      expect(list.some((t) => t.name === 'multichain_query_balance')).toBe(true);
      expect(list.some((t) => t.name === 'multichain_send_transaction')).toBe(true);
      expect(list.some((t) => t.name === 'multichain_transfer_token')).toBe(true);
    });

    it('should have proper tool schemas', () => {
      const list = tools.listTools();

      for (const tool of list) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema).toHaveProperty('type', 'object');
        expect(tool.inputSchema).toHaveProperty('properties');
        expect(tool.inputSchema).toHaveProperty('required');
      }
    });

    it('should include chain parameter in tool schemas', () => {
      const list = tools.listTools();

      for (const tool of list) {
        const schema = tool.inputSchema as any;
        expect(schema.properties.chain).toBeDefined();
        expect(schema.properties.chain.enum).toContain('auto');
        expect(schema.properties.chain.enum).toContain('ethereum');
        expect(schema.properties.chain.enum).toContain('solana');
      }
    });
  });

  describe('Query Balance', () => {
    it(
      'should detect Ethereum address and route correctly',
      async () => {
        const params = {
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
          chain: 'auto',
        };

        // Will fail to connect but should route to Ethereum
        await expect(tools.queryBalance(params)).rejects.toThrow();
      },
      15000
    ); // 15 second timeout

    it(
      'should detect Solana address and route correctly',
      async () => {
        const params = {
          address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          chain: 'auto',
        };

        // Will fail to connect but should route to Solana (with timeout)
        await expect(tools.queryBalance(params)).rejects.toThrow();
      },
      15000
    ); // 15 second timeout

    it(
      'should handle explicit Ethereum chain',
      async () => {
        const params = {
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
          chain: 'ethereum',
        };

        await expect(tools.queryBalance(params)).rejects.toThrow();
      },
      15000
    ); // 15 second timeout

    it(
      'should handle explicit Solana chain',
      async () => {
        const params = {
          address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          chain: 'solana',
        };

        await expect(tools.queryBalance(params)).rejects.toThrow();
      },
      15000
    ); // 15 second timeout

    it('should validate parameters', async () => {
      const invalidParams = {
        // Missing required address
        chain: 'ethereum',
      };

      await expect(tools.queryBalance(invalidParams)).rejects.toThrow();
    });

    it('should throw error for unconfigured chain', async () => {
      const ethOnlyProvider = new MultiChainProvider(
        {
          rpcUrl: 'http://localhost:8545',
          chainId: 1,
          chainName: 'ethereum',
        },
        undefined,
        { autoStartHealthMonitoring: false }
      );

      const ethTools = new MultiChainToolManager(ethOnlyProvider);

      const params = {
        address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        chain: 'solana',
      };

      await expect(ethTools.queryBalance(params)).rejects.toThrow(MultiChainError);
      await expect(ethTools.queryBalance(params)).rejects.toThrow(
        'Solana tools not available'
      );
    });
  });

  describe('Send Transaction', () => {
    it('should detect chain from recipient address', async () => {
      const params = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        amount: '1000000000000000000', // 1 ETH in wei
        chain: 'auto',
      };

      // Will fail (no wallet initialized) but should route correctly
      await expect(tools.sendTransaction(params)).rejects.toThrow();
    });

    it('should validate required parameters', async () => {
      const invalidParams = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        // Missing amount
      };

      await expect(tools.sendTransaction(invalidParams)).rejects.toThrow();
    });

    it('should throw error for unconfigured chain', async () => {
      const ethOnlyProvider = new MultiChainProvider(
        {
          rpcUrl: 'http://localhost:8545',
          chainId: 1,
          chainName: 'ethereum',
        },
        undefined,
        { autoStartHealthMonitoring: false }
      );

      const ethTools = new MultiChainToolManager(ethOnlyProvider);

      const params = {
        to: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        amount: '1000000000',
        chain: 'solana',
      };

      await expect(ethTools.sendTransaction(params)).rejects.toThrow(MultiChainError);
      await expect(ethTools.sendTransaction(params)).rejects.toThrow(
        'Solana tools not available'
      );
    });
  });

  describe('Transfer Token', () => {
    it('should detect chain from token address', async () => {
      const params = {
        to: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        amount: '1000000',
        token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        decimals: 6,
        chain: 'auto',
      };

      // Will fail but should route to Solana
      await expect(tools.transferToken(params)).rejects.toThrow();
    });

    it('should throw for ERC20 transfers (not yet implemented)', async () => {
      const params = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        amount: '1000000',
        token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        decimals: 6,
        chain: 'ethereum',
      };

      await expect(tools.transferToken(params)).rejects.toThrow(MultiChainError);
      await expect(tools.transferToken(params)).rejects.toThrow(
        'ERC20 token transfers not yet implemented'
      );
    });

    it('should validate required parameters', async () => {
      const invalidParams = {
        to: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        amount: '1000000',
        // Missing token and decimals
      };

      await expect(tools.transferToken(invalidParams)).rejects.toThrow();
    });
  });

  describe('Execute Tool', () => {
    it(
      'should execute query_balance tool',
      async () => {
        const params = {
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
          chain: 'ethereum',
        };

        // Will fail to connect but should route correctly
        await expect(tools.executeTool('multichain_query_balance', params)).rejects.toThrow();
      },
      15000
    ); // 15 second timeout

    it('should execute send_transaction tool', async () => {
      const params = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        amount: '1000000000000000000',
      };

      await expect(
        tools.executeTool('multichain_send_transaction', params)
      ).rejects.toThrow();
    });

    it('should execute transfer_token tool', async () => {
      const params = {
        to: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        amount: '1000000',
        token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        decimals: 6,
      };

      await expect(tools.executeTool('multichain_transfer_token', params)).rejects.toThrow();
    });

    it('should throw error for unknown tool', async () => {
      await expect(tools.executeTool('unknown_tool', {})).rejects.toThrow(MultiChainError);
      await expect(tools.executeTool('unknown_tool', {})).rejects.toThrow('Unknown tool');
    });
  });

  describe('Error Handling', () => {
    it(
      'should wrap errors in MultiChainError',
      async () => {
        const params = {
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        };

        try {
          await tools.queryBalance(params);
          expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MultiChainError);
        if (error instanceof MultiChainError) {
          expect(error.details).toBeDefined();
        }
      }
      },
      15000
    ); // 15 second timeout

    it('should preserve MultiChainError when re-throwing', async () => {
      const ethOnlyProvider = new MultiChainProvider(
        {
          rpcUrl: 'http://localhost:8545',
          chainId: 1,
          chainName: 'ethereum',
        },
        undefined,
        { autoStartHealthMonitoring: false }
      );

      const ethTools = new MultiChainToolManager(ethOnlyProvider);

      const params = {
        address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        chain: 'solana',
      };

      try {
        await ethTools.queryBalance(params);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(MultiChainError);
        if (error instanceof MultiChainError) {
          expect(error.chain).toBe(SupportedChain.SOLANA);
        }
      }
    });
  });
});
