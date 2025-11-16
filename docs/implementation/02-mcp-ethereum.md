# Ethereum MCP Server Implementation

## Overview

This guide walks through implementing a complete Ethereum MCP (Model Context Protocol) server that provides standardized access to Ethereum and EVM-compatible blockchains.

**Prerequisites**: Completed `01-project-setup.md`

**Estimated Time**: 15-20 hours

**Complexity**: High

---

## What You'll Build

A fully functional MCP server with:
- **Resources**: Read-only data (accounts, contracts, transactions)
- **Tools**: Actions (query balance, send transaction, deploy contract)
- **Prompts**: Templates (contract help, gas estimation)

**File Structure**:
```
src/mcp-servers/ethereum/
├── index.ts                    # Main server entry
├── types.ts                    # TypeScript types
├── resources.ts                # Resource handlers
├── tools.ts                    # Tool implementations
├── prompts.ts                  # Prompt templates
├── provider.ts                 # Ethereum provider setup
├── utils.ts                    # Utility functions
└── __tests__/
    ├── resources.test.ts
    ├── tools.test.ts
    └── integration.test.ts
```

---

## Phase 1: Type Definitions (2 hours)

### Step 1.1: Create Core Types

Create `src/mcp-servers/ethereum/types.ts`:

```typescript
import { z } from 'zod';

// Address validation
export const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')
  .transform((addr) => addr.toLowerCase() as `0x${string}`);

export type Address = z.infer<typeof AddressSchema>;

// Transaction hash validation
export const TxHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash');

export type TxHash = z.infer<typeof TxHashSchema>;

// Hex data validation
export const HexSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]*$/, 'Invalid hex string');

export type Hex = z.infer<typeof HexSchema>;

// BigInt schema with coercion
export const BigIntSchema = z.union([
  z.bigint(),
  z.string().transform((val) => BigInt(val)),
  z.number().transform((val) => BigInt(val)),
]);

// Resource URIs
export const ResourceURISchema = z.object({
  type: z.enum(['account', 'contract', 'transaction', 'block']),
  identifier: z.string(),
});

// Tool call parameters
export const QueryBalanceParamsSchema = z.object({
  address: AddressSchema,
  token: AddressSchema.optional(),
  blockTag: z.union([z.number(), z.literal('latest'), z.literal('pending')]).optional(),
});

export type QueryBalanceParams = z.infer<typeof QueryBalanceParamsSchema>;

export const SendTransactionParamsSchema = z.object({
  to: AddressSchema,
  value: BigIntSchema,
  data: HexSchema.optional(),
  gasLimit: BigIntSchema.optional(),
  gasPrice: BigIntSchema.optional(),
  nonce: z.number().optional(),
});

export type SendTransactionParams = z.infer<typeof SendTransactionParamsSchema>;

export const CallContractParamsSchema = z.object({
  address: AddressSchema,
  abi: z.array(z.record(z.unknown())), // ABI fragment
  method: z.string(),
  args: z.array(z.unknown()).optional(),
});

export type CallContractParams = z.infer<typeof CallContractParamsSchema>;

export const DeployContractParamsSchema = z.object({
  bytecode: HexSchema,
  abi: z.array(z.record(z.unknown())),
  constructorArgs: z.array(z.unknown()).optional(),
  gasLimit: BigIntSchema.optional(),
});

export type DeployContractParams = z.infer<typeof DeployContractParamsSchema>;

// MCP Server configuration
export interface EthereumMCPConfig {
  rpcUrl: string;
  chainId: number;
  chainName: string;
  port: number;
  maxRetries: number;
  retryDelay: number;
}

// Response types
export interface BalanceResponse {
  address: Address;
  balance: string; // BigInt as string
  blockNumber: number;
  token?: Address;
}

export interface TransactionResponse {
  hash: TxHash;
  from: Address;
  to: Address | null;
  value: string;
  gasLimit: string;
  gasPrice: string;
  nonce: number;
  data: Hex;
  blockNumber: number | null;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface ContractCallResponse {
  result: unknown;
  blockNumber: number;
}

export interface DeploymentResponse {
  contractAddress: Address;
  transactionHash: TxHash;
  blockNumber: number;
}
```

**Validation**:
```bash
pnpm typecheck  # Should pass
```

---

## Phase 2: Provider Setup (2 hours)

