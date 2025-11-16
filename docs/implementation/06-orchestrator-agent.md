# Orchestrator Agent Implementation

## Overview

Master coordination agent that orchestrates all other agents and manages complex workflows.

**Prerequisites**: Completed guide 05 (Base Agent)

**Estimated Time**: 12-15 hours

**Complexity**: Very High

---

## What You'll Build

- Orchestrator agent class
- Workflow engine (sequential, parallel, conditional)
- Conflict resolution
- Result aggregation

---

## Phase 1: Orchestrator Class (3 hours)

Create `src/agents/OrchestratorAgent.ts`:

```typescript
import { BaseAgent } from './BaseAgent.js';
import { Task, TaskPlan, Result } from '../types/agent.js';
import { WorkflowEngine } from './workflow.js';
import { ConflictResolver } from './conflict.js';

export class OrchestratorAgent extends BaseAgent {
  private agents: Map<string, BaseAgent>;
  private workflowEngine: WorkflowEngine;
  private conflictResolver: ConflictResolver;

  constructor(config: OrchestratorConfig) {
    super(config);
    this.agents = new Map();
    this.workflowEngine = new WorkflowEngine();
    this.conflictResolver = new ConflictResolver();
  }

  registerAgent(name: string, agent: BaseAgent) {
    this.agents.set(name, agent);
    logger.info(`Registered agent: ${name}`);
  }

  async plan(task: Task): Promise<TaskPlan> {
    // 1. Analyze task complexity
    const complexity = this.analyzeComplexity(task);

    // 2. Identify required agents
    const requiredAgents = this.identifyRequiredAgents(task);

    // 3. Create execution plan
    const steps = await this.planner.decompose(task);

    // 4. Allocate resources
    const resources = await this.allocateResources(steps);

    return {
      id: `plan-${Date.now()}`,
      steps,
      dependencies: await this.planner.resolveDependencies(steps),
      estimatedTime: this.estimateTime(steps),
      requiredResources: resources,
      fallbackStrategies: this.createFallbackStrategies(task),
    };
  }

  async execute(plan: TaskPlan): Promise<Result> {
    logger.info(`Orchestrator executing plan: ${plan.id}`);

    try {
      // Execute workflow
      const result = await this.workflowEngine.execute(plan, this.agents);

      // Validate result
      const validation = await this.validate(result);

      if (!validation.valid) {
        throw new Error(`Result validation failed: ${validation.errors}`);
      }

      return result;
    } catch (error) {
      logger.error('Orchestrator execution failed', { error });

      // Try fallback strategies
      for (const strategy of plan.fallbackStrategies) {
        try {
          const fallbackResult = await this.executeFallback(strategy);
          if (fallbackResult) return fallbackResult;
        } catch (fallbackError) {
          logger.warn('Fallback strategy failed', { strategy, fallbackError });
        }
      }

      throw error;
    }
  }

  async validate(result: Result): Promise<ValidationResult> {
    // Validate orchestration result
    return {
      valid: result.success === true,
      errors: result.errors || [],
    };
  }

  private analyzeComplexity(task: Task): 'low' | 'medium' | 'high' {
    // Analyze task complexity based on type, params, etc.
    if (task.type.includes('multi')) return 'high';
    if (task.params && Object.keys(task.params).length > 5) return 'medium';
    return 'low';
  }

  private identifyRequiredAgents(task: Task): string[] {
    // Map task type to required agents
    const agentMap: Record<string, string[]> = {
      defi_swap: ['analytics', 'defi', 'security'],
      nft_mint: ['nft', 'security'],
      contract_deploy: ['blockchain', 'security'],
    };

    return agentMap[task.type] || ['blockchain'];
  }
}
```

---

## Phase 2: Workflow Engine (4 hours)

Create `src/agents/workflow.ts`:

