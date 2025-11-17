/**
 * NFT Agent
 *
 * Specialized agent for NFT operations:
 * - Mint ERC721/ERC1155 NFTs
 * - Transfer NFTs
 * - Batch minting for collections
 * - Metadata upload to IPFS/Arweave
 * - Collection statistics
 * - Royalty configuration (EIP-2981)
 *
 * Integrates with:
 * - TransactionBuilder (transaction construction)
 * - Contract Analyzer (contract validation)
 * - WalletManager (transaction signing)
 */

import { JsonRpcProvider } from 'ethers';
import { Connection } from '@solana/web3.js';
import { SpecializedAgentBase } from './SpecializedAgentBase.js';
import { TransactionBuilder } from '../subagents/TransactionBuilder.js';
import { ContractAnalyzer } from '../subagents/ContractAnalyzer.js';
import { WalletManager } from '../subagents/WalletManager.js';
import { RPCBatcher } from '../utils/rpc-batcher.js';
import { sharedCache } from '../utils/shared-cache.js';
import type {
  Task,
  TaskPlan,
  Result,
  ValidationResult,
  Step,
  AgentConfig,
} from '../types/agent.js';
import type {
  NFTMetadata,
  MintERC721Params,
  MintERC1155Params,
  MintResult,
  NFTTransferParams,
  BatchMintParams,
  CollectionStats,
  NFTAgentConfig,
  NFTTaskType,
} from '../types/specialized-agents.js';
import { logger } from '../utils/index.js';

/**
 * Providers for NFT operations
 */
export interface NFTProviders {
  ethereum?: JsonRpcProvider;
  polygon?: JsonRpcProvider;
  solana?: Connection;
}

/**
 * NFT Agent
 *
 * Handles all NFT-related operations with proper validation and security checks.
 */
export class NFTAgent extends SpecializedAgentBase {
  private readonly _providers: NFTProviders;
  private readonly _nftConfig: NFTAgentConfig;
  private readonly _txBuilder: TransactionBuilder;
  private readonly _contractAnalyzer: ContractAnalyzer;
  private readonly _walletManager: WalletManager;

  // Optimization utilities
  private readonly batchers: Map<string, RPCBatcher> = new Map();

  constructor(
    config: AgentConfig,
    providers: NFTProviders,
    nftConfig: NFTAgentConfig = {}
  ) {
    super(config);

    this._providers = providers;
    this._nftConfig = nftConfig;

    // Initialize subagents - build config conditionally to handle optional providers
    const txBuilderConfig: {
      enableSimulation?: boolean;
      ethereumProvider?: JsonRpcProvider;
      solanaConnection?: Connection;
    } = {};

    if (providers.ethereum) {
      txBuilderConfig.ethereumProvider = providers.ethereum;
    }
    if (providers.solana) {
      txBuilderConfig.solanaConnection = providers.solana;
    }

    this._txBuilder = new TransactionBuilder(txBuilderConfig);

    const primaryProvider = providers.ethereum || providers.polygon;
    if (primaryProvider) {
      this._contractAnalyzer = new ContractAnalyzer({ ethereumProvider: primaryProvider });
    } else {
      this._contractAnalyzer = new ContractAnalyzer({});
    }

    this._walletManager = new WalletManager();

    // Initialize RPC batchers for each provider
    if (providers.ethereum) {
      this.batchers.set('ethereum', new RPCBatcher(providers.ethereum._getConnection().url, {
        maxBatchSize: 50,
        maxWaitTime: 10,
        debug: false,
      }));
    }
    if (providers.polygon) {
      this.batchers.set('polygon', new RPCBatcher(providers.polygon._getConnection().url, {
        maxBatchSize: 50,
        maxWaitTime: 10,
        debug: false,
      }));
    }

    logger.info('NFTAgent initialized', {
      id: this.id,
      chains: Object.keys(providers),
      batchingEnabled: this.batchers.size > 0,
    });
  }

  /**
   * ========================================================================
   * DOMAIN-SPECIFIC METHODS
   * ========================================================================
   */