### Step 2.1: Create Ethereum Provider

Create `src/mcp-servers/ethereum/provider.ts`:

```typescript
import { ethers } from 'ethers';
import pRetry from 'p-retry';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export class EthereumProvider {
  private provider: ethers.JsonRpcProvider;
  private chainId: number;
  private chainName: string;

  constructor(rpcUrl: string, chainId: number, chainName: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.chainId = chainId;
    this.chainName = chainName;
  }

  /**
   * Get the underlying ethers provider
   */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  /**
   * Get balance with retry logic
   */
  async getBalance(address: string, blockTag: ethers.BlockTag = 'latest'): Promise<bigint> {
    return pRetry(
      async () => {
        const balance = await this.provider.getBalance(address, blockTag);
        return balance;
      },
      {
        retries: 3,
        onFailedAttempt: (error) => {
          logger.warn(`Balance query failed, attempt ${error.attemptNumber}`, {
            address,
            error: error.message,
          });
        },
      }
    );
  }

  /**
   * Get transaction with retry logic
   */
  async getTransaction(hash: string): Promise<ethers.TransactionResponse | null> {
    return pRetry(
      async () => {
        const tx = await this.provider.getTransaction(hash);
        return tx;
      },
      {
        retries: 3,
        onFailedAttempt: (error) => {
          logger.warn(`Transaction query failed, attempt ${error.attemptNumber}`, {
            hash,
            error: error.message,
          });
        },
      }
    );
  }

  /**
   * Get transaction receipt with retry logic
   */
  async getTransactionReceipt(
    hash: string
  ): Promise<ethers.TransactionReceipt | null> {
    return pRetry(
      async () => {
        const receipt = await this.provider.getTransactionReceipt(hash);
        return receipt;
      },
      {
        retries: 3,
        onFailedAttempt: (error) => {
          logger.warn(`Receipt query failed, attempt ${error.attemptNumber}`, {
            hash,
            error: error.message,
          });
        },
      }
    );
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    return pRetry(
      async () => {
        const blockNumber = await this.provider.getBlockNumber();
        return blockNumber;
      },
      {
        retries: 3,
        onFailedAttempt: (error) => {
          logger.warn(`Block number query failed, attempt ${error.attemptNumber}`, {
            error: error.message,
          });
        },
      }
    );
  }

  /**
   * Get gas price
   */
  async getGasPrice(): Promise<bigint> {
    return pRetry(
      async () => {
        const feeData = await this.provider.getFeeData();
        return feeData.gasPrice ?? 0n;
      },
      {
        retries: 3,
      }
    );
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(tx: ethers.TransactionRequest): Promise<bigint> {
    return pRetry(
      async () => {
        const estimate = await this.provider.estimateGas(tx);
        return estimate;
      },
      {
        retries: 3,
      }
    );
  }

  /**
   * Call contract (read-only)
   */
  async call(tx: ethers.TransactionRequest): Promise<string> {
    return pRetry(
      async () => {
        const result = await this.provider.call(tx);
        return result;
      },
      {
        retries: 3,
      }
    );
  }

  /**
   * Get contract code
   */
  async getCode(address: string): Promise<string> {
    return pRetry(
      async () => {
        const code = await this.provider.getCode(address);
        return code;
      },
      {
        retries: 3,
      }
    );
  }

  /**
   * Verify provider connection
   */
  async verifyConnection(): Promise<boolean> {
    try {
      const network = await this.provider.getNetwork();
      const actualChainId = Number(network.chainId);

      if (actualChainId !== this.chainId) {
        logger.error('Chain ID mismatch', {
          expected: this.chainId,
          actual: actualChainId,
        });
        return false;
      }

      logger.info('Provider connected', {
        chainId: this.chainId,
        chainName: this.chainName,
      });
      return true;
    } catch (error) {
      logger.error('Provider connection failed', { error });
      return false;
    }
  }
}

// Factory function
export function createEthereumProvider(
  network: 'mainnet' | 'sepolia'
): EthereumProvider {
  const rpcUrl =
    network === 'mainnet'
      ? config.networks.ethereum.mainnet
      : config.networks.ethereum.sepolia;

  const chainId = network === 'mainnet' ? 1 : 11155111;
  const chainName = network === 'mainnet' ? 'Ethereum Mainnet' : 'Ethereum Sepolia';

  return new EthereumProvider(rpcUrl, chainId, chainName);
}
```

