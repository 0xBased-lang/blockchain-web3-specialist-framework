import { describe, it, expect, beforeEach } from 'vitest';
import { TaskPlanner } from '../../../src/agents/planning.js';
import { type Task, type Step } from '../../../src/types/agent.js';

describe('TaskPlanner', () => {
  let planner: TaskPlanner;

  beforeEach(() => {
    planner = new TaskPlanner();
  });

  describe('Task Decomposition', () => {
    it('should decompose DeFi swap task', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'defi_swap',
        params: {
          from: 'ETH',
          to: 'USDC',
          amount: '1.0',
        },
        priority: 1,
      };

      const steps = await planner.decompose(task);

      expect(steps.length).toBe(4);
      expect(steps[0]?.action).toBe('get_price');
      expect(steps[1]?.action).toBe('get_quotes');
      expect(steps[2]?.action).toBe('validate_transaction');
      expect(steps[3]?.action).toBe('execute_swap');
    });

    it('should decompose NFT mint task', async () => {
      const task: Task = {
        id: 'task-2',
        type: 'nft_mint',
        params: {
          metadata: { name: 'Test NFT', description: 'Test' },
          recipient: '0x123',
        },
        priority: 1,
      };

      const steps = await planner.decompose(task);

      expect(steps.length).toBe(3);
      expect(steps[0]?.action).toBe('upload_metadata');
      expect(steps[1]?.action).toBe('validate_metadata');
      expect(steps[2]?.action).toBe('mint_nft');
    });

    it('should decompose contract deployment task', async () => {
      const task: Task = {
        id: 'task-3',
        type: 'contract_deploy',
        params: {
          bytecode: '0x123',
          abi: [],
          constructorArgs: [],
        },
        priority: 1,
      };

      const steps = await planner.decompose(task);

      expect(steps.length).toBe(4);
      expect(steps[0]?.action).toBe('validate_bytecode');
      expect(steps[1]?.action).toBe('estimate_gas');
      expect(steps[2]?.action).toBe('deploy_contract');
      expect(steps[3]?.action).toBe('verify_deployment');
    });

    it('should decompose multi-chain transfer task', async () => {
      const task: Task = {
        id: 'task-4',
        type: 'multi_chain_transfer',
        params: {
          fromChain: 'ethereum',
          toChain: 'solana',
          amount: '100',
          recipient: 'addr123',
        },
        priority: 1,
      };

      const steps = await planner.decompose(task);

      expect(steps.length).toBe(3);
      expect(steps[0]?.action).toBe('detect_chains');
      expect(steps[1]?.action).toBe('validate_addresses');
      expect(steps[2]?.action).toBe('execute_transfer');
    });

    it('should handle unknown task types with default decomposition', async () => {
      const task: Task = {
        id: 'task-5',
        type: 'unknown_type',
        params: { data: 'test' },
        priority: 1,
      };

      const steps = await planner.decompose(task);

      expect(steps.length).toBe(1);
      expect(steps[0]?.action).toBe('unknown_type');
      expect(steps[0]?.agent).toBe('blockchain');
      expect(steps[0]?.dependsOn).toEqual([]);
    });
  });

  describe('Dependency Resolution', () => {
    it('should create dependencies from step dependsOn', async () => {
      const steps: Step[] = [
        {
          id: 'step-1',
          action: 'action1',
          agent: 'agent1',
          params: {},
          dependsOn: [],
          timeout: 5000,
        },
        {
          id: 'step-2',
          action: 'action2',
          agent: 'agent2',
          params: {},
          dependsOn: ['step-1'],
          timeout: 5000,
        },
        {
          id: 'step-3',
          action: 'action3',
          agent: 'agent3',
          params: {},
          dependsOn: ['step-1', 'step-2'],
          timeout: 5000,
        },
      ];

      const dependencies = await planner.resolveDependencies(steps);

      expect(dependencies.length).toBe(3);
      expect(dependencies[0]?.fromStep).toBe('step-1');
      expect(dependencies[0]?.toStep).toBe('step-2');
      expect(dependencies[1]?.fromStep).toBe('step-1');
      expect(dependencies[1]?.toStep).toBe('step-3');
      expect(dependencies[2]?.fromStep).toBe('step-2');
      expect(dependencies[2]?.toStep).toBe('step-3');
    });

    it('should detect circular dependencies', async () => {
      const steps: Step[] = [
        {
          id: 'step-1',
          action: 'action1',
          agent: 'agent1',
          params: {},
          dependsOn: ['step-3'], // Creates circle
          timeout: 5000,
        },
        {
          id: 'step-2',
          action: 'action2',
          agent: 'agent2',
          params: {},
          dependsOn: ['step-1'],
          timeout: 5000,
        },
        {
          id: 'step-3',
          action: 'action3',
          agent: 'agent3',
          params: {},
          dependsOn: ['step-2'],
          timeout: 5000,
        },
      ];

      await expect(planner.resolveDependencies(steps)).rejects.toThrow(
        'Circular dependency detected'
      );
    });

    it('should throw error for missing dependency', async () => {
      const steps: Step[] = [
        {
          id: 'step-1',
          action: 'action1',
          agent: 'agent1',
          params: {},
          dependsOn: ['nonexistent'],
          timeout: 5000,
        },
      ];

      await expect(planner.resolveDependencies(steps)).rejects.toThrow(
        'Dependency nonexistent not found'
      );
    });

    it('should handle steps with no dependencies', async () => {
      const steps: Step[] = [
        {
          id: 'step-1',
          action: 'action1',
          agent: 'agent1',
          params: {},
          dependsOn: [],
          timeout: 5000,
        },
        {
          id: 'step-2',
          action: 'action2',
          agent: 'agent2',
          params: {},
          dependsOn: [],
          timeout: 5000,
        },
      ];

      const dependencies = await planner.resolveDependencies(steps);

      expect(dependencies.length).toBe(0);
    });
  });

  describe('Topological Sort', () => {
    it('should sort steps in dependency order', () => {
      const steps: Step[] = [
        {
          id: 'step-3',
          action: 'action3',
          agent: 'agent3',
          params: {},
          dependsOn: ['step-1', 'step-2'],
          timeout: 5000,
        },
        {
          id: 'step-2',
          action: 'action2',
          agent: 'agent2',
          params: {},
          dependsOn: ['step-1'],
          timeout: 5000,
        },
        {
          id: 'step-1',
          action: 'action1',
          agent: 'agent1',
          params: {},
          dependsOn: [],
          timeout: 5000,
        },
      ];

      const sorted = planner.topologicalSort(steps);

      expect(sorted[0]?.id).toBe('step-1');
      expect(sorted[1]?.id).toBe('step-2');
      expect(sorted[2]?.id).toBe('step-3');
    });

    it('should detect circular dependencies in sort', () => {
      const steps: Step[] = [
        {
          id: 'step-1',
          action: 'action1',
          agent: 'agent1',
          params: {},
          dependsOn: ['step-2'],
          timeout: 5000,
        },
        {
          id: 'step-2',
          action: 'action2',
          agent: 'agent2',
          params: {},
          dependsOn: ['step-1'],
          timeout: 5000,
        },
      ];

      expect(() => planner.topologicalSort(steps)).toThrow('Circular dependency detected');
    });

    it('should handle parallel steps (no dependencies)', () => {
      const steps: Step[] = [
        {
          id: 'step-1',
          action: 'action1',
          agent: 'agent1',
          params: {},
          dependsOn: [],
          timeout: 5000,
        },
        {
          id: 'step-2',
          action: 'action2',
          agent: 'agent2',
          params: {},
          dependsOn: [],
          timeout: 5000,
        },
        {
          id: 'step-3',
          action: 'action3',
          agent: 'agent3',
          params: {},
          dependsOn: [],
          timeout: 5000,
        },
      ];

      const sorted = planner.topologicalSort(steps);

      expect(sorted.length).toBe(3);
      // Order doesn't matter for parallel steps
    });
  });

  describe('Execution Time Estimation', () => {
    it('should estimate execution time based on timeouts', () => {
      const steps: Step[] = [
        {
          id: 'step-1',
          action: 'action1',
          agent: 'agent1',
          params: {},
          dependsOn: [],
          timeout: 1000,
        },
        {
          id: 'step-2',
          action: 'action2',
          agent: 'agent2',
          params: {},
          dependsOn: ['step-1'],
          timeout: 2000,
        },
        {
          id: 'step-3',
          action: 'action3',
          agent: 'agent3',
          params: {},
          dependsOn: ['step-2'],
          timeout: 3000,
        },
      ];

      const estimatedTime = planner.estimateExecutionTime(steps);

      // Critical path: step-1 → step-2 → step-3
      expect(estimatedTime).toBe(6000); // 1000 + 2000 + 3000
    });

    it('should handle parallel execution paths', () => {
      const steps: Step[] = [
        {
          id: 'step-1',
          action: 'action1',
          agent: 'agent1',
          params: {},
          dependsOn: [],
          timeout: 5000,
        },
        {
          id: 'step-2',
          action: 'action2',
          agent: 'agent2',
          params: {},
          dependsOn: [],
          timeout: 3000,
        },
      ];

      const estimatedTime = planner.estimateExecutionTime(steps);

      // Parallel execution - should be sum for now (critical path logic)
      expect(estimatedTime).toBeGreaterThan(0);
    });
  });

  describe('DeFi Swap Decomposition Details', () => {
    it('should create correct dependency chain for DeFi swap', async () => {
      const task: Task = {
        id: 'swap-1',
        type: 'defi_swap',
        params: { from: 'ETH', to: 'USDC', amount: '1.0' },
        priority: 1,
      };

      const steps = await planner.decompose(task);

      // Check dependencies
      expect(steps[0]?.dependsOn).toEqual([]);
      expect(steps[1]?.dependsOn).toContain('swap-1-step-1');
      expect(steps[2]?.dependsOn).toContain('swap-1-step-2');
      expect(steps[3]?.dependsOn).toContain('swap-1-step-3');
    });

    it('should assign correct agents to DeFi swap steps', async () => {
      const task: Task = {
        id: 'swap-2',
        type: 'defi_swap',
        params: { from: 'ETH', to: 'USDC', amount: '1.0' },
        priority: 1,
      };

      const steps = await planner.decompose(task);

      expect(steps[0]?.agent).toBe('analytics');
      expect(steps[1]?.agent).toBe('defi');
      expect(steps[2]?.agent).toBe('security');
      expect(steps[3]?.agent).toBe('defi');
    });
  });
});
