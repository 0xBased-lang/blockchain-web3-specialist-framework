#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SolanaProvider } from './provider.js';
import { SolanaResourceManager } from './resources.js';
import { SolanaToolManager } from './tools.js';
import { logger } from '../../utils/index.js';
import type { SolanaAddress, Signature } from './types.js';

/**
 * Solana MCP Server
 *
 * Provides Solana blockchain access through Model Context Protocol:
 * - Resources: Read-only blockchain data (accounts, tokens, transactions, blocks)
 * - Tools: Actionable operations (query balance, send SOL, transfer tokens)
 *
 * Security:
 * - Private keys managed securely in tool manager
 * - All inputs validated with Zod schemas
 * - Comprehensive error handling
 *
 * Solana-Specific Features:
 * - Recent blockhash caching (79s expiration awareness)
 * - Commitment levels (processed, confirmed, finalized)
 * - SPL token support
 * - Compute unit management
 *
 * Usage:
 *   SOLANA_RPC_URL=https://api.devnet.solana.com \
 *   SOLANA_CLUSTER=devnet \
 *   node dist/mcp-servers/solana/index.js
 */

// Configuration from environment
const RPC_URL = process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com';
const CLUSTER = process.env['SOLANA_CLUSTER'] ?? 'devnet';

// Initialize provider and managers
const provider = new SolanaProvider(RPC_URL, CLUSTER);
const resourceManager = new SolanaResourceManager(provider);
const toolManager = new SolanaToolManager(provider);

// Create MCP server
const server = new Server(
  {
    name: 'solana-mcp-server',
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
 * - solana://account/{address}
 * - solana://token-account/{address}
 * - solana://transaction/{signature}
 * - solana://block/{slot}
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  try {
    // Parse URI: solana://type/identifier
    const match = uri.match(/^solana:\/\/([^/]+)\/(.+)$/);
    if (!match || !match[1] || !match[2]) {
      throw new Error(`Invalid URI format: ${uri}`);
    }

    const resourceType = match[1];
    const identifier = match[2];

    switch (resourceType) {
      case 'account': {
        const resource = await resourceManager.getAccountResource(identifier as SolanaAddress);
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

      case 'token-account': {
        const resource = await resourceManager.getTokenAccountResource(identifier as SolanaAddress);
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
        const resource = await resourceManager.getTransactionResource(identifier as Signature);
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
        const slot = identifier === 'latest' ? 'latest' : parseInt(identifier, 10);
        const resource = await resourceManager.getBlockResource(slot);
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
        name: 'solana_query_balance',
        description:
          'Query SOL or SPL token balance for an address. Returns balance in lamports, symbol, and decimals.',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Solana address (Base58)',
            },
            token: {
              type: 'string',
              description: 'Optional: SPL token mint address',
            },
            commitment: {
              type: 'string',
              enum: ['processed', 'confirmed', 'finalized'],
              description: 'Optional: Commitment level',
            },
          },
          required: ['address'],
        },
      },
      {
        name: 'solana_send_transaction',
        description:
          'Send SOL transaction. Requires keypair to be initialized first. Validates balance before sending.',
        inputSchema: {
          type: 'object',
          properties: {
            to: {
              type: 'string',
              description: 'Recipient address',
            },
            amount: {
              type: ['string', 'number'],
              description: 'Amount in lamports (1 SOL = 1,000,000,000 lamports)',
            },
            recentBlockhash: {
              type: 'string',
              description: 'Optional: Recent blockhash (will fetch if not provided)',
            },
            computeUnitLimit: {
              type: 'number',
              description: 'Optional: Compute unit limit',
            },
            computeUnitPrice: {
              type: ['string', 'number'],
              description: 'Optional: Compute unit price (micro-lamports)',
            },
          },
          required: ['to', 'amount'],
        },
      },
      {
        name: 'solana_transfer_token',
        description:
          'Transfer SPL tokens. Requires keypair. Can auto-create recipient token account.',
        inputSchema: {
          type: 'object',
          properties: {
            to: {
              type: 'string',
              description: 'Recipient address',
            },
            amount: {
              type: ['string', 'number'],
              description: 'Token amount (respecting decimals)',
            },
            mint: {
              type: 'string',
              description: 'SPL token mint address',
            },
            decimals: {
              type: 'number',
              description: 'Token decimals',
            },
            createAssociatedTokenAccount: {
              type: 'boolean',
              description: 'Auto-create recipient token account if missing',
            },
          },
          required: ['to', 'amount', 'mint', 'decimals'],
        },
      },
      {
        name: 'solana_get_recent_blockhash',
        description:
          '⚠️ CRITICAL: Get recent blockhash for transactions. Blockhashes expire after ~79 seconds!',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'solana_request_airdrop',
        description: 'Request SOL airdrop (devnet/testnet only). Max 2 SOL per request.',
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: 'Recipient address',
            },
            lamports: {
              type: ['string', 'number'],
              description: 'Amount in lamports (max 2 SOL = 2,000,000,000 lamports)',
            },
          },
          required: ['address', 'lamports'],
        },
      },
      {
        name: 'solana_wait_for_confirmation',
        description:
          'Wait for transaction to be confirmed. Default commitment: confirmed (~1 second).',
        inputSchema: {
          type: 'object',
          properties: {
            signature: {
              type: 'string',
              description: 'Transaction signature',
            },
            commitment: {
              type: 'string',
              enum: ['processed', 'confirmed', 'finalized'],
              description: 'Optional: Commitment level (default: confirmed)',
            },
            timeout: {
              type: 'number',
              description: 'Optional: Timeout in milliseconds (default: 30000)',
            },
          },
          required: ['signature'],
        },
      },
      {
        name: 'solana_initialize_keypair',
        description:
          '⚠️ SECURITY: Initialize keypair with private key. Key stored in memory only. Call clear_keypair when done.',
        inputSchema: {
          type: 'object',
          properties: {
            privateKey: {
              type: 'string',
              description: 'Private key (JSON array format: [1,2,3,...])',
            },
          },
          required: ['privateKey'],
        },
      },
      {
        name: 'solana_clear_keypair',
        description: 'Clear keypair from memory. Always call this after transactions.',
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
      case 'solana_query_balance': {
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

      case 'solana_send_transaction': {
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

      case 'solana_transfer_token': {
        const result = await toolManager.transferToken(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'solana_get_recent_blockhash': {
        const result = await toolManager.getRecentBlockhash();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'solana_request_airdrop': {
        const result = await toolManager.requestAirdrop(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'solana_wait_for_confirmation': {
        const result = await toolManager.waitForConfirmation(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'solana_initialize_keypair': {
        const toolArgs = args as { privateKey?: string };
        toolManager.initializeKeypair(toolArgs['privateKey'] ?? '');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Keypair initialized' }),
            },
          ],
        };
      }

      case 'solana_clear_keypair': {
        toolManager.clearKeypair();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: 'Keypair cleared from memory' }),
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
  logger.info('Starting Solana MCP Server', {
    rpcUrl: RPC_URL,
    cluster: CLUSTER,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Solana MCP Server running');
}

main().catch((error) => {
  logger.error('Server failed to start', { error });
  process.exit(1);
});
