import { ethers } from 'ethers';
import { EthereumProvider } from './provider.js';
import {
  QueryBalanceParamsSchema,
  SendTransactionParamsSchema,
  CallContractParamsSchema,
  DeployContractParamsSchema,
  BalanceResponse,
  TransactionResponse,
  ContractCallResponse,
  DeploymentResponse,
  EthereumError,
  EthereumErrorCode,
  type Address,
  type TxHash,
} from './types.js';
import { logger } from '../../utils/index.js';

/**
 * MCP Tool handlers for Ethereum
 *
 * Tools provide actionable operations:
 * - Query balances (ETH + ERC20)
 * - Send transactions
 * - Call contract methods
 * - Deploy contracts
 * - Estimate gas
 *
 * Security: Private keys NEVER logged, wiped after use
 */
export class EthereumToolManager {
  private wallet: ethers.Wallet | null = null;

  constructor(private provider: EthereumProvider) {}

  /**
   * Initialize wallet for signing transactions
   *
   * ⚠️ SECURITY CRITICAL:
   * - Private key NEVER logged
   * - Wallet stored in memory only
   * - Call clearWallet() to wipe after use
   */
  initializeWallet(privateKey: string): void {
    try {
      this.wallet = new ethers.Wallet(privateKey, this.provider.getProvider());
      logger.info('Wallet initialized', {
        address: this.wallet.address,
        // NEVER log private key
      });
    } catch (error) {
      logger.error('Failed to initialize wallet', { error: String(error) });
      throw new EthereumError('Failed to initialize wallet', EthereumErrorCode.NETWORK_ERROR, {
        error: String(error),
      });
    }
  }

  /**
   * Clear wallet from memory
   *
   * ⚠️ SECURITY: Call this after completing operations
   */
  clearWallet(): void {
    this.wallet = null;
    logger.info('Wallet cleared from memory');
  }

  /**
   * Query balance - ETH or ERC20 token
   *
   * Edge cases handled:
   * - Invalid address → Validation error
   * - Invalid token address → Call will fail gracefully
   * - RPC errors → Automatic retry (in provider)
   */
  async queryBalance(params: unknown): Promise<BalanceResponse> {
    const validated = QueryBalanceParamsSchema.parse(params);
    const { address, token, blockTag = 'latest' } = validated;

    try {
      let balance: bigint;
      let symbol: string | undefined;
      let decimals: number | undefined;

      if (token) {
        // ERC20 token balance
        const erc20Interface = new ethers.Interface([
          'function balanceOf(address) view returns (uint256)',
          'function symbol() view returns (string)',
          'function decimals() view returns (uint8)',
        ]);

        // Get balance
        const balanceData = erc20Interface.encodeFunctionData('balanceOf', [address]);
        const balanceResult = await this.provider.call({
          to: token,
          data: balanceData,
        });
        balance = BigInt(balanceResult);

        // Get symbol and decimals (optional, may fail for non-standard tokens)
        try {
          const symbolData = erc20Interface.encodeFunctionData('symbol', []);
          const symbolResult = await this.provider.call({
            to: token,
            data: symbolData,
          });
          [symbol] = erc20Interface.decodeFunctionResult('symbol', symbolResult);

          const decimalsData = erc20Interface.encodeFunctionData('decimals', []);
          const decimalsResult = await this.provider.call({
            to: token,
            data: decimalsData,
          });
          const [decimalsValue] = erc20Interface.decodeFunctionResult('decimals', decimalsResult);
          // Convert BigInt to number for decimals
          decimals = typeof decimalsValue === 'bigint' ? Number(decimalsValue) : decimalsValue;
        } catch {
          // Non-standard token, continue without symbol/decimals
          logger.warn('Could not fetch token metadata', { token });
        }
      } else {
        // Native ETH balance
        balance = await this.provider.getBalance(address, blockTag);
        symbol = 'ETH';
        decimals = 18;
      }

      const blockNumber = await this.provider.getBlockNumber();

      return {
        address,
        balance: balance.toString(),
        blockNumber,
        ...(token && { token }),
        ...(symbol && { symbol }),
        ...(decimals !== undefined && { decimals }),
      };
    } catch (error) {
      logger.error('Failed to query balance', { address, token, error });
      throw new EthereumError(
        `Failed to query balance for ${address}`,
        EthereumErrorCode.NETWORK_ERROR,
        { address, token, error: String(error) }
      );
    }
  }