### Step 2.2: Create Logger Utility

Create `src/utils/logger.ts`:

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});
```

**Validation**:
```bash
# Test provider connection
pnpm tsx -e "import('./src/mcp-servers/ethereum/provider.js').then(async m => { const p = m.createEthereumProvider('sepolia'); console.log(await p.verifyConnection()); })"
```

---

## Phase 3: Resources Implementation (3 hours)

### Step 3.1: Implement Resource Handlers

Create `src/mcp-servers/ethereum/resources.ts`:

```typescript
import { EthereumProvider } from './provider.js';
import { Address, TxHash } from './types.js';
import { logger } from '../../utils/logger.js';

export class EthereumResources {
  constructor(private provider: EthereumProvider) {}

  /**
   * List all available resource types
   */
  listResourceTypes(): string[] {
    return [
      'ethereum://account/{address}',
      'ethereum://contract/{address}',
      'ethereum://transaction/{hash}',
      'ethereum://block/{number}',
    ];
  }

  /**
   * Get account resource
   */
  async getAccountResource(address: Address) {
    try {
      const [balance, nonce, code, blockNumber] = await Promise.all([
        this.provider.getBalance(address),
        this.provider.getProvider().getTransactionCount(address),
        this.provider.getCode(address),
        this.provider.getBlockNumber(),
      ]);

      const isContract = code !== '0x';

      return {
        uri: `ethereum://account/${address}`,
        type: 'account' as const,
        data: {
          address,
          balance: balance.toString(),
          nonce,
          isContract,
          blockNumber,
        },
      };
    } catch (error) {
      logger.error('Failed to get account resource', { address, error });
      throw new Error(`Failed to get account ${address}: ${error}`);
    }
  }

  /**
   * Get contract resource
   */
  async getContractResource(address: Address) {
    try {
      const [code, balance, blockNumber] = await Promise.all([
        this.provider.getCode(address),
        this.provider.getBalance(address),
        this.provider.getBlockNumber(),
      ]);

      if (code === '0x') {
        throw new Error('Address is not a contract');
      }

      return {
        uri: `ethereum://contract/${address}`,
        type: 'contract' as const,
        data: {
          address,
          bytecode: code,
          balance: balance.toString(),
          blockNumber,
        },
      };
    } catch (error) {
      logger.error('Failed to get contract resource', { address, error });
      throw new Error(`Failed to get contract ${address}: ${error}`);
    }
  }

  /**
   * Get transaction resource
   */
  async getTransactionResource(hash: TxHash) {
    try {
      const [tx, receipt] = await Promise.all([
        this.provider.getTransaction(hash),
        this.provider.getTransactionReceipt(hash),
      ]);

      if (!tx) {
        throw new Error('Transaction not found');
      }

      return {
        uri: `ethereum://transaction/${hash}`,
        type: 'transaction' as const,
        data: {
          hash,
          from: tx.from,
          to: tx.to,
          value: tx.value.toString(),
          gasLimit: tx.gasLimit.toString(),
          gasPrice: tx.gasPrice?.toString() ?? '0',
          nonce: tx.nonce,
          data: tx.data,
          blockNumber: tx.blockNumber,
          status: receipt
            ? receipt.status === 1
              ? 'confirmed'
              : 'failed'
            : 'pending',
          gasUsed: receipt?.gasUsed.toString(),
        },
      };
    } catch (error) {
      logger.error('Failed to get transaction resource', { hash, error });
      throw new Error(`Failed to get transaction ${hash}: ${error}`);
    }
  }

