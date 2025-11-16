/**
 * Inter-Agent Communication Protocol
 *
 * Provides message queue and communication infrastructure for agents:
 * - Asynchronous message passing
 * - Request/response patterns
 * - Broadcast messaging
 * - Message handler registration
 */

import {
  type Message,
  type Response,
  type MessageHandler,
  type MessageType,
} from '../types/agent.js';
import { logger } from '../utils/index.js';

/**
 * Message Queue
 *
 * Manages message passing between agents.
 * Supports:
 * - Direct messaging (request/response)
 * - Broadcast messaging
 * - Message handlers
 * - Timeout handling
 */
export class MessageQueue {
  private queues: Map<string, Message[]>;
  private handlers: Map<string, MessageHandler>;
  private responses: Map<string, Response>;
  private readonly defaultTimeout: number;

  constructor(defaultTimeout = 30000) {
    this.queues = new Map();
    this.handlers = new Map();
    this.responses = new Map();
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Send message to target agent
   *
   * @param to - Target agent ID
   * @param message - Message to send
   * @param timeout - Optional timeout override
   * @returns Response from target agent
   */
  async send<T = unknown, R = unknown>(
    to: string,
    message: Message<T>,
    timeout?: number
  ): Promise<Response<R>> {
    logger.debug('Sending message', {
      from: message.from,
      to: message.to,
      type: message.type,
      messageId: message.id,
    });

    // Add to recipient's queue
    const queue = this.queues.get(to) || [];
    queue.push(message);
    this.queues.set(to, queue);

    // If handler registered, process immediately
    const handler = this.handlers.get(to);
    if (handler) {
      try {
        const response = await handler(message);
        this.responses.set(message.id, response);
        logger.debug('Message handled immediately', {
          messageId: message.id,
          success: response.success,
        });
        return response as Response<R>;
      } catch (error) {
        logger.error('Handler error', { messageId: message.id, error });
        const errorResponse: Response = {
          messageId: message.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        };
        this.responses.set(message.id, errorResponse);
        return errorResponse as Response<R>;
      }
    }

    // Otherwise, wait for response
    return await this.waitForResponse<R>(message.id, timeout ?? this.defaultTimeout);
  }

  /**
   * Broadcast message to all registered agents
   *
   * @param message - Message to broadcast
   */
  async broadcast<T = unknown>(message: Message<T>): Promise<void> {
    logger.info('Broadcasting message', {
      from: message.from,
      type: message.type,
      recipientCount: this.handlers.size,
    });

    const broadcastMessage: Message<T> = {
      ...message,
      type: 'broadcast',
    };

    // Send to all registered handlers
    const promises: Promise<void>[] = [];

    for (const [agentId, handler] of this.handlers.entries()) {
      promises.push(
        handler(broadcastMessage)
          .then((response) => {
            logger.debug(`Broadcast received by ${agentId}`, { success: response.success });
          })
          .catch((error) => {
            logger.warn(`Broadcast failed for ${agentId}`, { error });
          })
      );
    }

    await Promise.allSettled(promises);
  }

  /**
   * Register message handler for an agent
   *
   * @param agentId - Agent ID to register handler for
   * @param handler - Handler function
   */
  registerHandler<T = unknown, R = unknown>(agentId: string, handler: MessageHandler<T, R>): void {
    this.handlers.set(agentId, handler as MessageHandler);
    logger.info(`Registered message handler for agent: ${agentId}`);

    // Process any pending messages
    this.processPendingMessages(agentId).catch((error) => {
      logger.error(`Failed to process pending messages for ${agentId}`, { error });
    });
  }

  /**
   * Unregister message handler for an agent
   *
   * @param agentId - Agent ID to unregister
   */
  unregisterHandler(agentId: string): void {
    const removed = this.handlers.delete(agentId);
    if (removed) {
      logger.info(`Unregistered message handler for agent: ${agentId}`);
    }
  }

  /**
   * Post response to a message
   *
   * Used by handlers that process messages asynchronously.
   *
   * @param response - Response to post
   */
  postResponse(response: Response): void {
    this.responses.set(response.messageId, response);
    logger.debug('Response posted', {
      messageId: response.messageId,
      success: response.success,
    });
  }

  /**
   * Get pending messages for an agent
   *
   * @param agentId - Agent ID
   * @returns Array of pending messages
   */
  getPendingMessages(agentId: string): Message[] {
    return this.queues.get(agentId) || [];
  }

  /**
   * Clear messages for an agent
   *
   * @param agentId - Agent ID
   */
  clearMessages(agentId: string): void {
    this.queues.delete(agentId);
    logger.debug(`Cleared messages for agent: ${agentId}`);
  }

  /**
   * Get queue statistics
   *
   * @returns Queue stats
   */
  getStats(): {
    totalQueues: number;
    totalMessages: number;
    totalHandlers: number;
    totalResponses: number;
  } {
    let totalMessages = 0;
    for (const queue of this.queues.values()) {
      totalMessages += queue.length;
    }

    return {
      totalQueues: this.queues.size,
      totalMessages,
      totalHandlers: this.handlers.size,
      totalResponses: this.responses.size,
    };
  }

  /**
   * Private helper methods
   */

  private async waitForResponse<R = unknown>(
    messageId: string,
    timeout: number
  ): Promise<Response<R>> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      // Check if response is available
      const response = this.responses.get(messageId);
      if (response) {
        // Clean up response
        this.responses.delete(messageId);
        return response as Response<R>;
      }

      // Poll interval: 100ms
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Timeout
    const errorResponse: Response = {
      messageId,
      success: false,
      error: `Message ${messageId} timed out after ${timeout}ms`,
      timestamp: Date.now(),
    };

    logger.warn('Message timed out', { messageId, timeout });
    return errorResponse as Response<R>;
  }

  private async processPendingMessages(agentId: string): Promise<void> {
    const queue = this.queues.get(agentId);
    if (!queue || queue.length === 0) return;

    const handler = this.handlers.get(agentId);
    if (!handler) return;

    logger.debug(`Processing ${queue.length} pending messages for ${agentId}`);

    // Process all pending messages
    const messages = [...queue];
    this.queues.set(agentId, []); // Clear queue

    for (const message of messages) {
      try {
        const response = await handler(message);
        this.responses.set(message.id, response);
      } catch (error) {
        logger.error('Failed to process pending message', { messageId: message.id, error });
        const errorResponse: Response = {
          messageId: message.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        };
        this.responses.set(message.id, errorResponse);
      }
    }
  }
}

/**
 * Create a message with standard format
 *
 * @param from - Sender agent ID
 * @param to - Recipient agent ID
 * @param type - Message type
 * @param payload - Message payload
 * @param replyTo - Optional message ID this is replying to
 * @returns Formatted message
 */
export function createMessage<T = unknown>(
  from: string,
  to: string,
  type: MessageType,
  payload: T,
  replyTo?: string
): Message<T> {
  const message: Message<T> = {
    id: `msg-${from}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    from,
    to,
    type,
    payload,
    timestamp: Date.now(),
  };

  if (replyTo !== undefined) {
    message.replyTo = replyTo;
  }

  return message;
}

/**
 * Create a response with standard format
 *
 * @param messageId - ID of message being responded to
 * @param success - Whether the operation succeeded
 * @param data - Optional response data
 * @param error - Optional error message
 * @returns Formatted response
 */
export function createResponse<T = unknown>(
  messageId: string,
  success: boolean,
  data?: T,
  error?: string
): Response<T> {
  const response: Response<T> = {
    messageId,
    success,
    timestamp: Date.now(),
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (error !== undefined) {
    response.error = error;
  }

  return response;
}
