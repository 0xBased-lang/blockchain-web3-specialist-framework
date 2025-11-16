import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseAgent } from '../../../src/agents/BaseAgent.js';
import {
  type Task,
  type TaskPlan,
  type Result,
  type ValidationResult,
  type AgentConfig,
} from '../../../src/types/agent.js';

/**
 * Test implementation of BaseAgent
 */
class TestAgent extends BaseAgent {
  async plan(task: Task): Promise<TaskPlan> {
    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps: [
        {
          id: 'step-1',
          action: task.type,
          agent: 'test',
          params: task.params,
          dependsOn: [],
          timeout: 5000,
        },
      ],
      dependencies: [],
      estimatedTime: 5000,
      requiredResources: [],
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  async execute(plan: TaskPlan): Promise<Result> {
    return {
      success: true,
      data: { planId: plan.id },
      timestamp: Date.now(),
    };
  }

  async validate(result: Result): Promise<ValidationResult> {
    return {
      valid: result.success === true,
      errors: result.success ? [] : ['Execution failed'],
    };
  }
}

/**
 * Failing test agent (for error scenarios)
 */
class FailingAgent extends BaseAgent {
  async plan(_task: Task): Promise<TaskPlan> {
    throw new Error('Planning failed');
  }

  async execute(_plan: TaskPlan): Promise<Result> {
    return {
      success: false,
      error: 'Execution failed',
    };
  }

  async validate(_result: Result): Promise<ValidationResult> {
    return {
      valid: false,
      errors: ['Validation failed'],
    };
  }
}

describe('BaseAgent', () => {
  let agent: TestAgent;
  let config: AgentConfig;

  beforeEach(() => {
    config = {
      id: 'test-agent-1',
      name: 'TestAgent',
      description: 'Agent for testing',
      capabilities: ['test', 'mock'],
      mcpClient: {},
      maxConcurrentTasks: 5,
      timeout: 10000,
    };

    agent = new TestAgent(config);
  });

  describe('Initialization', () => {
    it('should create agent with config', () => {
      expect(agent).toBeDefined();
      expect(agent.getMetadata().name).toBe('TestAgent');
      expect(agent.getMetadata().id).toBe('test-agent-1');
      expect(agent.getMetadata().description).toBe('Agent for testing');
    });

    it('should initialize with capabilities', () => {
      const capabilities = agent.getCapabilities();

      expect(capabilities).toContain('test');
      expect(capabilities).toContain('mock');
      expect(capabilities.length).toBe(2);
    });

    it('should have default values for optional config', () => {
      const minimalConfig: AgentConfig = {
        id: 'minimal',
        name: 'Minimal',
        description: 'Minimal agent',
        capabilities: [],
      };

      const minimalAgent = new TestAgent(minimalConfig);

      expect(minimalAgent).toBeDefined();
      expect(minimalAgent.getCapabilities().length).toBe(0);
    });
  });

  describe('Capabilities', () => {
    it('should check if agent has capability', () => {
      expect(agent.hasCapability('test')).toBe(true);
      expect(agent.hasCapability('mock')).toBe(true);
      expect(agent.hasCapability('nonexistent')).toBe(false);
    });

    it('should get all capabilities', () => {
      const caps = agent.getCapabilities();

      expect(Array.isArray(caps)).toBe(true);
      expect(caps.length).toBe(2);
    });

    it('should return copy of capabilities array', () => {
      const caps1 = agent.getCapabilities();
      const caps2 = agent.getCapabilities();

      expect(caps1).toEqual(caps2);
      expect(caps1).not.toBe(caps2); // Different array instances
    });
  });

  describe('Metadata', () => {
    it('should get agent metadata', () => {
      const metadata = agent.getMetadata();

      expect(metadata.id).toBe('test-agent-1');
      expect(metadata.name).toBe('TestAgent');
      expect(metadata.description).toBe('Agent for testing');
      expect(metadata.capabilities).toEqual(['test', 'mock']);
      expect(metadata.subagentCount).toBe(0);
    });

    it('should update subagent count in metadata', () => {
      const subagent = new TestAgent({
        id: 'subagent-1',
        name: 'Subagent',
        description: 'Sub',
        capabilities: [],
      });

      agent.registerSubagent('sub1', subagent);

      const metadata = agent.getMetadata();
      expect(metadata.subagentCount).toBe(1);
    });
  });

  describe('Task Execution', () => {
    it('should execute task successfully', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'test_action',
        params: { value: 42 },
        priority: 1,
      };

      const result = await agent.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should validate result after execution', async () => {
      const task: Task = {
        id: 'task-2',
        type: 'test_action',
        params: {},
        priority: 1,
      };

      const result = await agent.executeTask(task);

      expect(result.success).toBe(true);
    });

    it('should handle planning errors', async () => {
      const failingAgent = new FailingAgent(config);

      const task: Task = {
        id: 'task-3',
        type: 'failing',
        params: {},
        priority: 1,
      };

      const result = await failingAgent.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Planning failed');
    });

    it('should handle validation failures', async () => {
      const failingAgent = new FailingAgent(config);

      // Override plan to succeed but execute to fail
      failingAgent.plan = async (task: Task): Promise<TaskPlan> => ({
        id: 'plan-1',
        taskId: task.id,
        steps: [],
        dependencies: [],
        estimatedTime: 1000,
        requiredResources: [],
        fallbackStrategies: [],
        createdAt: new Date(),
      });

      const task: Task = {
        id: 'task-4',
        type: 'test',
        params: {},
        priority: 1,
      };

      const result = await failingAgent.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });
  });