  /**
   * Mint an ERC721 NFT
   *
   * @param params - Mint parameters
   * @returns Mint result
   */
  async mintERC721(params: MintERC721Params): Promise<MintResult> {
    try {
      const result = await this.executeDomainTaskSafe<MintResult>(
        'nft_mint_erc721',
        params as unknown as Record<string, unknown>
      );

      if (result.success && result.data) {
        return result.data;
      }

      return {
        success: false,
        error: result.error || 'Mint failed',
      };
    } catch (error) {
      logger.error('mintERC721 failed', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Mint an ERC1155 NFT
   *
   * @param params - Mint parameters
   * @returns Mint result
   */
  async mintERC1155(params: MintERC1155Params): Promise<MintResult> {
    try {
      const result = await this.executeDomainTaskSafe<MintResult>(
        'nft_mint_erc1155',
        params as unknown as Record<string, unknown>
      );

      if (result.success && result.data) {
        return result.data;
      }

      return {
        success: false,
        error: result.error || 'Mint failed',
      };
    } catch (error) {
      logger.error('mintERC1155 failed', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Transfer an NFT
   *
   * @param params - Transfer parameters
   * @returns Transfer result (as MintResult with txHash)
   */
  async transferNFT(params: NFTTransferParams): Promise<MintResult> {
    try {
      const result = await this.executeDomainTaskSafe<MintResult>(
        'nft_transfer',
        params as unknown as Record<string, unknown>
      );

      if (result.success && result.data) {
        return result.data;
      }

      return {
        success: false,
        error: result.error || 'Transfer failed',
      };
    } catch (error) {
      logger.error('transferNFT failed', { error, params });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Batch mint NFTs for a collection
   *
   * @param params - Batch mint parameters
   * @returns Array of mint results
   */
  async batchMint(params: BatchMintParams): Promise<MintResult[]> {
    try {
      const result = await this.executeDomainTask<MintResult[]>(
        'nft_batch_mint',
        params as unknown as Record<string, unknown>
      );
      return result;
    } catch (error) {
      logger.error('batchMint failed', { error, params });
      return [];
    }
  }

  /**
   * Upload NFT metadata to IPFS
   *
   * @param metadata - NFT metadata
   * @returns IPFS URI
   */
  async uploadMetadata(metadata: NFTMetadata): Promise<string> {
    try {
      const result = await this.executeDomainTask<{ uri: string }>(
        'nft_upload_metadata',
        { metadata }
      );
      return result.uri;
    } catch (error) {
      logger.error('uploadMetadata failed', { error, metadata });
      throw error;
    }
  }

  /**
   * Get collection statistics
   *
   * @param contract - Contract address
   * @param chain - Blockchain chain
   * @returns Collection stats
   */
  async getCollectionStats(contract: string, chain: string): Promise<CollectionStats> {
    try {
      const result = await this.executeDomainTask<CollectionStats>(
        'nft_get_collection_stats',
        { contract, chain }
      );
      return result;
    } catch (error) {
      logger.error('getCollectionStats failed', { error, contract, chain });
      throw error;
    }
  }

  /**
   * ========================================================================
   * BASE AGENT IMPLEMENTATION
   * ========================================================================
   */

  /**
   * Plan task execution
   *
   * @param task - Task to plan
   * @returns Task plan
   */
  async plan(task: Task): Promise<TaskPlan> {
    logger.info(`NFTAgent planning task: ${task.type}`, { taskId: task.id });

    const taskType = task.type as NFTTaskType;

    switch (taskType) {
      case 'nft_mint_erc721':
        return this.planMintERC721(task);
      case 'nft_mint_erc1155':
        return this.planMintERC1155(task);
      case 'nft_transfer':
        return this.planTransfer(task);
      case 'nft_batch_mint':
        return this.planBatchMint(task);
      case 'nft_upload_metadata':
        return this.planUploadMetadata(task);
      case 'nft_get_collection_stats':
        return this.planGetCollectionStats(task);
      default:
        throw new Error(`Unknown NFT task type: ${task.type}`);
    }
  }

  /**
   * Plan ERC721 mint task
   */
  private planMintERC721(task: Task): TaskPlan {
    const params = task.params as unknown as MintERC721Params;
    const stepPrefix = task.id;

    const steps: Step[] = [
      // Step 1: Upload metadata to IPFS
      this.createStep(
        `${stepPrefix}-upload-metadata`,
        'upload_to_ipfs',
        { metadata: params.metadata },
        [],
        15000
      ),

      // Step 2: Validate contract
      this.createStep(
        `${stepPrefix}-validate-contract`,
        'validate_nft_contract',
        { contract: params.contract, chain: params.chain },
        [],
        10000
      ),

      // Step 3: Build mint transaction
      this.createStep(
        `${stepPrefix}-build-tx`,
        'build_mint_transaction',
        {
          contract: params.contract,
          recipient: params.recipient,
          metadataUri: 'from-step-1',
          royalty: params.royaltyBps,
        },
        [`${stepPrefix}-upload-metadata`, `${stepPrefix}-validate-contract`],
        10000
      ),

      // Step 4: Execute mint
      this.createStep(
        `${stepPrefix}-execute`,
        'execute_mint_transaction',
        { transaction: 'from-step-3' },
        [`${stepPrefix}-build-tx`],
        60000
      ),
    ];

    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps,
      dependencies: this.buildDependencies(steps),
      estimatedTime: steps.reduce((sum, s) => sum + s.timeout, 0),
      requiredResources: [
        { type: 'rpc', name: `${params.chain}-rpc`, required: true },
        { type: 'wallet', name: 'signer', required: true },
        { type: 'api', name: 'ipfs', required: true },
      ],
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  /**
   * Plan ERC1155 mint task
   */
  private planMintERC1155(task: Task): TaskPlan {
    // Similar to ERC721 with amount parameter
    return this.planMintERC721(task); // Simplified - would have amount handling
  }

  /**
   * Plan transfer task
   */
  private planTransfer(task: Task): TaskPlan {
    const params = task.params as unknown as NFTTransferParams;
    const stepPrefix = task.id;

    const steps: Step[] = [
      this.createStep(
        `${stepPrefix}-validate-ownership`,
        'validate_nft_ownership',
        { contract: params.contract, tokenId: params.tokenId, owner: params.from },
        [],
        5000
      ),

      this.createStep(
        `${stepPrefix}-build-tx`,
        'build_transfer_transaction',
        params as unknown as Record<string, unknown>,
        [`${stepPrefix}-validate-ownership`],
        10000
      ),

      this.createStep(
        `${stepPrefix}-execute`,
        'execute_transfer_transaction',
        { transaction: 'from-step-2' },
        [`${stepPrefix}-build-tx`],
        60000
      ),
    ];

    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps,
      dependencies: this.buildDependencies(steps),
      estimatedTime: steps.reduce((sum, s) => sum + s.timeout, 0),
      requiredResources: [
        { type: 'rpc', name: `${params.chain}-rpc`, required: true },
        { type: 'wallet', name: 'signer', required: true },
      ],
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  /**
   * Plan batch mint task
   */
  private planBatchMint(task: Task): TaskPlan {
    const params = task.params as unknown as BatchMintParams;
    const stepPrefix = task.id;

    const steps: Step[] = [
      this.createStep(
        `${stepPrefix}-upload-all-metadata`,
        'batch_upload_to_ipfs',
        { metadataList: params.metadataList },
        [],
        30000
      ),

      this.createStep(
        `${stepPrefix}-build-batch-tx`,
        'build_batch_mint_transaction',
        {
          contract: params.contract,
          recipients: params.recipients,
          metadataUris: 'from-step-1',
        },
        [`${stepPrefix}-upload-all-metadata`],
        15000
      ),

      this.createStep(
        `${stepPrefix}-execute`,
        'execute_batch_mint_transaction',
        { transaction: 'from-step-2' },
        [`${stepPrefix}-build-batch-tx`],
        120000
      ),
    ];

    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps,
      dependencies: this.buildDependencies(steps),
      estimatedTime: steps.reduce((sum, s) => sum + s.timeout, 0),
      requiredResources: [
        { type: 'rpc', name: `${params.chain}-rpc`, required: true },
        { type: 'wallet', name: 'signer', required: true },
        { type: 'api', name: 'ipfs', required: true },
      ],
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  /**
   * Plan upload metadata task
   */
  private planUploadMetadata(task: Task): TaskPlan {
    const stepPrefix = task.id;

    const steps: Step[] = [
      this.createStep(
        `${stepPrefix}-upload`,
        'upload_to_ipfs',
        task.params,
        [],
        15000
      ),
    ];

    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps,
      dependencies: [],
      estimatedTime: 15000,
      requiredResources: [{ type: 'api', name: 'ipfs', required: true }],
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  /**
   * Plan get collection stats task
   */
  private planGetCollectionStats(task: Task): TaskPlan {
    const stepPrefix = task.id;

    const steps: Step[] = [
      this.createStep(
        `${stepPrefix}-fetch-stats`,
        'fetch_collection_statistics',
        task.params,
        [],
        10000
      ),
    ];

    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps,
      dependencies: [],
      estimatedTime: 10000,
      requiredResources: [{ type: 'rpc', name: 'rpc', required: true }],
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  /**
   * Execute a single step
   *
   * @param step - Step to execute
   * @param previousResults - Results from previous steps
   * @returns Step execution result
   */
  protected async executeStep(
    step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result> {
    logger.debug(`Executing NFT step: ${step.action}`, { stepId: step.id });

    try {
      switch (step.action) {
        case 'upload_to_ipfs':
          return await this.stepUploadToIPFS(step);

        case 'validate_nft_contract':
          return await this.stepValidateContract(step);

        case 'build_mint_transaction':
          return await this.stepBuildMintTransaction(step, previousResults);

        case 'execute_mint_transaction':
          return await this.stepExecuteMintTransaction(step, previousResults);

        case 'validate_nft_ownership':
          return await this.stepValidateOwnership(step);

        case 'build_transfer_transaction':
          return await this.stepBuildTransferTransaction(step);

        case 'execute_transfer_transaction':
          return await this.stepExecuteTransferTransaction(step, previousResults);

        case 'batch_upload_to_ipfs':
          return await this.stepBatchUploadToIPFS(step);

        case 'build_batch_mint_transaction':
          return await this.stepBuildBatchMintTransaction(step, previousResults);

        case 'execute_batch_mint_transaction':
          return await this.stepExecuteBatchMintTransaction(step, previousResults);

        case 'fetch_collection_statistics':
          return await this.stepFetchCollectionStats(step);

        default:
          return this.createFailureResult(`Unknown step action: ${step.action}`);
      }
    } catch (error) {
      return this.createFailureResult(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Step: Upload to IPFS
   */
  private async stepUploadToIPFS(step: Step): Promise<Result> {
    const { metadata } = step.params as { metadata: NFTMetadata };

    logger.info('Uploading metadata to IPFS', { name: metadata.name });

    // Mock IPFS upload
    // In production: use Pinata, nft.storage, or Web3.Storage
    const mockCID = 'Qm' + Array.from({ length: 44 }, () =>
      Math.random().toString(36).charAt(2)
    ).join('');

    const uri = `ipfs://${mockCID}`;

    logger.info('Metadata uploaded to IPFS', { uri });

    return this.createSuccessResult({ uri });
  }

  /**
   * Step: Validate NFT contract
   */
  private async stepValidateContract(step: Step): Promise<Result> {
    const { contract, chain } = step.params as { contract: string; chain: string };

    // Cache contract validation (contracts don't change, long TTL)
    const cacheKey = `nft-contract:${chain}:${contract}`;

    const validation = await sharedCache.get(
      cacheKey,
      async () => {
        logger.info('Validating NFT contract', { contract, chain });

        // Mock validation
        if (!contract || contract.length !== 42) {
          throw new Error('Invalid contract address');
        }

        return { valid: true };
      },
      300000 // 5 minute TTL (contracts rarely change)
    );

    return this.createSuccessResult(validation);
  }

  /**
   * Step: Build mint transaction
   */
  private async stepBuildMintTransaction(
    step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result> {
    const { contract, recipient } = step.params as {
      contract: string;
      recipient: string;
    };

    // Get metadata URI from previous step
    const uploadStepId = Array.from(previousResults.keys()).find((id) =>
      id.includes('upload-metadata')
    );
    const metadataUri = uploadStepId
      ? this.getStepDataSafe<{ uri: string }>(uploadStepId, previousResults)?.uri
      : undefined;

    if (!metadataUri) {
      return this.createFailureResult('No metadata URI from previous step');
    }

    logger.info('Building mint transaction', { contract, recipient, metadataUri });

    // Mock transaction
    const transaction = {
      to: contract,
      data: `0xmint(${recipient},${metadataUri})`,
      value: '0',
    };

    return this.createSuccessResult({ transaction, metadataUri });
  }

  /**
   * Step: Execute mint transaction
   */
  private async stepExecuteMintTransaction(
    _step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result<MintResult>> {
    const buildTxStepId = Array.from(previousResults.keys()).find((id) =>
      id.includes('build-tx')
    );

    if (!buildTxStepId) {
      return this.createFailureResult('No transaction data') as Result<MintResult>;
    }

    const txData = this.getStepDataSafe<{
      transaction: unknown;
      metadataUri: string;
    }>(buildTxStepId, previousResults);

    if (!txData) {
      return this.createFailureResult('Invalid transaction data') as Result<MintResult>;
    }

    logger.info('Executing mint transaction');

    // Mock execution
    const mockTxHash =
      '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const mockTokenId = Math.floor(Math.random() * 10000).toString();

    const mintResult: MintResult = {
      success: true,
      txHash: mockTxHash,
      tokenId: mockTokenId,
      metadataUri: txData.metadataUri,
    };

    logger.info('Mint successful', { txHash: mintResult.txHash, tokenId: mintResult.tokenId });

    return this.createSuccessResult(mintResult);
  }

  /**
   * Step: Validate ownership
   */
  private async stepValidateOwnership(step: Step): Promise<Result> {
    const { tokenId } = step.params as { tokenId: string };

    logger.info('Validating NFT ownership', { tokenId });

    // Mock validation
    return this.createSuccessResult({ valid: true });
  }

  /**
   * Step: Build transfer transaction
   */
  private async stepBuildTransferTransaction(step: Step): Promise<Result> {
    const params = step.params as unknown as NFTTransferParams;

    logger.info('Building transfer transaction', params);

    // Mock transaction
    const transaction = {
      to: params.contract,
      data: `0xtransferFrom(${params.from},${params.to},${params.tokenId})`,
      value: '0',
    };

    return this.createSuccessResult({ transaction });
  }

  /**
   * Step: Execute transfer transaction
   */
  private async stepExecuteTransferTransaction(
    _step: Step,
    _previousResults: Map<string, Result>
  ): Promise<Result<MintResult>> {
    // Mock execution
    const mockTxHash =
      '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    const result: MintResult = {
      success: true,
      txHash: mockTxHash,
    };

    return this.createSuccessResult(result) as Result<MintResult>;
  }

  /**
   * Step: Batch upload to IPFS
   */
  private async stepBatchUploadToIPFS(step: Step): Promise<Result> {
    const { metadataList } = step.params as { metadataList: readonly NFTMetadata[] };

    logger.info('Batch uploading metadata to IPFS', { count: metadataList.length });

    // Mock batch upload
    const uris = metadataList.map(
      () =>
        `ipfs://Qm${Array.from({ length: 44 }, () => Math.random().toString(36).charAt(2)).join('')}`
    );

    return this.createSuccessResult({ uris });
  }

  /**
   * Step: Build batch mint transaction
   */
  private async stepBuildBatchMintTransaction(
    step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result> {
    const { contract, recipients } = step.params as {
      contract: string;
      recipients: readonly string[];
    };

    // Get URIs from previous step
    const uploadStepId = Array.from(previousResults.keys()).find((id) =>
      id.includes('upload-all-metadata')
    );
    const uris = uploadStepId
      ? this.getStepDataSafe<{ uris: string[] }>(uploadStepId, previousResults)?.uris
      : undefined;

    if (!uris) {
      return this.createFailureResult('No metadata URIs from previous step');
    }

    logger.info('Building batch mint transaction', {
      contract,
      count: recipients.length,
    });

    // Mock transaction
    const transaction = {
      to: contract,
      data: `0xbatchMint(${JSON.stringify(recipients)},${JSON.stringify(uris)})`,
      value: '0',
    };

    return this.createSuccessResult({ transaction, uris });
  }

  /**
   * Step: Execute batch mint transaction
   */
  private async stepExecuteBatchMintTransaction(
    _step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result<MintResult[]>> {
    const buildTxStepId = Array.from(previousResults.keys()).find((id) =>
      id.includes('build-batch-tx')
    );

    const txData = buildTxStepId
      ? this.getStepDataSafe<{ uris: string[] }>(buildTxStepId, previousResults)
      : undefined;

    const count = txData?.uris.length || 0;

    logger.info('Executing batch mint transaction', { count });

    // Mock execution
    const mockTxHash =
      '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    const results: MintResult[] = Array.from({ length: count }, (_, i) => {
      const baseResult: MintResult = {
        success: true,
        txHash: mockTxHash,
        tokenId: (1000 + i).toString(),
      };

      // Conditionally add metadataUri if available
      if (txData?.uris[i]) {
        return {
          ...baseResult,
          metadataUri: txData.uris[i],
        };
      }

      return baseResult;
    });

    return this.createSuccessResult(results);
  }

  /**
   * Step: Fetch collection statistics
   */
  private async stepFetchCollectionStats(step: Step): Promise<Result<CollectionStats>> {
    const { contract, chain } = step.params as { contract: string; chain: string };

    // Cache collection stats with 30-second time bucket
    const timeBucket = Math.floor(Date.now() / 30000) * 30000;
    const cacheKey = `nft-stats:${chain}:${contract}:${timeBucket}`;

    const stats = await sharedCache.get(
      cacheKey,
      async () => {
        logger.info('Fetching collection statistics', { contract, chain });

        // Mock stats
        const collectionStats: CollectionStats = {
          contract,
          totalSupply: 10000,
          ownersCount: 3500,
          floorPrice: '0.5',
          volumeTraded: '15000',
          chain: chain as 'ethereum',
        };

        return collectionStats;
      },
      30000 // 30 second TTL
    );

    return this.createSuccessResult(stats);
  }

  /**
   * Validate execution result
   *
   * @param result - Result to validate
   * @returns Validation result
   */
  async validate(result: Result): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!result.success) {
      if (!result.error) {
        errors.push('Failed result must have error message');
      }
      return { valid: errors.length === 0, errors };
    }

    // Check for data
    if (!result.data) {
      errors.push('Successful result must have data');
      return { valid: false, errors };
    }

    const data = result.data as MintResult | MintResult[] | CollectionStats;

    // Validate mint result
    if ('txHash' in data && data.txHash) {
      if (!data.txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
        errors.push('Invalid transaction hash format');
      }

      if ('tokenId' in data && !data.tokenId) {
        warnings.push('Mint result missing token ID');
      }

      if ('metadataUri' in data && !data.metadataUri) {
        errors.push('Mint result missing metadata URI');
      }
    }

    // Validate collection stats
    if ('totalSupply' in data) {
      if (data.totalSupply < 0) {
        errors.push('Invalid total supply');
      }
    }

    const validationResult: ValidationResult = {
      valid: errors.length === 0,
    };

    if (errors.length > 0) {
      validationResult.errors = errors;
    }

    if (warnings.length > 0) {
      validationResult.warnings = warnings;
    }

    return validationResult;
  }
}
