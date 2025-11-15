import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MessageQueue,
  createMessage,
  createResponse,
} from '../../../src/agents/communication.js';
import { type MessageHandler } from '../../../src/types/agent.js';

describe('MessageQueue', () => {
  let queue: MessageQueue;

  beforeEach(() => {
    queue = new MessageQueue(5000); // 5 second timeout for tests
  });

  describe('Initialization', () => {
    it('should create message queue', () => {
      expect(queue).toBeDefined();
    });

    it('should initialize with empty stats', () => {
      const stats = queue.getStats();

      expect(stats.totalQueues).toBe(0);
      expect(stats.totalMessages).toBe(0);
      expect(stats.totalHandlers).toBe(0);
      expect(stats.totalResponses).toBe(0);
    });
  });

  describe('Message Handling', () => {
    it('should register message handler', () => {
      const handler: MessageHandler = vi.fn().mockResolvedValue({
        messageId: 'test',
        success: true,
        timestamp: Date.now(),
      });

      queue.registerHandler('agent1', handler);

      const stats = queue.getStats();
      expect(stats.totalHandlers).toBe(1);
    });

    it('should unregister message handler', () => {
      const handler: MessageHandler = vi.fn();

      queue.registerHandler('agent1', handler);
      expect(queue.getStats().totalHandlers).toBe(1);

      queue.unregisterHandler('agent1');
      expect(queue.getStats().totalHandlers).toBe(0);
    });

    it('should call handler immediately when sending message', async () => {
      const handler: MessageHandler = vi.fn().mockResolvedValue({
        messageId: 'msg-1',
        success: true,
        data: 'handled',
        timestamp: Date.now(),
      });

      queue.registerHandler('agent1', handler);

      const message = createMessage('agent2', 'agent1', 'request', { data: 'test' });

      const response = await queue.send('agent1', message);

      expect(handler).toHaveBeenCalledWith(message);
      expect(response.success).toBe(true);
      expect(response.data).toBe('handled');
    });

    it('should handle handler errors gracefully', async () => {
      const handler: MessageHandler = vi.fn().mockRejectedValue(new Error('Handler failed'));

      queue.registerHandler('agent1', handler);

      const message = createMessage('agent2', 'agent1', 'request', { data: 'test' });

      const response = await queue.send('agent1', message);

      expect(response.success).toBe(false);
      expect(response.error).toContain('Handler failed');
    });
  });

  describe('Message Queueing', () => {
    it('should queue message when no handler registered', async () => {
      const message = createMessage('agent1', 'agent2', 'request', { data: 'test' });

      // Send without waiting (will timeout)
      const responsePromise = queue.send('agent2', message, 500); // Short timeout

      // Check that message is queued
      const pending = queue.getPendingMessages('agent2');
      expect(pending.length).toBe(1);
      expect(pending[0]?.id).toBe(message.id);

      // Wait for timeout
      const response = await responsePromise;
      expect(response.success).toBe(false);
      expect(response.error).toContain('timed out');
    });

    it('should process pending messages when handler registered', async () => {
      const message = createMessage('agent1', 'agent2', 'request', { data: 'test' });

      // Send message before handler registered
      queue.send('agent2', message, 500);

      // Wait a bit for message to be queued
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Now register handler
      const handler: MessageHandler = vi.fn().mockResolvedValue({
        messageId: message.id,
        success: true,
        timestamp: Date.now(),
      });

      queue.registerHandler('agent2', handler);

      // Give time for pending processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalled();
    });

    it('should clear messages for agent', () => {
      const msg1 = createMessage('agent1', 'agent2', 'request', { data: '1' });
      const msg2 = createMessage('agent1', 'agent2', 'request', { data: '2' });

      queue.send('agent2', msg1, 500);
      queue.send('agent2', msg2, 500);

      expect(queue.getPendingMessages('agent2').length).toBe(2);

      queue.clearMessages('agent2');

      expect(queue.getPendingMessages('agent2').length).toBe(0);
    });
  });

  describe('Response Handling', () => {
    it('should post and retrieve response', async () => {
      const message = createMessage('agent1', 'agent2', 'request', { data: 'test' });

      // Send message
      const responsePromise = queue.send('agent2', message, 2000);

      // Post response manually
      setTimeout(() => {
        queue.postResponse({
          messageId: message.id,
          success: true,
          data: 'response data',
          timestamp: Date.now(),
        });
      }, 100);

      const response = await responsePromise;

      expect(response.success).toBe(true);
      expect(response.data).toBe('response data');
    });

    it(
      'should timeout when no response received',
      async () => {
        const message = createMessage('agent1', 'agent2', 'request', { data: 'test' });

        const response = await queue.send('agent2', message, 500);

        expect(response.success).toBe(false);
        expect(response.error).toContain('timed out');
      },
      10000
    ); // 10 second test timeout
  });

  describe('Broadcasting', () => {
    it('should broadcast message to all handlers', async () => {
      const handler1: MessageHandler = vi.fn().mockResolvedValue({
        messageId: 'msg-1',
        success: true,
        timestamp: Date.now(),
      });

      const handler2: MessageHandler = vi.fn().mockResolvedValue({
        messageId: 'msg-1',
        success: true,
        timestamp: Date.now(),
      });

      queue.registerHandler('agent1', handler1);
      queue.registerHandler('agent2', handler2);

      const message = createMessage('orchestrator', 'broadcast', 'broadcast', { data: 'test' });

      await queue.broadcast(message);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should handle broadcast failures gracefully', async () => {
      const handler1: MessageHandler = vi.fn().mockResolvedValue({
        messageId: 'msg-1',
        success: true,
        timestamp: Date.now(),
      });

      const handler2: MessageHandler = vi.fn().mockRejectedValue(new Error('Failed'));

      queue.registerHandler('agent1', handler1);
      queue.registerHandler('agent2', handler2);

      const message = createMessage('orchestrator', 'broadcast', 'broadcast', { data: 'test' });

      // Should not throw
      await expect(queue.broadcast(message)).resolves.toBeUndefined();

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    it('should track message queue stats', () => {
      const handler: MessageHandler = vi.fn();
      queue.registerHandler('agent1', handler);

      const msg1 = createMessage('agent2', 'agent3', 'request', { data: '1' });
      const msg2 = createMessage('agent2', 'agent3', 'request', { data: '2' });

      queue.send('agent3', msg1, 500);
      queue.send('agent3', msg2, 500);

      const stats = queue.getStats();

      expect(stats.totalHandlers).toBe(1);
      expect(stats.totalQueues).toBe(1);
      expect(stats.totalMessages).toBe(2);
    });
  });
});

describe('Message Helpers', () => {
  describe('createMessage', () => {
    it('should create message with required fields', () => {
      const message = createMessage('agent1', 'agent2', 'request', { data: 'test' });

      expect(message.id).toBeDefined();
      expect(message.from).toBe('agent1');
      expect(message.to).toBe('agent2');
      expect(message.type).toBe('request');
      expect(message.payload).toEqual({ data: 'test' });
      expect(message.timestamp).toBeDefined();
    });

    it('should create message with replyTo', () => {
      const message = createMessage('agent1', 'agent2', 'response', { data: 'test' }, 'msg-123');

      expect(message.replyTo).toBe('msg-123');
    });

    it('should generate unique message IDs', () => {
      const msg1 = createMessage('agent1', 'agent2', 'request', {});
      const msg2 = createMessage('agent1', 'agent2', 'request', {});

      expect(msg1.id).not.toBe(msg2.id);
    });
  });

  describe('createResponse', () => {
    it('should create successful response', () => {
      const response = createResponse('msg-123', true, { result: 'success' });

      expect(response.messageId).toBe('msg-123');
      expect(response.success).toBe(true);
      expect(response.data).toEqual({ result: 'success' });
      expect(response.error).toBeUndefined();
      expect(response.timestamp).toBeDefined();
    });

    it('should create error response', () => {
      const response = createResponse('msg-456', false, undefined, 'Something went wrong');

      expect(response.messageId).toBe('msg-456');
      expect(response.success).toBe(false);
      expect(response.data).toBeUndefined();
      expect(response.error).toBe('Something went wrong');
      expect(response.timestamp).toBeDefined();
    });
  });
});
