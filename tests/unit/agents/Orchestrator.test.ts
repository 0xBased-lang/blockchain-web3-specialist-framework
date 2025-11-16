import { describe, it, expect, beforeEach } from 'vitest';
import { OrchestratorAgent } from '../../../src/agents/OrchestratorAgent.js';
import { BaseAgent } from '../../../src/agents/BaseAgent.js';
import {
  type Task,
  type TaskPlan,
  type Result,
  type ValidationResult,
  type Proposal,
  type OrchestratorConfig,
} from '../../../src/types/agent.js';

// Simple test agent
class MockAgent extends BaseAgent {
  async plan(task: Task): Promise<TaskPlan> {
    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps: [
        {
          id: 'step-1',
          action: task.type,
          agent: this.name,
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
      data: { executed: plan.steps.length },
    };
  }

  async validate(result: Result): Promise<ValidationResult> {
    return { valid: result.success };
  }
}

describe('OrchestratorAgent', () => {
  let orchestrator: OrchestratorAgent;
  let config: OrchestratorConfig;

  beforeEach(() => {
    config = {
      id: 'orchestrator-1',
      name: 'Orchestrator',
      description: 'Master coordinator',
      capabilities: ['orchestration', 'coordination'],
      maxAgents: 10,
      coordinationStrategy: 'adaptive',
    };

    orchestrator = new OrchestratorAgent(config);
  });

  describe('Initialization', () => {
    it('should create orchestrator with config', () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator.getMetadata().name).toBe('Orchestrator');
    });

    it('should initialize with empty agent registry', () => {
      expect(orchestrator.getAgents().length).toBe(0);
    });

    it('should have orchestrator stats', () => {
      const stats = orchestrator.getStats();

      expect(stats.registeredAgents).toBe(0);
      expect(stats.strategy).toBe('adaptive');
    });
  });

  describe('Agent Management', () => {
    it('should register agent', () => {
      const agent = new MockAgent({
        id: 'agent-1',
        name: 'Agent1',
        description: 'Test',
        capabilities: [],
      });

      orchestrator.registerAgent('agent1', agent);

      expect(orchestrator.getAgents()).toContain('agent1');
      expect(orchestrator.getStats().registeredAgents).toBe(1);
    });

    it('should unregister agent', () => {
      const agent = new MockAgent({
        id: 'agent-1',
        name: 'Agent1',
        description: 'Test',
        capabilities: [],
      });

      orchestrator.registerAgent('agent1', agent);
      expect(orchestrator.getAgents().length).toBe(1);

      orchestrator.unregisterAgent('agent1');
      expect(orchestrator.getAgents().length).toBe(0);
    });

    it('should register multiple agents', () => {
      const agent1 = new MockAgent({
        id: 'agent-1',
        name: 'Agent1',
        description: 'Test',
        capabilities: [],
      });

      const agent2 = new MockAgent({
        id: 'agent-2',
        name: 'Agent2',
        description: 'Test',
        capabilities: [],
      });

      orchestrator.registerAgent('agent1', agent1);
      orchestrator.registerAgent('agent2', agent2);

      expect(orchestrator.getAgents().length).toBe(2);
      expect(orchestrator.getAgents()).toContain('agent1');
      expect(orchestrator.getAgents()).toContain('agent2');
    });

    it('should enforce max agents limit', () => {
      const smallOrchestrator = new OrchestratorAgent({
        ...config,
        maxAgents: 2,
      });

      const agent1 = new MockAgent({ id: '1', name: 'A1', description: '', capabilities: [] });
      const agent2 = new MockAgent({ id: '2', name: 'A2', description: '', capabilities: [] });
      const agent3 = new MockAgent({ id: '3', name: 'A3', description: '', capabilities: [] });

      smallOrchestrator.registerAgent('a1', agent1);
      smallOrchestrator.registerAgent('a2', agent2);

      expect(() => smallOrchestrator.registerAgent('a3', agent3)).toThrow(
        'Maximum number of agents'
      );
    });
  });

  describe('Task Planning', () => {
    it('should create task plan', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'defi_swap',
        params: { from: 'ETH', to: 'USDC', amount: '1.0' },
        priority: 1,
      };

      const plan = await orchestrator.plan(task);

      expect(plan).toBeDefined();
      expect(plan.taskId).toBe('task-1');
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.estimatedTime).toBeGreaterThan(0);
    });

    it('should identify required agents for DeFi swap', async () => {
      const task: Task = {
        id: 'task-2',
        type: 'defi_swap',
        params: {},
        priority: 1,
      };

      const plan = await orchestrator.plan(task);

      // Should have multiple steps requiring different agents
      expect(plan.steps.length).toBeGreaterThan(1);
    });

    it('should create fallback strategies for complex tasks', async () => {
      const task: Task = {
        id: 'task-3',
        type: 'multi_chain_transfer',
        params: { fromChain: 'ethereum', toChain: 'solana' },
        priority: 1,
      };

      const plan = await orchestrator.plan(task);

      expect(plan.fallbackStrategies).toBeDefined();
      expect(plan.fallbackStrategies.length).toBeGreaterThan(0);
    });
  });

  describe('Task Execution', () => {
    it('should execute simple task plan', async () => {
      const agent = new MockAgent({
        id: 'blockchain-1',
        name: 'blockchain',
        description: 'Blockchain agent',
        capabilities: [],
      });

      orchestrator.registerAgent('blockchain', agent);

      const task: Task = {
        id: 'task-4',
        type: 'token_transfer',
        params: {},
        priority: 1,
      };

      const result = await orchestrator.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('Validation', () => {
    it('should validate successful result', async () => {
      const result: Result = {
        success: true,
        data: { value: 42 },
      };

      const validation = await orchestrator.validate(result);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toBeUndefined();
    });

    it('should detect failed result', async () => {
      const result: Result = {
        success: false,
        error: 'Something failed',
      };

      const validation = await orchestrator.validate(result);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toBeDefined();
      expect(validation.errors?.length).toBeGreaterThan(0);
    });

    it('should warn about missing data in successful result', async () => {
      const result: Result = {
        success: true,
        // No data field
      };

      const validation = await orchestrator.validate(result);

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toBeDefined();
      expect(validation.warnings).toContain('Successful result has no data');
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve conflict between proposals', () => {
      const proposals: Proposal[] = [
        {
          id: 'prop-1',
          agent: 'agent1',
          action: 'swap_uniswap',
          params: {},
          confidence: 0.8,
          estimatedCost: 50,
          estimatedTime: 5000,
          rationale: 'Uniswap has good liquidity',
        },
        {
          id: 'prop-2',
          agent: 'agent2',
          action: 'swap_sushiswap',
          params: {},
          confidence: 0.9,
          estimatedCost: 45,
          estimatedTime: 4000,
          rationale: 'SushiSwap is faster and cheaper',
        },
      ];

      const best = orchestrator.resolveConflict(proposals);

      // Should pick prop-2: higher confidence, lower cost, faster
      expect(best.id).toBe('prop-2');
      expect(best.agent).toBe('agent2');
    });
  });

  describe('Statistics', () => {
    it('should provide orchestrator stats', () => {
      const agent1 = new MockAgent({ id: '1', name: 'A1', description: '', capabilities: [] });
      const agent2 = new MockAgent({ id: '2', name: 'A2', description: '', capabilities: [] });

      orchestrator.registerAgent('a1', agent1);
      orchestrator.registerAgent('a2', agent2);

      const stats = orchestrator.getStats();

      expect(stats.registeredAgents).toBe(2);
      expect(stats.strategy).toBe('adaptive');
      expect(stats.capabilities).toBeDefined();
    });
  });
});
