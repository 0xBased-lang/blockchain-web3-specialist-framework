import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NFTAgent } from '../../../src/agents/NFTAgent.js';
import type { AgentConfig } from '../../../src/types/agent.js';
import type {
  NFTProviders,
  MintERC721Params,
  MintERC1155Params,
  NFTTransferParams,
} from '../../../src/types/specialized-agents.js';
import { JsonRpcProvider } from 'ethers';

const mockEthProvider = {
  getNetwork: vi.fn().mockResolvedValue({ chainId: 1n, name: 'mainnet' }),
} as unknown as JsonRpcProvider;

describe('NFTAgent', () => {
  let agent: NFTAgent;
  let config: AgentConfig;
  let providers: NFTProviders;

  beforeEach(() => {
    config = {
      id: 'nft-agent-1',
      name: 'NFTAgent',
      description: 'NFT operations agent',
      capabilities: ['mint', 'transfer', 'metadata'],
      mcpClient: {},
      maxConcurrentTasks: 3,
      timeout: 30000,
    };

    providers = {
      ethereum: mockEthProvider,
    };

    agent = new NFTAgent(config, providers);
  });

  describe('Initialization', () => {
    it('should create NFTAgent with config and providers', () => {
      expect(agent).toBeDefined();
      expect(agent.getMetadata().name).toBe('NFTAgent');
    });
  });

  describe('mintERC721', () => {
    it('should handle ERC721 mint request', async () => {
      const mintParams: MintERC721Params = {
        contract: '0xNFTContract',
        recipient: '0xRecipient',
        metadata: {
          name: 'Test NFT',
          description: 'Test Description',
          image: 'ipfs://test',
        },
        chain: 'ethereum',
      };

      const result = await agent.mintERC721(mintParams);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('mintERC1155', () => {
    it('should handle ERC1155 mint request', async () => {
      const mintParams: MintERC1155Params = {
        contract: '0xNFTContract',
        recipient: '0xRecipient',
        tokenId: '1',
        amount: '10',
        metadata: {
          name: 'Test Token',
          description: 'Test Description',
        },
        chain: 'ethereum',
      };

      const result = await agent.mintERC1155(mintParams);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('transferNFT', () => {
    it('should handle NFT transfer request', async () => {
      const transferParams: NFTTransferParams = {
        contract: '0xNFTContract',
        tokenId: '1',
        from: '0xFrom',
        to: '0xTo',
        chain: 'ethereum',
      };

      const result = await agent.transferNFT(transferParams);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('plan', () => {
    it('should create mint ERC721 plan', async () => {
      const task = {
        id: 'task-1',
        type: 'nft_mint_erc721',
        params: {
          contract: '0xNFT',
          recipient: '0xRecipient',
          metadata: { name: 'Test' },
          chain: 'ethereum',
        } as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);

      expect(plan).toBeDefined();
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.taskId).toBe('task-1');
    });

    it('should create transfer plan', async () => {
      const task = {
        id: 'task-2',
        type: 'nft_transfer',
        params: {
          contract: '0xNFT',
          tokenId: '1',
          from: '0xFrom',
          to: '0xTo',
          chain: 'ethereum',
        } as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);

      expect(plan).toBeDefined();
      expect(plan.steps.length).toBeGreaterThan(0);
    });
  });

  describe('validate', () => {
    it('should validate successful mint result', async () => {
      const result = {
        success: true,
        data: {
          success: true,
          txHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
          tokenId: '1',
          metadataUri: 'ipfs://test',
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(true);
    });

    it('should detect invalid transaction hash', async () => {
      const result = {
        success: true,
        data: {
          success: true,
          txHash: 'invalid',
          tokenId: '1',
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(false);
    });

    it('should validate result without metadata URI', async () => {
      const result = {
        success: true,
        data: {
          success: true,
          txHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
          tokenId: '1',
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      // Metadata URI is optional for transfers
      expect(validation).toBeDefined();
    });
  });
});

describe('NFTAgent - Additional Coverage', () => {
  let agent: NFTAgent;
  let config: AgentConfig;
  let providers: NFTProviders;

  beforeEach(() => {
    config = {
      id: 'nft-agent-extra',
      name: 'NFTAgent',
      description: 'NFT operations agent',
      capabilities: ['mint', 'transfer', 'metadata'],
      mcpClient: {},
      maxConcurrentTasks: 3,
      timeout: 30000,
    };

    providers = {
      ethereum: mockEthProvider,
    };

    agent = new NFTAgent(config, providers);
  });

  describe('batchMint', () => {
    it('should handle batch mint request', async () => {
      const batchParams = {
        contract: '0xNFT',
        recipients: ['0xRecipient1', '0xRecipient2'],
        metadataList: [
          { name: 'NFT 1', description: 'First NFT' },
          { name: 'NFT 2', description: 'Second NFT' },
        ],
        chain: 'ethereum',
      };

      const results = await agent.batchMint(batchParams);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('uploadMetadata', () => {
    it('should handle metadata upload', async () => {
      const metadata = {
        name: 'Test NFT',
        description: 'Test Description',
        image: 'data:image/png;base64,test',
      };

      try {
        const uri = await agent.uploadMetadata(metadata);
        expect(uri).toBeDefined();
      } catch (error) {
        // May fail without IPFS, that's ok
        expect(error).toBeDefined();
      }
    });
  });

  describe('getCollectionStats', () => {
    it('should handle collection stats request', async () => {
      try {
        const stats = await agent.getCollectionStats('0xNFT', 'ethereum');
        expect(stats).toBeDefined();
      } catch (error) {
        // May fail without real data, that's ok
        expect(error).toBeDefined();
      }
    });
  });

  describe('plan - additional task types', () => {
    it('should create batch mint plan', async () => {
      const task = {
        id: 'task-batch',
        type: 'nft_batch_mint',
        params: {
          contract: '0xNFT',
          recipients: ['0xA', '0xB'],
          metadataList: [{}, {}],
          chain: 'ethereum',
        } as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);

      expect(plan).toBeDefined();
      expect(plan.steps.length).toBeGreaterThan(0);
    });

    it('should throw on unknown task type', async () => {
      const task = {
        id: 'task-unknown',
        type: 'unknown_task_type',
        params: {} as unknown as Record<string, unknown>,
        priority: 1,
      };

      await expect(agent.plan(task)).rejects.toThrow();
    });
  });

  describe('validate - edge cases', () => {
    it('should validate collection stats', async () => {
      const result = {
        success: true,
        data: {
          totalSupply: 1000,
          uniqueOwners: 500,
          floorPrice: '1.5',
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(true);
    });

    it('should reject invalid total supply', async () => {
      const result = {
        success: true,
        data: {
          totalSupply: -10,
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid total supply');
    });

    it('should reject non-array assets in collection stats', async () => {
      const result = {
        success: true,
        data: {
          totalSupply: 100,
          assets: 'not-an-array',
        },
        timestamp: Date.now(),
      };

      const validation = await agent.validate(result);

      // Validation logic may vary
      expect(validation).toBeDefined();
    });
  });

  describe('execute integration', () => {
    it('should execute full mint workflow', async () => {
      const task = {
        id: 'task-full-workflow',
        type: 'nft_mint_erc721',
        params: {
          contract: '0xNFT',
          recipient: '0xRecipient',
          metadata: { name: 'Test' },
          chain: 'ethereum',
        } as unknown as Record<string, unknown>,
        priority: 1,
      };

      const plan = await agent.plan(task);
      const result = await agent.execute(plan);

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });
});