  /**
   * Send transaction - ETH or contract interaction
   *
   * Edge cases handled:
   * - No wallet initialized → Error
   * - Insufficient funds → Error before sending
   * - Gas estimation failure → Use fallback gas limit
   * - Nonce conflicts → User should use NonceManager in production
   *
   * ⚠️ SECURITY: Transaction details logged but NOT private key
   */
  async sendTransaction(params: unknown): Promise<TransactionResponse> {
    if (!this.wallet) {
      throw new EthereumError(
        'Wallet not initialized. Call initializeWallet() first',
        EthereumErrorCode.NETWORK_ERROR
      );
    }

    const validated = SendTransactionParamsSchema.parse(params);
    const { to, value, data, gasLimit, gasPrice, maxFeePerGas, maxPriorityFeePerGas, nonce } =
      validated;

    try {
      // Check balance before sending (prevent unnecessary gas waste)
      const balance = await this.provider.getBalance(this.wallet.address.toLowerCase() as Address);
      if (balance < value) {
        throw new EthereumError(
          `Insufficient funds: have ${balance}, need ${value}`,
          EthereumErrorCode.INSUFFICIENT_FUNDS,
          { balance: balance.toString(), required: value.toString() }
        );
      }

      // Build transaction
      const tx: ethers.TransactionRequest = {
        to,
        value,
        ...(data && { data }),
      };

      // Gas estimation (with 20% buffer from provider)
      if (gasLimit) {
        tx.gasLimit = gasLimit;
      } else {
        try {
          tx.gasLimit = await this.provider.estimateGas(tx);
        } catch (error) {
          logger.warn('Gas estimation failed, using default', { error });
          tx.gasLimit = 21000n; // Default for simple transfer
        }
      }

      // Gas price handling (EIP-1559 vs legacy)
      if (maxFeePerGas && maxPriorityFeePerGas) {
        // EIP-1559 transaction
        tx.maxFeePerGas = maxFeePerGas;
        tx.maxPriorityFeePerGas = maxPriorityFeePerGas;
      } else if (gasPrice) {
        // Legacy transaction
        tx.gasPrice = gasPrice;
      } else {
        // Auto-detect: use EIP-1559 if available
        const feeData = await this.provider.getFeeData();
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          tx.maxFeePerGas = feeData.maxFeePerGas;
          tx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
        } else {
          tx.gasPrice = await this.provider.getGasPrice();
        }
      }

      // Nonce (let ethers manage by default, or use provided)
      if (nonce !== undefined) {
        tx.nonce = nonce;
      }

      // Send transaction
      const txResponse = await this.wallet.sendTransaction(tx);

      logger.info('Transaction sent', {
        hash: txResponse.hash,
        from: txResponse.from,
        to: txResponse.to,
        value: value.toString(),
        // NEVER log private key
      });

      return {
        hash: txResponse.hash,
        from: txResponse.from.toLowerCase() as Address,
        to: txResponse.to ? (txResponse.to.toLowerCase() as Address) : null,
        value: txResponse.value.toString(),
        gasLimit: txResponse.gasLimit.toString(),
        gasPrice: txResponse.gasPrice?.toString() ?? '0',
        ...(txResponse.maxFeePerGas && {
          maxFeePerGas: txResponse.maxFeePerGas.toString(),
        }),
        ...(txResponse.maxPriorityFeePerGas && {
          maxPriorityFeePerGas: txResponse.maxPriorityFeePerGas.toString(),
        }),
        nonce: txResponse.nonce,
        data: txResponse.data,
        blockNumber: txResponse.blockNumber,
        blockHash: txResponse.blockHash,
        status: 'pending',
      };
    } catch (error) {
      if (error instanceof EthereumError) {
        throw error;
      }
      logger.error('Failed to send transaction', { to, value: value.toString(), error });
      throw new EthereumError('Transaction failed', EthereumErrorCode.TRANSACTION_FAILED, {
        to,
        value: value.toString(),
        error: String(error),
      });
    }
  }

  /**
   * Call contract method - read-only operation
   *
   * Edge cases handled:
   * - Contract doesn't exist → Error
   * - Method not found in ABI → Error
   * - Invalid arguments → Error
   */
  async callContract(params: unknown): Promise<ContractCallResponse> {
    const validated = CallContractParamsSchema.parse(params);
    const { address, abi, method, args = [], blockTag = 'latest' } = validated;

    try {
      // Verify contract exists
      const code = await this.provider.getCode(address, blockTag);
      if (code === '0x') {
        throw new EthereumError('No contract at address', EthereumErrorCode.CONTRACT_CALL_FAILED, {
          address,
        });
      }

      const contract = new ethers.Contract(address, abi, this.provider.getProvider());

      // Verify method exists in ABI
      try {
        contract.interface.getFunction(method);
      } catch {
        const availableMethods = contract.interface.fragments
          .filter((f): f is ethers.FunctionFragment => f.type === 'function')
          .map((f) => f.name);
        throw new EthereumError(
          `Method ${method} not found in contract`,
          EthereumErrorCode.CONTRACT_CALL_FAILED,
          { address, method, availableMethods }
        );
      }

      // Call contract method (verified to exist above)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (contract[method] as any)(...args);
      const blockNumber = await this.provider.getBlockNumber();

      logger.info('Contract called', {
        address,
        method,
        blockNumber,
      });

      return {
        result,
        blockNumber,
      };
    } catch (error) {
      if (error instanceof EthereumError) {
        throw error;
      }
      logger.error('Failed to call contract', { address, method, error });
      throw new EthereumError('Contract call failed', EthereumErrorCode.CONTRACT_CALL_FAILED, {
        address,
        method,
        error: String(error),
      });
    }
  }

  /**
   * Deploy contract
   *
   * Edge cases handled:
   * - Invalid bytecode → Error
   * - Constructor args mismatch → Error
   * - Deployment failure → Error with reason
   *
   * ⚠️ Wait for 12+ confirmations after deployment (chain reorg protection)
   */
  async deployContract(params: unknown): Promise<DeploymentResponse> {
    if (!this.wallet) {
      throw new EthereumError(
        'Wallet not initialized. Call initializeWallet() first',
        EthereumErrorCode.NETWORK_ERROR
      );
    }

    const validated = DeployContractParamsSchema.parse(params);
    const { bytecode, abi, constructorArgs = [], gasLimit, gasPrice } = validated;

    try {
      // Create contract factory
      const factory = new ethers.ContractFactory(abi, bytecode, this.wallet);

      // Estimate gas if not provided
      const deployTx = await factory.getDeployTransaction(...constructorArgs);
      let estimatedGas = gasLimit;
      if (!estimatedGas) {
        estimatedGas = await this.provider.estimateGas(deployTx);
      }

      // Get gas price if not provided
      let txGasPrice = gasPrice;
      if (!txGasPrice) {
        txGasPrice = await this.provider.getGasPrice();
      }

      // Deploy contract
      const contract = await factory.deploy(...constructorArgs, {
        gasLimit: estimatedGas,
        gasPrice: txGasPrice,
      });

      // Wait for deployment (1 confirmation)
      await contract.waitForDeployment();

      const contractAddress = await contract.getAddress();
      const deploymentTx = contract.deploymentTransaction();

      if (!deploymentTx) {
        throw new EthereumError(
          'Deployment transaction not found',
          EthereumErrorCode.DEPLOYMENT_FAILED
        );
      }

      // Wait for receipt
      const receipt = await this.provider.getTransactionReceipt(deploymentTx.hash);

      logger.info('Contract deployed', {
        address: contractAddress,
        transactionHash: deploymentTx.hash,
      });

      return {
        contractAddress: contractAddress.toLowerCase() as Address,
        transactionHash: deploymentTx.hash,
        blockNumber: receipt?.blockNumber ?? 0,
        gasUsed: receipt?.gasUsed.toString() ?? '0',
      };
    } catch (error) {
      logger.error('Failed to deploy contract', { error });
      throw new EthereumError('Contract deployment failed', EthereumErrorCode.DEPLOYMENT_FAILED, {
        error: String(error),
      });
    }
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(
    params: unknown
  ): Promise<{ gasEstimate: string; gasEstimateWithBuffer: string }> {
    const validated = SendTransactionParamsSchema.partial().parse(params);
    const { to, value = 0n, data = '0x' } = validated;

    try {
      const tx: ethers.TransactionRequest = {
        ...(to && { to }),
        value,
        data,
      };

      const estimate = await this.provider.estimateGas(tx);

      return {
        gasEstimate: estimate.toString(),
        gasEstimateWithBuffer: estimate.toString(), // Provider already adds 20% buffer
      };
    } catch (error) {
      logger.error('Failed to estimate gas', { to, value: value.toString(), error });
      throw new EthereumError('Gas estimation failed', EthereumErrorCode.NETWORK_ERROR, {
        to,
        value: value.toString(),
        error: String(error),
      });
    }
  }

  /**
   * Get current gas price with EIP-1559 support
   */
  async getGasPrice(): Promise<{
    gasPrice: string;
    maxFeePerGas: string | null;
    maxPriorityFeePerGas: string | null;
  }> {
    try {
      const feeData = await this.provider.getFeeData();

      return {
        gasPrice: feeData.gasPrice?.toString() ?? '0',
        maxFeePerGas: feeData.maxFeePerGas?.toString() ?? null,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() ?? null,
      };
    } catch (error) {
      logger.error('Failed to get gas price', { error });
      throw new EthereumError('Failed to get gas price', EthereumErrorCode.NETWORK_ERROR, {
        error: String(error),
      });
    }
  }

  /**
   * Wait for transaction confirmation
   *
   * Waits for specified confirmations (default: 12 for chain reorg protection)
   */
  async waitForTransaction(
    hash: TxHash,
    confirmations = 12
  ): Promise<{
    confirmed: boolean;
    blockNumber: number;
    gasUsed: string;
    status: 'confirmed' | 'failed';
  }> {
    try {
      const receipt = await this.provider.waitForTransaction(hash, confirmations);

      if (!receipt) {
        throw new EthereumError('Transaction not found or timed out', EthereumErrorCode.TIMEOUT, {
          hash,
          confirmations,
        });
      }

      return {
        confirmed: true,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? 'confirmed' : 'failed',
      };
    } catch (error) {
      logger.error('Failed to wait for transaction', { hash, confirmations, error });
      throw new EthereumError('Failed to wait for transaction', EthereumErrorCode.TIMEOUT, {
        hash,
        confirmations,
        error: String(error),
      });
    }
  }
}

/**
 * Factory function to create tool manager
 */
export function createToolManager(provider: EthereumProvider): EthereumToolManager {
  return new EthereumToolManager(provider);
}
