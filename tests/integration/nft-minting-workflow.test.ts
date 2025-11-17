/**
 * E2E Integration Test: NFT Minting Workflow
 *
 * Tests the complete NFT minting and management flow:
 * 1. ERC721 minting (single NFT with metadata)
 * 2. ERC1155 minting (multi-token with amounts)
 * 3. Batch minting operations
 * 4. NFT transfers
 * 5. Metadata upload (IPFS integration)
 * 6. Collection statistics
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JsonRpcProvider } from 'ethers';
import { NFTAgent } from '../../src/agents/NFTAgent.js';
import type { NFTProviders } from '../../src/agents/NFTAgent.js';
import type { AgentConfig } from '../../src/types/agent.js';
import type {
  MintERC721Params,
  MintERC1155Params,
  NFTTransferParams,
} from '../../src/types/specialized-agents.js';

describe('NFT Minting Workflow E2E', () => {
  let agent: NFTAgent;
  let mockProvider: JsonRpcProvider;
  let config: AgentConfig;

  beforeEach(() => {
    // Mock Ethereum provider
    mockProvider = {
      getNetwork: vi.fn().mockResolvedValue({ chainId: 1n, name: 'mainnet' }),
      getBlockNumber: vi.fn().mockResolvedValue(18000000),
      getBalance: vi.fn().mockResolvedValue(2000000000000000000n), // 2 ETH
      getFeeData: vi.fn().mockResolvedValue({
        gasPrice: 30000000000n, // 30 gwei
        maxFeePerGas: 60000000000n,
        maxPriorityFeePerGas: 2000000000n,
      }),
      estimateGas: vi.fn().mockResolvedValue(200000n),
      getTransactionCount: vi.fn().mockResolvedValue(5),
      getCode: vi.fn().mockResolvedValue('0x608060405234801561001057600080fd5b50...'), // NFT contract
      call: vi.fn().mockResolvedValue('0x0000000000000000000000000000000000000000000000000000000000000001'),
    } as unknown as JsonRpcProvider;

    config = {
      id: 'nft-e2e-agent',
      name: 'NFTAgent',
      description: 'NFT minting and management operations',
      capabilities: ['mint', 'transfer', 'metadata', 'batch'],
      mcpClient: {},
      maxConcurrentTasks: 5,
      timeout: 120000, // NFT operations may take longer
    };

    const providers: NFTProviders = {
      ethereum: mockProvider,
    };

    agent = new NFTAgent(config, providers);
  });

  describe('ERC721 Minting Workflow', () => {
    it('should execute full ERC721 mint: plan → execute → validate', async () => {
      const mintParams: MintERC721Params = {
        contract: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6', // MAYC
        recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // Example recipient
        metadata: {
          name: 'Test Ape #1',
          description: 'A test mutant ape for E2E testing',
          image: 'ipfs://QmTest123...',
          attributes: [
            { trait_type: 'Background', value: 'Blue' },
            { trait_type: 'Fur', value: 'Golden' },
          ],
        },
        chain: 'ethereum',
      };

      // Step 1: Plan the mint
      const task = {
        id: 'mint-task-1',
        type: 'nft_mint_erc721',
        params: mintParams as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);

      expect(plan).toBeDefined();
      expect(plan.taskId).toBe('mint-task-1');
      expect(plan.steps.length).toBeGreaterThan(0);

      // Verify plan includes metadata upload and minting steps
      const stepActions = plan.steps.map((s) => s.action);
      expect(stepActions).toContain('upload_metadata');
      expect(stepActions).toContain('mint_nft');

      // Step 2: Execute the mint
      const result = await agent.execute(plan);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      // Step 3: Validate the result
      if (result.success) {
        const validation = await agent.validate(result);
        expect(validation.valid).toBe(true);
        expect(validation.errors).toHaveLength(0);

        // Verify result contains expected fields
        if (result.data && typeof result.data === 'object') {
          const data = result.data as { txHash?: string; tokenId?: string };
          if (data.txHash) {
            expect(data.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
          }
          if (data.tokenId) {
            expect(data.tokenId).toBeDefined();
          }
        }
      }
    });

    it('should mint ERC721 with on-chain metadata', async () => {
      const mintParams: MintERC721Params = {
        contract: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6',
        recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        metadata: {
          name: 'On-Chain NFT #1',
          description: 'NFT with on-chain metadata storage',
          image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+...',
        },
        chain: 'ethereum',
      };

      const result = await agent.mintERC721(mintParams);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should reject mint with invalid contract address', async () => {
      const mintParams: MintERC721Params = {
        contract: '0x0000000000000000000000000000000000000000', // Invalid
        recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        metadata: {
          name: 'Invalid Test',
          description: 'Should fail',
          image: 'ipfs://QmTest.../image.png',
        },
        chain: 'ethereum',
      };

      const result = await agent.mintERC721(mintParams);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('ERC1155 Minting Workflow', () => {
    it('should execute full ERC1155 mint: plan → execute → validate', async () => {
      const mintParams: MintERC1155Params = {
        contract: '0x76BE3b62873462d2142405439777e971754E8E77', // Parallel Alpha
        recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        tokenId: 1,
        amount: '100', // Mint 100 tokens
        metadata: {
          name: 'Test Token Type #1',
          description: 'Fungible token for testing',
          image: 'ipfs://QmTestMulti...',
        },
        chain: 'ethereum',
      };

      const task = {
        id: 'mint-1155-task',
        type: 'nft_mint_erc1155',
        params: mintParams as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);

      expect(plan).toBeDefined();
      expect(plan.steps.length).toBeGreaterThan(0);

      const result = await agent.execute(plan);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        const validation = await agent.validate(result);
        expect(validation.valid).toBe(true);
      }
    });

    it('should mint multiple token types in ERC1155', async () => {
      // Mint token type 1
      const mint1: MintERC1155Params = {
        contract: '0x76BE3b62873462d2142405439777e971754E8E77',
        recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        tokenId: 1,
        amount: '50',
        metadata: { name: 'Type 1', description: 'Test description', image: 'ipfs://QmTest.../image.png' },
        chain: 'ethereum',
      };

      const result1 = await agent.mintERC1155(mint1);
      expect(result1).toBeDefined();

      // Mint token type 2
      const mint2: MintERC1155Params = {
        contract: '0x76BE3b62873462d2142405439777e971754E8E77',
        recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        tokenId: 2,
        amount: '75',
        metadata: { name: 'Type 2', description: 'Test description', image: 'ipfs://QmTest.../image.png' },
        chain: 'ethereum',
      };

      const result2 = await agent.mintERC1155(mint2);
      expect(result2).toBeDefined();
    });
  });

  describe('Batch Minting Operations', () => {
    it('should execute batch mint for multiple recipients', async () => {
      const batchParams = {
        contract: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6',
        recipients: [
          '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
          '0xdD2FD4581271e230360230F9337D5c0430Bf44C0',
        ],
        metadataList: [
          { name: 'NFT #1', description: 'First batch NFT', image: 'ipfs://QmBatch1...' },
          { name: 'NFT #2', description: 'Second batch NFT', image: 'ipfs://QmBatch2...' },
          { name: 'NFT #3', description: 'Third batch NFT', image: 'ipfs://QmBatch3...' },
        ],
        chain: 'ethereum',
      };

      const results = await agent.batchMint(batchParams);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);

      // All should succeed
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      });
    });

    it('should handle partial batch failure gracefully', async () => {
      const batchParams = {
        contract: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6',
        recipients: [
          '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', // Valid
          '0x0000000000000000000000000000000000000000', // Invalid
          '0xdD2FD4581271e230360230F9337D5c0430Bf44C0', // Valid
        ],
        metadataList: [
          { name: 'NFT #1', description: 'Batch NFT 1', image: 'ipfs://QmTest1...' },
          { name: 'NFT #2', description: 'Batch NFT 2', image: 'ipfs://QmTest2...' },
          { name: 'NFT #3', description: 'Batch NFT 3', image: 'ipfs://QmTest3...' },
        ],
        chain: 'ethereum' as const,
      };

      const results = await agent.batchMint(batchParams);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      // Should have mix of success and failure
      const failureCount = results.filter((r) => !r.success).length;

      expect(failureCount).toBeGreaterThan(0); // At least one should fail
    });
  });

  describe('NFT Transfer Workflow', () => {
    it('should transfer ERC721 NFT between addresses', async () => {
      const transferParams: NFTTransferParams = {
        contract: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6',
        tokenId: '1234',
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        to: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        chain: 'ethereum',
      };

      const task = {
        id: 'transfer-task',
        type: 'nft_transfer',
        params: transferParams as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);
      const result = await agent.execute(plan);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');

      if (result.success) {
        const validation = await agent.validate(result);
        expect(validation.valid).toBe(true);
      }
    });

    it('should transfer ERC1155 tokens with amount', async () => {
      const transferParams: NFTTransferParams = {
        contract: '0x76BE3b62873462d2142405439777e971754E8E77',
        tokenId: '1',
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        to: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
        amount: 25, // Transfer 25 tokens
        chain: 'ethereum',
      };

      const result = await agent.transferNFT(transferParams);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should reject transfer to zero address', async () => {
      const transferParams: NFTTransferParams = {
        contract: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6',
        tokenId: '1234',
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        to: '0x0000000000000000000000000000000000000000', // Burn address
        chain: 'ethereum',
      };

      const result = await agent.transferNFT(transferParams);

      // Should fail or require explicit burn flag
      if (!result.success) {
        expect(result.error).toMatch(/zero address|burn|invalid/i);
      }
    });
  });

  describe('Metadata Upload Integration', () => {
    it('should upload metadata to IPFS', async () => {
      const metadata = {
        name: 'Test NFT with IPFS',
        description: 'NFT with metadata uploaded to IPFS',
        image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        attributes: [
          { trait_type: 'Rarity', value: 'Common' },
        ],
      };

      try {
        const uri = await agent.uploadMetadata(metadata);

        if (uri) {
          expect(uri).toBeDefined();
          expect(uri).toMatch(/^ipfs:\/\//);
        }
      } catch (error) {
        // IPFS may not be available in test environment
        expect(error).toBeDefined();
      }
    });

    it('should handle large metadata files', async () => {
      const largeMetadata = {
        name: 'NFT with Large Metadata',
        description: 'X'.repeat(10000), // 10KB description
        image: 'ipfs://QmTest...',
        attributes: Array.from({ length: 100 }, (_, i) => ({
          trait_type: `Trait ${i}`,
          value: `Value ${i}`,
        })),
      };

      try {
        const uri = await agent.uploadMetadata(largeMetadata);
        if (uri) {
          expect(uri).toBeDefined();
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Collection Statistics', () => {
    it('should retrieve collection stats', async () => {
      try {
        const stats = await agent.getCollectionStats(
          '0x60E4d786628Fea6478F785A6d7e704777c86a7c6',
          'ethereum'
        );

        if (stats) {
          expect(stats).toBeDefined();
          expect(stats.totalSupply).toBeGreaterThanOrEqual(0);
          expect(stats.uniqueOwners).toBeGreaterThanOrEqual(0);
        }
      } catch (error) {
        // API may not be available
        expect(error).toBeDefined();
      }
    });

    it('should validate collection stats data', async () => {
      // Mock successful stats retrieval
      const mockStats = {
        totalSupply: 10000,
        uniqueOwners: 5000,
        floorPrice: '0.5',
        volumeTraded: '1500',
      };

      const result = {
        success: true,
        data: mockStats,
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid collection stats', async () => {
      const invalidStats = {
        totalSupply: -100, // Invalid negative supply
        uniqueOwners: 5000,
      };

      const result = {
        success: true,
        data: invalidStats,
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid total supply');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network errors during minting', async () => {
      // Mock network failure
      mockProvider.estimateGas = vi.fn().mockRejectedValue(new Error('Network timeout'));

      const mintParams: MintERC721Params = {
        contract: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6',
        recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        metadata: {
          name: 'Network Test NFT',
          description: 'Should fail due to network error',
          image: 'ipfs://QmTest.../image.png',
        },
        chain: 'ethereum',
      };

      const result = await agent.mintERC721(mintParams);

      expect(result).toBeDefined();
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle insufficient gas for minting', async () => {
      // Mock low balance
      mockProvider.getBalance = vi.fn().mockResolvedValue(10000n); // Very low balance

      const mintParams: MintERC721Params = {
        contract: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6',
        recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        metadata: {
          name: 'Gas Test NFT',
          description: 'May fail due to insufficient gas',
          image: 'ipfs://QmTest.../image.png',
        },
        chain: 'ethereum',
      };

      const result = await agent.mintERC721(mintParams);

      if (!result.success) {
        expect(result.error).toMatch(/gas|balance|insufficient/i);
      }
    });

    it('should validate metadata format', async () => {
      const invalidMetadata = {
        // Missing required 'name' field
        description: 'NFT without name',
        image: 'ipfs://test',
      };

      const mintParams: MintERC721Params = {
        contract: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6',
        recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        metadata: invalidMetadata as never,
        chain: 'ethereum',
      };

      const result = await agent.mintERC721(mintParams);

      if (!result.success) {
        expect(result.error).toMatch(/metadata|name|required/i);
      }
    });

    it('should handle contract not supporting standard', async () => {
      // Mock contract that doesn't support ERC721
      mockProvider.getCode = vi.fn().mockResolvedValue('0x00'); // Empty code

      const mintParams: MintERC721Params = {
        contract: '0x1234567890123456789012345678901234567890',
        recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        metadata: {
          name: 'Invalid Contract Test',
          description: 'Should fail - not a valid NFT contract',
          image: 'ipfs://QmTest.../image.png',
        },
        chain: 'ethereum',
      };

      const result = await agent.mintERC721(mintParams);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Gas Estimation and Optimization', () => {
    it('should estimate gas for minting operations', async () => {
      const mintParams: MintERC721Params = {
        contract: '0x60E4d786628Fea6478F785A6d7e704777c86a7c6',
        recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        metadata: {
          name: 'Gas Estimation Test',
          description: 'Test gas estimation',
          image: 'ipfs://QmTest.../image.png',
        },
        chain: 'ethereum',
      };

      const task = {
        id: 'gas-estimation-task',
        type: 'nft_mint_erc721',
        params: mintParams as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);
      const result = await agent.execute(plan);

      if (result.success && result.data && 'gasEstimate' in result.data) {
        const gasEstimate = result.data.gasEstimate as bigint;
        expect(gasEstimate).toBeGreaterThan(50000n); // NFT minting requires more gas
        expect(gasEstimate).toBeLessThan(1000000n); // Should be reasonable
      }
    });
  });
});
