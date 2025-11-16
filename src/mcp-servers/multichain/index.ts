#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MultiChainProvider } from './provider.js';
import { MultiChainResourceManager } from './resources.js';
import { MultiChainToolManager } from './tools.js';
import { logger } from '../../utils/index.js';

/**
 * Multi-Chain MCP Server
 *
 * Unified blockchain access across Ethereum and Solana through Model Context Protocol:
 * - Automatic chain detection from address format
 * - Unified resource and tool interfaces
 * - Intelligent routing to appropriate chain
 *
 * Features:
 * - Resources: Read-only blockchain data (accounts, transactions, chain-specific)
 * - Tools: Actionable operations with auto-detection (query balance, send transactions)
 * - Security: Private keys managed securely, comprehensive validation
 *
 * Chain Detection:
 * - Ethereum: 0x-prefixed addresses (40 hex chars)
 * - Solana: Base58 addresses (32-44 chars)
 * - Auto-routing based on address format
 *
 * Usage:
 *   # Configure both chains (optional - can use just one)
 *   ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY \
 *   ETHEREUM_CHAIN_ID=1 \
 *   ETHEREUM_CHAIN_NAME=ethereum-mainnet \
 *   SOLANA_RPC_URL=https://api.mainnet-beta.solana.com \
 *   SOLANA_CLUSTER=mainnet-beta \
 *   node dist/mcp-servers/multichain/index.js
 */

// Ethereum configuration (optional)
const ETHEREUM_RPC_URL = process.env['ETHEREUM_RPC_URL'];
const ETHEREUM_CHAIN_ID = process.env['ETHEREUM_CHAIN_ID']
  ? parseInt(process.env['ETHEREUM_CHAIN_ID'], 10)
  : undefined;
const ETHEREUM_CHAIN_NAME = process.env['ETHEREUM_CHAIN_NAME'];

// Solana configuration (optional)
const SOLANA_RPC_URL = process.env['SOLANA_RPC_URL'];
const SOLANA_CLUSTER = process.env['SOLANA_CLUSTER'];

// Initialize multi-chain provider with optional configurations
const ethereumConfig =
  ETHEREUM_RPC_URL && ETHEREUM_CHAIN_ID && ETHEREUM_CHAIN_NAME
    ? {
        rpcUrl: ETHEREUM_RPC_URL,
        chainId: ETHEREUM_CHAIN_ID,
        chainName: ETHEREUM_CHAIN_NAME,
      }
    : undefined;

const solanaConfig =
  SOLANA_RPC_URL && SOLANA_CLUSTER
    ? {
        rpcUrl: SOLANA_RPC_URL,
        cluster: SOLANA_CLUSTER,
      }
    : undefined;

// Validate at least one chain is configured
if (!ethereumConfig && !solanaConfig) {
  logger.error('At least one blockchain must be configured (Ethereum or Solana)');
  logger.error('Set ETHEREUM_RPC_URL + ETHEREUM_CHAIN_ID + ETHEREUM_CHAIN_NAME');
  logger.error('OR set SOLANA_RPC_URL + SOLANA_CLUSTER');
  process.exit(1);
}

// Initialize provider and managers
const provider = new MultiChainProvider(ethereumConfig, solanaConfig);
const resourceManager = new MultiChainResourceManager(provider);
const toolManager = new MultiChainToolManager(provider);

// Create MCP server
const server = new Server(
  {
    name: 'multichain-mcp-server',
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
 * - multichain://auto/account/{address} - Auto-detect chain
 * - multichain://ethereum/account/{address}
 * - multichain://ethereum/contract/{address}
 * - multichain://ethereum/transaction/{hash}
 * - multichain://ethereum/block/{number}
 * - multichain://solana/account/{address}
 * - multichain://solana/token-account/{address}
 * - multichain://solana/transaction/{signature}
 * - multichain://solana/block/{slot}
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  try {
    const resource = await resourceManager.getResource(uri);
    return {
      contents: [
        {
          uri: resource.uri,
          mimeType: 'application/json',
          text: JSON.stringify(resource.data, null, 2),
        },
      ],
    };
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
  const tools = toolManager.listTools();
  return { tools };
});

/**
 * Call tool handler
 *
 * Execute tool by name with provided arguments
 *
 * Available tools:
 * - multichain_query_balance: Query balance (auto-detects chain from address)
 * - multichain_send_transaction: Send transaction (auto-detects chain from recipient)
 * - multichain_transfer_token: Transfer SPL token (Solana) or ERC20 (Ethereum)
 * - multichain_initialize_wallet: Initialize wallet/keypair for chain
 * - multichain_clear_wallet: Clear wallet/keypair from memory
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await toolManager.executeTool(name, args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
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
  const configuredChains: string[] = [];
  if (ethereumConfig) configuredChains.push('Ethereum');
  if (solanaConfig) configuredChains.push('Solana');

  logger.info('Starting Multi-Chain MCP Server', {
    chains: configuredChains.join(', '),
    ethereum: ethereumConfig
      ? {
          rpcUrl: ethereumConfig.rpcUrl,
          chainId: ethereumConfig.chainId,
          chainName: ethereumConfig.chainName,
        }
      : null,
    solana: solanaConfig
      ? {
          rpcUrl: solanaConfig.rpcUrl,
          cluster: solanaConfig.cluster,
        }
      : null,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Multi-Chain MCP Server running', {
    chains: configuredChains.join(', '),
  });
}

main().catch((error) => {
  logger.error('Server failed to start', { error });
  process.exit(1);
});