```typescript
export class WorkflowEngine {
  async execute(
    plan: TaskPlan,
    agents: Map<string, BaseAgent>
  ): Promise<Result> {
    const results = new Map<string, Result>();

    for (const step of plan.steps) {
      // Check if dependencies are met
      const depsReady = step.dependsOn.every((depId) => results.has(depId));
      if (!depsReady) {
        throw new Error(`Dependencies not ready for step ${step.id}`);
      }

      // Get agent
      const agent = agents.get(step.agent);
      if (!agent) {
        throw new Error(`Agent ${step.agent} not found`);
      }

      // Resolve parameters with dependency results
      const resolvedParams = this.resolveParams(step.params, results);

      // Execute step
      try {
        const result = await this.executeWithTimeout(
          async () => agent.execute({ action: step.action, params: resolvedParams }),
          step.timeout
        );

        results.set(step.id, result);
      } catch (error) {
        throw new Error(`Step ${step.id} failed: ${error}`);
      }
    }

    return {
      success: true,
      data: Object.fromEntries(results),
    };
  }

  async executeSequential(steps: Step[], agents: Map<string, BaseAgent>): Promise<Result[]> {
    const results: Result[] = [];

    for (const step of steps) {
      const agent = agents.get(step.agent);
      if (!agent) continue;

      const result = await agent.execute(step);
      results.push(result);
    }

    return results;
  }

  async executeParallel(steps: Step[], agents: Map<string, BaseAgent>): Promise<Result[]> {
    const promises = steps.map(async (step) => {
      const agent = agents.get(step.agent);
      if (!agent) throw new Error(`Agent ${step.agent} not found`);
      return await agent.execute(step);
    });

    return await Promise.all(promises);
  }

  private resolveParams(params: Record<string, unknown>, results: Map<string, Result>): Record<string, unknown> {
    // Replace ${step-id.result} with actual results
    const resolved = { ...params };

    for (const [key, value] of Object.entries(resolved)) {
      if (typeof value === 'string' && value.startsWith('${')) {
        const [stepId, path] = value.slice(2, -1).split('.');
        resolved[key] = results.get(stepId)?.[path];
      }
    }

    return resolved;
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeout)
      ),
    ]);
  }
}
```

---

## Phase 3: Conflict Resolution (3 hours)

Create `src/agents/conflict.ts`:

```typescript
export class ConflictResolver {
  resolve(proposals: Proposal[]): Proposal {
    // 1. Filter invalid proposals
    const valid = proposals.filter((p) => this.isValid(p));

    if (valid.length === 0) {
      throw new Error('No valid proposals');
    }

    if (valid.length === 1) {
      return valid[0];
    }

    // 2. Rank proposals by priority rules
    const ranked = this.rankProposals(valid);

    // 3. Return best proposal
    return ranked[0];
  }

  private isValid(proposal: Proposal): boolean {
    // Validate proposal meets basic requirements
    return (
      proposal.action !== undefined &&
      proposal.params !== undefined &&
      proposal.confidence > 0.5
    );
  }

  private rankProposals(proposals: Proposal[]): Proposal[] {
    return proposals.sort((a, b) => {
      // Rank by:
      // 1. Confidence
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }

      // 2. Cost (lower is better)
      if (a.estimatedCost !== b.estimatedCost) {
        return a.estimatedCost - b.estimatedCost;
      }

      // 3. Time (faster is better)
      return a.estimatedTime - b.estimatedTime;
    });
  }
}

export interface Proposal {
  agent: string;
  action: string;
  params: Record<string, unknown>;
  confidence: number;
  estimatedCost: number;
  estimatedTime: number;
  rationale: string;
}
```

---

## Phase 4: Testing (3-4 hours)

Create `src/agents/__tests__/Orchestrator.test.ts`:

```typescript
describe('OrchestratorAgent', () => {
  it('should coordinate multiple agents', async () => {
    const orchestrator = new OrchestratorAgent(config);

    // Register agents
    orchestrator.registerAgent('analytics', analyticsAgent);
    orchestrator.registerAgent('defi', defiAgent);
    orchestrator.registerAgent('security', securityAgent);

    // Execute complex task
    const result = await orchestrator.executeTask({
      type: 'defi_swap',
      params: { from: 'ETH', to: 'USDC', amount: '1' },
    });

    expect(result.success).toBe(true);
    expect(result.data.transactionHash).toBeDefined();
  });

  it('should resolve conflicts between agents', async () => {
    const proposals = [
      { agent: 'defi', action: 'swap_uniswap', confidence: 0.8, estimatedCost: 50 },
      { agent: 'defi', action: 'swap_sushiswap', confidence: 0.9, estimatedCost: 45 },
    ];

    const best = conflictResolver.resolve(proposals);

    expect(best.action).toBe('swap_sushiswap'); // Higher confidence + lower cost
  });
});
```

---

**Document Version**: 1.0.0
**Status**: Production Ready