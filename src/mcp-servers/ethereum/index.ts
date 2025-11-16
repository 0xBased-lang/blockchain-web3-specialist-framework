#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { EthereumProvider } from './provider.js';
import { EthereumResourceManager } from './resources.js';
import { EthereumToolManager } from './tools.js';
import { logger } from '../../utils/index.js';
import type { Address } from './types.js';

/**
 * Ethereum MCP Server
 *
 * Provides blockchain access through Model Context Protocol:
 * - Resources: Read-only blockchain data (accounts, contracts, transactions, blocks)
 * - Tools: Actionable operations (query balance, send transactions, call contracts)
 *
 * Security:
 * - Private keys managed securely in tool manager
 * - All inputs validated with Zod schemas
 * - Comprehensive error handling
 *
 * Usage:
 *   ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY \
 *   ETHEREUM_CHAIN_ID=1 \
 *   node dist/mcp-servers/ethereum/index.js
 */

// Configuration from environment
const RPC_URL = process.env['ETHEREUM_RPC_URL'] ?? 'http://localhost:8545';
const CHAIN_ID = parseInt(process.env['ETHEREUM_CHAIN_ID'] ?? '1', 10);
const CHAIN_NAME = process.env['ETHEREUM_CHAIN_NAME'] ?? 'ethereum-mainnet';

// Initialize provider and managers
const provider = new EthereumProvider(RPC_URL, CHAIN_ID, CHAIN_NAME);
const resourceManager = new EthereumResourceManager(provider);
const toolManager = new EthereumToolManager(provider);