  /**
   * Get block resource
   */
  async getBlockResource(blockNumber: number) {
    try {
      const block = await this.provider.getProvider().getBlock(blockNumber);

      if (!block) {
        throw new Error('Block not found');
      }

      return {
        uri: `ethereum://block/${blockNumber}`,
        type: 'block' as const,
        data: {
          number: block.number,
          hash: block.hash,
          timestamp: block.timestamp,
          transactions: block.transactions,
          gasUsed: block.gasUsed.toString(),
          gasLimit: block.gasLimit.toString(),
          miner: block.miner,
        },
      };
    } catch (error) {
      logger.error('Failed to get block resource', { blockNumber, error });
      throw new Error(`Failed to get block ${blockNumber}: ${error}`);
    }
  }
}
```

**Validation**:
```bash
# Test resources (will create test file)
pnpm test src/mcp-servers/ethereum/__tests__/resources.test.ts
```

---

## Phase 4: Tools Implementation (5 hours)

### Step 4.1: Implement Tool Handlers

Create `src/mcp-servers/ethereum/tools.ts`:

```typescript
import { ethers } from 'ethers';
import { EthereumProvider } from './provider.js';
import {
  QueryBalanceParams,
  QueryBalanceParamsSchema,
  SendTransactionParams,
  SendTransactionParamsSchema,
  CallContractParams,
  CallContractParamsSchema,
  DeployContractParams,
  DeployContractParamsSchema,
  BalanceResponse,
  TransactionResponse,
  ContractCallResponse,
  DeploymentResponse,
} from './types.js';
import { logger } from '../../utils/logger.js';

export class EthereumTools {
  constructor(private provider: EthereumProvider) {}

  /**
   * Query balance (native or ERC20)
   */
  async queryBalance(params: unknown): Promise<BalanceResponse> {
    const validated = QueryBalanceParamsSchema.parse(params);
    const { address, token, blockTag = 'latest' } = validated;

    try {
      let balance: bigint;

      if (token) {
        // ERC20 token balance
        const erc20Interface = new ethers.Interface([
          'function balanceOf(address) view returns (uint256)',
        ]);

        const data = erc20Interface.encodeFunctionData('balanceOf', [address]);

        const result = await this.provider.call({
          to: token,
          data,
        });

        balance = BigInt(result);
      } else {
        // Native ETH balance
        balance = await this.provider.getBalance(address, blockTag);
      }

      const blockNumber = await this.provider.getBlockNumber();

      return {
        address,
        balance: balance.toString(),
        blockNumber,
        ...(token && { token }),
      };
    } catch (error) {
      logger.error('Failed to query balance', { address, token, error });
      throw new Error(`Failed to query balance: ${error}`);
    }
  }

  /**
   * Send transaction (requires wallet)
   */
  async sendTransaction(
    params: unknown,
    wallet: ethers.Wallet
  ): Promise<TransactionResponse> {
    const validated = SendTransactionParamsSchema.parse(params);
    const { to, value, data, gasLimit, gasPrice, nonce } = validated;

    try {
      // Build transaction
      const tx: ethers.TransactionRequest = {
        to,
        value: value,
        ...(data && { data }),
        ...(gasLimit && { gasLimit }),
        ...(gasPrice && { gasPrice }),
        ...(nonce !== undefined && { nonce }),
      };

      // Estimate gas if not provided
      if (!gasLimit) {
        tx.gasLimit = await this.provider.estimateGas(tx);
      }

      // Get gas price if not provided
      if (!gasPrice) {
        tx.gasPrice = await this.provider.getGasPrice();
      }

      // Send transaction
      const txResponse = await wallet.sendTransaction(tx);

      logger.info('Transaction sent', {
        hash: txResponse.hash,
        to,
        value: value.toString(),
      });

      return {
        hash: txResponse.hash as `0x${string}`,
        from: txResponse.from as `0x${string}`,
        to: (txResponse.to ?? null) as `0x${string}` | null,
        value: txResponse.value.toString(),
        gasLimit: txResponse.gasLimit.toString(),
        gasPrice: (txResponse.gasPrice ?? 0n).toString(),
        nonce: txResponse.nonce,
        data: (txResponse.data ?? '0x') as `0x${string}`,
        blockNumber: txResponse.blockNumber,
        status: 'pending',
      };
    } catch (error) {
      logger.error('Failed to send transaction', { to, value, error });
      throw new Error(`Failed to send transaction: ${error}`);
    }
  }

