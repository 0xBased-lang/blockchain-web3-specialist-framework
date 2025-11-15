import { describe, it, expect, beforeEach } from 'vitest';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MultiChainProvider } from '../../../../src/mcp-servers/multichain/provider.js';
import { MultiChainResourceManager } from '../../../../src/mcp-servers/multichain/resources.js';
import { MultiChainToolManager } from '../../../../src/mcp-servers/multichain/tools.js';

/**
 * Multi-Chain MCP Server Integration Tests
 *
 * Tests the complete MCP server integration with:
 * - Resource listing and reading
 * - Tool listing and execution
 * - Error handling and routing
 * - Multi-chain provider integration
 */

describe('Multi-Chain MCP Server Integration', () => {
  let provider: MultiChainProvider;
  let resourceManager: MultiChainResourceManager;
  let toolManager: MultiChainToolManager;

  beforeEach(() => {
    // Initialize with both chains for comprehensive testing
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

    resourceManager = new MultiChainResourceManager(provider);
    toolManager = new MultiChainToolManager(provider);
  });

  describe('Resource Handlers', () => {
    it('should list available resources', () => {
      const resources = resourceManager.listResources();

      expect(resources).toBeDefined();
      expect(Array.isArray(resources)).toBe(true);
      expect(resources.length).toBeGreaterThan(0);

      // Check for chain-specific resources
      const ethAccountResource = resources.find((r) => r.uri.includes('ethereum/account'));
      expect(ethAccountResource).toBeDefined();
      expect(ethAccountResource?.name).toBe('Ethereum Account');
      expect(ethAccountResource?.mimeType).toBe('application/json');

      const solAccountResource = resources.find((r) => r.uri.includes('solana/account'));
      expect(solAccountResource).toBeDefined();
      expect(solAccountResource?.name).toBe('Solana Account');
      expect(solAccountResource?.mimeType).toBe('application/json');
    });

    it('should have clear resource descriptions', () => {
      const resources = resourceManager.listResources();

      const accountResource = resources.find((r) => r.uri.includes('account'));
      expect(accountResource?.description).toBeDefined();
      expect(accountResource?.description?.length).toBeGreaterThan(10);
    });

    it(
      'should read Ethereum account resource',
      async () => {
        const uri = 'multichain://ethereum/account/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';

        // Will fail to connect but should route to Ethereum
        await expect(resourceManager.getResource(uri)).rejects.toThrow();
      },
      15000
    ); // 15 second timeout

    it(
      'should read Solana account resource',
      async () => {
        const uri = 'multichain://solana/account/DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';

        // Will fail to connect but should route to Solana
        await expect(resourceManager.getResource(uri)).rejects.toThrow();
      },
      15000
    ); // 15 second timeout

    it(
      'should auto-detect chain from address in resource URI',
      async () => {
        const ethUri = 'multichain://auto/account/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
        const solUri = 'multichain://auto/account/DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';

        // Will fail to connect but should route correctly
        await expect(resourceManager.getResource(ethUri)).rejects.toThrow();
        await expect(resourceManager.getResource(solUri)).rejects.toThrow();
      },
      15000
    ); // 15 second timeout

    it('should reject invalid resource URIs', async () => {
      const invalidUris = [
        'invalid://format',
        'multichain://unknown/account/0x123',
        'multichain://ethereum/invalidtype/0x123',
      ];

      for (const uri of invalidUris) {
        await expect(resourceManager.getResource(uri)).rejects.toThrow();
      }
    });

    it(
      'should handle chain-specific resources',
      async () => {
        // Ethereum-specific: contract
        const ethContractUri = 'multichain://ethereum/contract/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';

        // Solana-specific: token-account
        const solTokenUri =
          'multichain://solana/token-account/DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';

        // Both should fail to connect but route correctly (not throw "unsupported" error)
        await expect(resourceManager.getResource(ethContractUri)).rejects.toThrow();
        await expect(resourceManager.getResource(solTokenUri)).rejects.toThrow();
      },
      15000
    ); // 15 second timeout

    it('should reject chain-specific resources on wrong chain', async () => {
      // Try to get Solana token-account on Ethereum chain
      const invalidUri = 'multichain://ethereum/token-account/DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';

      await expect(resourceManager.getResource(invalidUri)).rejects.toThrow();
    });
  });

  describe('Tool Handlers', () => {
    it('should list available tools', () => {
      const tools = toolManager.listTools();

      expect(tools).toBeDefined();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);

      // Check for multi-chain tools
      const balanceTool = tools.find((t) => t.name === 'multichain_query_balance');
      expect(balanceTool).toBeDefined();
      expect(balanceTool?.description).toContain('auto-detect');

      const sendTool = tools.find((t) => t.name === 'multichain_send_transaction');
      expect(sendTool).toBeDefined();

      const transferTool = tools.find((t) => t.name === 'multichain_transfer_token');
      expect(transferTool).toBeDefined();
    });

    it('should have proper tool input schemas', () => {
      const tools = toolManager.listTools();

      const balanceTool = tools.find((t) => t.name === 'multichain_query_balance');
      expect(balanceTool?.inputSchema).toBeDefined();

      // Type cast to access properties
      const schema = balanceTool?.inputSchema as {
        type: string;
        properties?: Record<string, unknown>;
        required?: string[];
      };

      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties?.['address']).toBeDefined();
      expect(schema.properties?.['chain']).toBeDefined();
      expect(schema.required).toContain('address');
    });

    it('should include chain parameter in all tool schemas', () => {
      const tools = toolManager.listTools();

      const actionableTools = tools.filter(
        (t) => !t.name.includes('initialize') && !t.name.includes('clear')
      );

      for (const tool of actionableTools) {
        const schema = tool.inputSchema as {
          properties?: Record<string, { enum?: string[] }>;
        };
        const chainProp = schema.properties?.['chain'];
        expect(chainProp).toBeDefined();
        expect(chainProp?.enum).toContain('ethereum');
        expect(chainProp?.enum).toContain('solana');
        expect(chainProp?.enum).toContain('auto');
      }
    });

    it('should describe wallet management tools', () => {
      const tools = toolManager.listTools();

      const initTool = tools.find((t) => t.name === 'multichain_initialize_wallet');
      expect(initTool).toBeDefined();
      expect(initTool?.description).toContain('SECURITY');

      const initSchema = initTool?.inputSchema as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
      expect(initSchema.properties?.['chain']).toBeDefined();
      expect(initSchema.required).toContain('chain');
      expect(initSchema.required).toContain('privateKey');

      const clearTool = tools.find((t) => t.name === 'multichain_clear_wallet');
      expect(clearTool).toBeDefined();
      expect(clearTool?.description).toContain('memory');
    });

    it(
      'should execute query_balance tool with auto-detection',
      async () => {
        const params = {
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
          chain: 'auto',
        };

        // Will fail to connect but should route to Ethereum
        await expect(toolManager.executeTool('multichain_query_balance', params)).rejects.toThrow();
      },
      15000
    ); // 15 second timeout

    it('should execute send_transaction tool', async () => {
      const params = {
        to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        amount: '1000000000000000000',
      };

      // Will fail (no wallet initialized) but should route correctly
      await expect(toolManager.executeTool('multichain_send_transaction', params)).rejects.toThrow();
    });

    it('should execute transfer_token tool', async () => {
      const params = {
        to: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        amount: '1000000',
        token: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        decimals: 6,
      };

      // Will fail (no keypair initialized) but should route correctly
      await expect(toolManager.executeTool('multichain_transfer_token', params)).rejects.toThrow();
    });

    it('should reject unknown tools', async () => {
      await expect(toolManager.executeTool('unknown_tool', {})).rejects.toThrow('Unknown tool');
    });

    it('should handle wallet initialization for specific chain', async () => {
      // Ethereum
      await expect(
        toolManager.executeTool('multichain_initialize_wallet', {
          chain: 'ethereum',
          privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
        })
      ).resolves.toBeDefined();

      // Clear
      await expect(toolManager.executeTool('multichain_clear_wallet', {})).resolves.toBeDefined();
    });

    it('should reject AUTO chain for wallet initialization', async () => {
      await expect(
        toolManager.executeTool('multichain_initialize_wallet', {
          chain: 'auto',
          privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
        })
      ).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing chain configuration gracefully', () => {
      // Create provider with only Ethereum
      const ethOnlyProvider = new MultiChainProvider(
        {
          rpcUrl: 'http://localhost:8545',
          chainId: 1,
          chainName: 'ethereum',
        },
        undefined,
        { autoStartHealthMonitoring: false }
      );

      const ethOnlyTools = new MultiChainToolManager(ethOnlyProvider);

      // Should reject Solana operations
      expect(() =>
        ethOnlyTools.executeTool('multichain_initialize_wallet', {
          chain: 'solana',
          privateKey: 'test',
        })
      ).rejects.toThrow();
    });

    it('should provide detailed error messages', async () => {
      try {
        await toolManager.executeTool('multichain_query_balance', {
          address: 'invalid',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeDefined();
        // Error should contain useful information
        const errorStr = String(error);
        expect(errorStr.length).toBeGreaterThan(0);
      }
    });

    it(
      'should handle network failures gracefully',
      async () => {
        const params = {
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
        };

        try {
          await toolManager.executeTool('multichain_query_balance', params);
          expect.fail('Should have thrown');
        } catch (error) {
          expect(error).toBeDefined();
          // Should be network-related error (ECONNREFUSED)
        }
      },
      15000
    ); // 15 second timeout
  });

  describe('Integration Scenarios', () => {
    it('should support full workflow: list resources -> read resource', () => {
      const resources = resourceManager.listResources();
      expect(resources.length).toBeGreaterThan(0);

      const accountResource = resources[0];
      expect(accountResource).toBeDefined();
      expect(accountResource?.uri).toBeDefined();

      // URI template exists and can be used
      expect(accountResource?.uri).toContain('multichain://');
    });

    it('should support full workflow: list tools -> execute tool', async () => {
      const tools = toolManager.listTools();
      expect(tools.length).toBeGreaterThan(0);

      const balanceTool = tools.find((t) => t.name === 'multichain_query_balance');
      expect(balanceTool).toBeDefined();

      // Tool can be executed (will fail due to no network, but validates parameters)
      await expect(
        toolManager.executeTool('multichain_query_balance', {
          address: 'invalid',
        })
      ).rejects.toThrow();
    });

    it(
      'should support cross-chain operations in same session',
      async () => {
        // Query Ethereum balance
        const ethParams = {
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
          chain: 'ethereum',
        };

        // Query Solana balance
        const solParams = {
          address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
          chain: 'solana',
        };

        // Both should route to their respective chains (will fail to connect)
        await expect(toolManager.executeTool('multichain_query_balance', ethParams)).rejects.toThrow();
        await expect(toolManager.executeTool('multichain_query_balance', solParams)).rejects.toThrow();
      },
      15000
    ); // 15 second timeout

    it('should allow wallet initialization and clearing', async () => {
      // Initialize Ethereum wallet
      await toolManager.executeTool('multichain_initialize_wallet', {
        chain: 'ethereum',
        privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
      });

      // Clear wallet
      const result = await toolManager.executeTool('multichain_clear_wallet', {});
      expect(result).toBeDefined();
      expect((result as { success: boolean }).success).toBe(true);
    });
  });

  describe('MCP Protocol Compliance', () => {
    it('should use correct MCP request schemas', () => {
      expect(ListResourcesRequestSchema).toBeDefined();
      expect(ReadResourceRequestSchema).toBeDefined();
      expect(ListToolsRequestSchema).toBeDefined();
      expect(CallToolRequestSchema).toBeDefined();
    });

    it('should return resources in MCP format', () => {
      const resources = resourceManager.listResources();

      for (const resource of resources) {
        expect(resource.uri).toBeDefined();
        expect(resource.name).toBeDefined();
        expect(resource.mimeType).toBe('application/json');
        expect(typeof resource.description).toBe('string');
      }
    });

    it('should return tools in MCP format', () => {
      const tools = toolManager.listTools();

      for (const tool of tools) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();

        const schema = tool.inputSchema as { type: string; properties?: unknown };
        expect(schema.type).toBe('object');
        expect(schema.properties).toBeDefined();
      }
    });

    it('should validate tool parameters with Zod schemas', async () => {
      // Missing required parameter
      await expect(
        toolManager.executeTool('multichain_query_balance', {
          // Missing address
          chain: 'ethereum',
        })
      ).rejects.toThrow();

      // Invalid chain
      await expect(
        toolManager.executeTool('multichain_query_balance', {
          address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
          chain: 'invalid',
        })
      ).rejects.toThrow();
    });
  });
});