// Create MCP server
const server = new Server(
  {
    name: 'ethereum-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

/**
 * Resource handlers
 *
 * List available resource types
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = resourceManager.listResources();
  return { resources };
});

/**
 * Read specific resource by URI
 *
 * Supported URIs:
 * - ethereum://account/{address}
 * - ethereum://contract/{address}
 * - ethereum://transaction/{hash}
 * - ethereum://block/{number}
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  try {
    // Parse URI: ethereum://type/identifier
    const match = uri.match(/^ethereum:\/\/([^/]+)\/(.+)$/);
    if (!match || !match[1] || !match[2]) {
      throw new Error(`Invalid URI format: ${uri}`);
    }

    const resourceType = match[1];
    const identifier = match[2];

    switch (resourceType) {
      case 'account': {
        const resource = await resourceManager.getAccountResource(identifier as Address);
        return {
          contents: [
            {
              uri: resource.uri,
              mimeType: 'application/json',
              text: JSON.stringify(resource.data, null, 2),
            },
          ],
        };
      }

      case 'contract': {
        const resource = await resourceManager.getContractResource(identifier as Address);
        return {
          contents: [
            {
              uri: resource.uri,
              mimeType: 'application/json',
              text: JSON.stringify(resource.data, null, 2),
            },
          ],
        };
      }

      case 'transaction': {
        const resource = await resourceManager.getTransactionResource(identifier);
        return {
          contents: [
            {
              uri: resource.uri,
              mimeType: 'application/json',
              text: JSON.stringify(resource.data, null, 2),
            },
          ],
        };
      }

      case 'block': {
        const blockNumber = identifier === 'latest' ? 'latest' : parseInt(identifier, 10);
        const resource = await resourceManager.getBlockResource(blockNumber);
        return {
          contents: [
            {
              uri: resource.uri,
              mimeType: 'application/json',
              text: JSON.stringify(resource.data, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }
  } catch (error) {
    logger.error('Failed to read resource', { uri, error });
    throw error;
  }
});

/**
 * Tool handlers
 *
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'ethereum_query_balance',
        description:
          'Query ETH or ERC20 token balance for an address. Returns balance, symbol, and decimals.',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Ethereum address (0x...)',
            },
            token: {
              type: 'string',
              description: 'Optional: ERC20 token contract address',
            },
            blockTag: {
              type: ['number', 'string'],
              description: 'Optional: Block number or "latest"/"pending"',
            },
          },
          required: ['address'],
        },
      },
      {
        name: 'ethereum_send_transaction',
        description:
          'Send ETH transaction. Requires wallet to be initialized first. Validates balance before sending.',
        inputSchema: {
          type: 'object',
          properties: {
            to: {
              type: 'string',
              description: 'Recipient address',
            },
            value: {
              type: ['string', 'number'],
              description: 'Amount in wei (string or number)',
            },
            data: {
              type: 'string',
              description: 'Optional: Transaction data (0x...)',
            },
            gasLimit: {
              type: ['string', 'number'],
              description: 'Optional: Gas limit',
            },
            gasPrice: {
              type: ['string', 'number'],
              description: 'Optional: Gas price (legacy)',
            },
            maxFeePerGas: {
              type: ['string', 'number'],
              description: 'Optional: Max fee per gas (EIP-1559)',
            },
            maxPriorityFeePerGas: {
              type: ['string', 'number'],
              description: 'Optional: Max priority fee (EIP-1559)',
            },
            nonce: {
              type: 'number',
              description: 'Optional: Transaction nonce',
            },
          },
          required: ['to', 'value'],
        },
      },
      {
        name: 'ethereum_call_contract',
        description:
          'Call contract method (read-only). Verifies contract exists and method is valid.',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Contract address',
            },
            abi: {
              type: 'array',
              description: 'Contract ABI (human-readable strings or JSON)',
              items: {
                oneOf: [{ type: 'string' }, { type: 'object' }],
              },
            },
            method: {
              type: 'string',
              description: 'Method name to call',
            },
            args: {
              type: 'array',
              description: 'Optional: Method arguments',
            },
            blockTag: {
              type: ['number', 'string'],
              description: 'Optional: Block number or "latest"/"pending"',
            },
          },
          required: ['address', 'abi', 'method'],
        },
      },
      {
        name: 'ethereum_deploy_contract',
        description:
          'Deploy smart contract. Requires wallet to be initialized. Waits for confirmation.',
        inputSchema: {
          type: 'object',
          properties: {
            bytecode: {
              type: 'string',
              description: 'Contract bytecode (0x...)',
            },
            abi: {
              type: 'array',
              description: 'Contract ABI',
            },
            constructorArgs: {
              type: 'array',
              description: 'Optional: Constructor arguments',
            },
            gasLimit: {
              type: ['string', 'number'],
              description: 'Optional: Gas limit',
            },
            gasPrice: {
              type: ['string', 'number'],
              description: 'Optional: Gas price',
            },
          },
          required: ['bytecode', 'abi'],
        },
      },
      {
        name: 'ethereum_estimate_gas',
        description: 'Estimate gas for a transaction. Returns estimate with 20% buffer.',
        inputSchema: {
          type: 'object',
          properties: {
            to: {
              type: 'string',
              description: 'Recipient address',
            },
            value: {
              type: ['string', 'number'],
              description: 'Amount in wei',
            },
            data: {
              type: 'string',
              description: 'Optional: Transaction data',
            },
            from: {
              type: 'string',
              description: 'Optional: Sender address',
            },
          },
          required: ['to'],
        },
      },
      {
        name: 'ethereum_get_gas_price',
        description: 'Get current gas prices. Returns both legacy and EIP-1559 pricing.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'ethereum_wait_for_transaction',
        description:
          'Wait for transaction to be mined. Default 12 confirmations for reorg protection.',
        inputSchema: {
          type: 'object',
          properties: {
            hash: {
              type: 'string',
              description: 'Transaction hash',
            },
            confirmations: {
              type: 'number',
              description: 'Optional: Number of confirmations (default: 12)',
            },
          },
          required: ['hash'],
        },
      },
      {
        name: 'ethereum_initialize_wallet',
        description:
          '⚠️ SECURITY: Initialize wallet with private key. Key stored in memory only. Call clear_wallet when done.',
        inputSchema: {
          type: 'object',
          properties: {
            privateKey: {
              type: 'string',
              description: 'Private key (0x...)',
            },
          },
          required: ['privateKey'],
        },
      },
      {
        name: 'ethereum_clear_wallet',
        description: 'Clear wallet from memory. Always call this after transactions.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

/**
 * Call tool handler
 *
 * Execute tool by name with provided arguments
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'ethereum_query_balance': {
        const result = await toolManager.queryBalance(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'ethereum_send_transaction': {
        const result = await toolManager.sendTransaction(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'ethereum_call_contract': {
        const result = await toolManager.callContract(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'ethereum_deploy_contract': {
        const result = await toolManager.deployContract(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'ethereum_estimate_gas': {
        const result = await toolManager.estimateGas(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'ethereum_get_gas_price': {
        const result = await toolManager.getGasPrice();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'ethereum_wait_for_transaction': {
        // Cast args to access properties
        const toolArgs = args as { hash?: string; confirmations?: number };
        const result = await toolManager.waitForTransaction(
          toolArgs['hash'] ?? '',
          toolArgs['confirmations']
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'ethereum_initialize_wallet': {
        // Cast args to access properties
        const toolArgs = args as { privateKey?: string };
        toolManager.initializeWallet(toolArgs['privateKey'] ?? '');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Wallet initialized' }),
            },
          ],
        };
      }

      case 'ethereum_clear_wallet': {
        toolManager.clearWallet();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Wallet cleared from memory' }),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    logger.error('Tool execution failed', { tool: name, error });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: String(error),
            tool: name,
          }),
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start server
 */
async function main(): Promise<void> {
  logger.info('Starting Ethereum MCP Server', {
    rpcUrl: RPC_URL,
    chainId: CHAIN_ID,
    chainName: CHAIN_NAME,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Ethereum MCP Server running');
}

main().catch((error) => {
  logger.error('Server failed to start', { error });
  process.exit(1);
});