  /**
   * Call contract (read-only)
   */
  async callContract(params: unknown): Promise<ContractCallResponse> {
    const validated = CallContractParamsSchema.parse(params);
    const { address, abi, method, args = [] } = validated;

    try {
      const contract = new ethers.Contract(
        address,
        abi,
        this.provider.getProvider()
      );

      if (typeof contract[method] !== 'function') {
        throw new Error(`Method ${method} not found in contract`);
      }

      const result = await contract[method](...args);
      const blockNumber = await this.provider.getBlockNumber();

      return {
        result,
        blockNumber,
      };
    } catch (error) {
      logger.error('Failed to call contract', { address, method, error });
      throw new Error(`Failed to call contract: ${error}`);
    }
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(params: unknown): Promise<{ gasEstimate: string }> {
    const validated = SendTransactionParamsSchema.partial().parse(params);
    const { to, value, data } = validated;

    try {
      const tx: ethers.TransactionRequest = {
        ...(to && { to }),
        ...(value && { value }),
        ...(data && { data }),
      };

      const estimate = await this.provider.estimateGas(tx);

      return {
        gasEstimate: estimate.toString(),
      };
    } catch (error) {
      logger.error('Failed to estimate gas', { to, value, error });
      throw new Error(`Failed to estimate gas: ${error}`);
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<{ gasPrice: string }> {
    try {
      const gasPrice = await this.provider.getGasPrice();
      return {
        gasPrice: gasPrice.toString(),
      };
    } catch (error) {
      logger.error('Failed to get gas price', { error });
      throw new Error(`Failed to get gas price: ${error}`);
    }
  }

  /**
   * Deploy contract
   */
  async deployContract(
    params: unknown,
    wallet: ethers.Wallet
  ): Promise<DeploymentResponse> {
    const validated = DeployContractParamsSchema.parse(params);
    const { bytecode, abi, constructorArgs = [], gasLimit } = validated;

    try {
      const factory = new ethers.ContractFactory(abi, bytecode, wallet);

      // Deploy with optional gas limit
      const contract = await factory.deploy(...constructorArgs, {
        ...(gasLimit && { gasLimit }),
      });

      await contract.waitForDeployment();

      const address = await contract.getAddress();
      const deployTransaction = contract.deploymentTransaction();

      if (!deployTransaction) {
        throw new Error('Deployment transaction not found');
      }

      const receipt = await deployTransaction.wait();

      if (!receipt) {
        throw new Error('Deployment receipt not found');
      }

      logger.info('Contract deployed', {
        address,
        transactionHash: deployTransaction.hash,
      });

      return {
        contractAddress: address as `0x${string}`,
        transactionHash: deployTransaction.hash as `0x${string}`,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      logger.error('Failed to deploy contract', { error });
      throw new Error(`Failed to deploy contract: ${error}`);
    }
  }
}
```

**Validation**: Tests in Phase 6

---

## Phase 5: Main Server Implementation (3 hours)

### Step 5.1: Create MCP Server

Create `src/mcp-servers/ethereum/index.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ethers } from 'ethers';
import { createEthereumProvider, EthereumProvider } from './provider.js';
import { EthereumResources } from './resources.js';
import { EthereumTools } from './tools.js';
import { logger } from '../../utils/logger.js';

export class EthereumMCPServer {
  private server: Server;
  private provider: EthereumProvider;
  private resources: EthereumResources;
  private tools: EthereumTools;
  private wallet?: ethers.Wallet;

  constructor(network: 'mainnet' | 'sepolia' = 'sepolia') {
    this.provider = createEthereumProvider(network);
    this.resources = new EthereumResources(this.provider);
    this.tools = new EthereumTools(this.provider);

    this.server = new Server(
      {
        name: `ethereum-mcp-${network}`,
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Set wallet for signing transactions
   */
  setWallet(privateKey: string) {
    this.wallet = new ethers.Wallet(privateKey, this.provider.getProvider());
    logger.info('Wallet configured', { address: this.wallet.address });
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: this.resources.listResourceTypes().map((uri) => ({
          uri,
          name: uri.split('/').pop() ?? 'resource',
          mimeType: 'application/json',
        })),
      };
    });

    // Read specific resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      const [, , type, identifier] = uri.split('/');

      let resource;
      switch (type) {
        case 'account':
          resource = await this.resources.getAccountResource(identifier as `0x${string}`);
          break;
        case 'contract':
          resource = await this.resources.getContractResource(identifier as `0x${string}`);
          break;
        case 'transaction':
          resource = await this.resources.getTransactionResource(identifier as `0x${string}`);
          break;
        case 'block':
          resource = await this.resources.getBlockResource(parseInt(identifier));
          break;
        default:
          throw new Error(`Unknown resource type: ${type}`);
      }

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(resource.data, null, 2),
          },
        ],
      };
    });

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'query_balance',
            description: 'Query ETH or ERC20 token balance',
            inputSchema: {
              type: 'object',
              properties: {
                address: { type: 'string', description: 'Ethereum address' },
                token: {
                  type: 'string',
                  description: 'Token contract address (optional)',
                },
                blockTag: {
                  type: ['string', 'number'],
                  description: 'Block tag (latest, pending, or number)',
                },
              },
              required: ['address'],
            },
          },
          {
            name: 'send_transaction',
            description: 'Send a transaction',
            inputSchema: {
              type: 'object',
              properties: {
                to: { type: 'string', description: 'Recipient address' },
                value: { type: 'string', description: 'Amount in wei' },
                data: { type: 'string', description: 'Transaction data (optional)' },
                gasLimit: { type: 'string', description: 'Gas limit (optional)' },
                gasPrice: { type: 'string', description: 'Gas price (optional)' },
                nonce: { type: 'number', description: 'Nonce (optional)' },
              },
              required: ['to', 'value'],
            },
          },
          {
            name: 'call_contract',
            description: 'Call a contract method (read-only)',
            inputSchema: {
              type: 'object',
              properties: {
                address: { type: 'string', description: 'Contract address' },
                abi: { type: 'array', description: 'Contract ABI' },
                method: { type: 'string', description: 'Method name' },
                args: {
                  type: 'array',
                  description: 'Method arguments (optional)',
                },
              },
              required: ['address', 'abi', 'method'],
            },
          },
          {
            name: 'estimate_gas',
            description: 'Estimate gas for a transaction',
            inputSchema: {
              type: 'object',
              properties: {
                to: { type: 'string', description: 'Recipient address' },
                value: { type: 'string', description: 'Amount in wei' },
                data: { type: 'string', description: 'Transaction data' },
              },
            },
          },
          {
            name: 'get_gas_price',
            description: 'Get current gas price',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'deploy_contract',
            description: 'Deploy a smart contract',
            inputSchema: {
              type: 'object',
              properties: {
                bytecode: { type: 'string', description: 'Contract bytecode' },
                abi: { type: 'array', description: 'Contract ABI' },
                constructorArgs: {
                  type: 'array',
                  description: 'Constructor arguments',
                },
                gasLimit: { type: 'string', description: 'Gas limit (optional)' },
              },
              required: ['bytecode', 'abi'],
            },
          },
        ],
      };
    });

    // Call tools
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      let result;
      switch (name) {
        case 'query_balance':
          result = await this.tools.queryBalance(args);
          break;
        case 'send_transaction':
          if (!this.wallet) {
            throw new Error('Wallet not configured');
          }
          result = await this.tools.sendTransaction(args, this.wallet);
          break;
        case 'call_contract':
          result = await this.tools.callContract(args);
          break;
        case 'estimate_gas':
          result = await this.tools.estimateGas(args);
          break;
        case 'get_gas_price':
          result = await this.tools.getGasPrice();
          break;
        case 'deploy_contract':
          if (!this.wallet) {
            throw new Error('Wallet not configured');
          }
          result = await this.tools.deployContract(args, this.wallet);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    });
  }

  /**
   * Start the MCP server
   */
  async start() {
    // Verify provider connection
    const connected = await this.provider.verifyConnection();
    if (!connected) {
      throw new Error('Failed to connect to Ethereum provider');
    }

    // Start server with stdio transport
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info('Ethereum MCP server started');
  }

  /**
   * Stop the server
   */
  async stop() {
    await this.server.close();
    logger.info('Ethereum MCP server stopped');
  }
}

// Entry point for CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const network = (process.env.NETWORK as 'mainnet' | 'sepolia') ?? 'sepolia';
  const server = new EthereumMCPServer(network);

  // Set wallet if private key provided
  if (process.env.PRIVATE_KEY) {
    server.setWallet(process.env.PRIVATE_KEY);
  }

  server.start().catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}
```

**Validation**: Integration tests in Phase 6

---

## Phase 6: Testing (4 hours)

I'll continue with testing, prompts implementation, and validation in the next files. This is getting very long - should I continue with the complete guide or would you like me to create a summary structure for guides 03-15 first?

Let me know and I'll continue with the ultra-detailed implementation!