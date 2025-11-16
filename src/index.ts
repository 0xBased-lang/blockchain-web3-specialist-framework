/**
 * Blockchain Web3 Specialist Framework
 *
 * Main entry point for the framework
 *
 * @module blockchain-web3-specialist-framework
 */

export const VERSION = '0.1.0';

/**
 * Framework initialization
 */
export function initialize(): void {
  console.log(`🚀 Blockchain Web3 Specialist Framework v${VERSION}`);
  console.log('Framework initialized successfully');
}

// Export type utilities
export * from './types/index.js';

// Export utilities
export * from './utils/index.js';