  describe('Subagent Management', () => {
    it('should register subagent', () => {
      const subagent = new TestAgent({
        id: 'subagent-1',
        name: 'Subagent',
        description: 'Sub',
        capabilities: [],
      });

      agent.registerSubagent('sub1', subagent);

      const subagents = agent.getSubagents();
      expect(subagents).toContain('sub1');
      expect(subagents.length).toBe(1);
    });

    it('should unregister subagent', () => {
      const subagent = new TestAgent({
        id: 'subagent-1',
        name: 'Subagent',
        description: 'Sub',
        capabilities: [],
      });

      agent.registerSubagent('sub1', subagent);
      expect(agent.getSubagents().length).toBe(1);

      agent.unregisterSubagent('sub1');
      expect(agent.getSubagents().length).toBe(0);
    });

    it('should get list of subagents', () => {
      const sub1 = new TestAgent({
        id: 'sub-1',
        name: 'Sub1',
        description: '',
        capabilities: [],
      });

      const sub2 = new TestAgent({
        id: 'sub-2',
        name: 'Sub2',
        description: '',
        capabilities: [],
      });

      agent.registerSubagent('sub1', sub1);
      agent.registerSubagent('sub2', sub2);

      const subagents = agent.getSubagents();
      expect(subagents.length).toBe(2);
      expect(subagents).toContain('sub1');
      expect(subagents).toContain('sub2');
    });
  });

  describe('Delegation', () => {
    it('should delegate to registered subagent', async () => {
      const subagent = new TestAgent({
        id: 'subagent-1',
        name: 'Subagent',
        description: 'Sub',
        capabilities: [],
      });

      agent.registerSubagent('sub1', subagent);

      const result = await agent.delegate({ action: 'test', params: {} }, 'sub1');

      expect(result.success).toBe(true);
    });

    it('should throw error for unregistered subagent', async () => {
      await expect(agent.delegate({ action: 'test', params: {} }, 'nonexistent')).rejects.toThrow(
        'Subagent nonexistent not found'
      );
    });

    it('should pass parameters to subagent', async () => {
      const subagent = new TestAgent({
        id: 'subagent-1',
        name: 'Subagent',
        description: 'Sub',
        capabilities: [],
      });

      const executeSpy = vi.spyOn(subagent, 'executeTask');

      agent.registerSubagent('sub1', subagent);

      await agent.delegate({ action: 'test_action', params: { value: 42 } }, 'sub1');

      expect(executeSpy).toHaveBeenCalled();

      const callArg = executeSpy.mock.calls[0]?.[0];
      expect(callArg).toBeDefined();
      expect(callArg?.type).toBe('test_action');
      expect(callArg?.params['value']).toBe(42);
    });

    it('should handle subagent execution errors', async () => {
      const failingSubagent = new FailingAgent({
        id: 'failing-sub',
        name: 'Failing',
        description: '',
        capabilities: [],
      });

      agent.registerSubagent('failing', failingSubagent);

      const result = await agent.delegate({ action: 'test', params: {} }, 'failing');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Planning failed');
    });
  });

  describe('Communication', () => {
    it('should throw error for communication (not yet implemented)', async () => {
      const message = {
        id: 'msg-1',
        from: 'test-agent-1',
        to: 'other-agent',
        type: 'request' as const,
        payload: { data: 'test' },
        timestamp: Date.now(),
      };

      await expect(agent.communicate('other-agent', message)).rejects.toThrow(
        'Inter-agent communication not yet implemented'
      );
    });
  });
});
