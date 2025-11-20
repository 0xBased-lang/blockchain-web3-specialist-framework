/**
 * Orchestrator Agent
 *
 * Master coordination agent that:
 * - Manages all other agents
 * - Coordinates complex multi-agent workflows
 * - Resolves conflicts between agents
 * - Aggregates results
 * - Handles fallback strategies
 */

import { BaseAgent } from './BaseAgent.js';
import { TaskPlanner } from './planning.js';
import { WorkflowEngine } from './workflow.js';
import { ConflictResolver } from './conflict.js';
import {
  type Task,
  type TaskPlan,
  type Result,
  type ValidationResult,
  type OrchestratorConfig,
  type Proposal,
  type FallbackStrategy,
  type Resource,
} from '../types/agent.js';
import { logger } from '../utils/index.js';

/**
 * Orchestrator Agent
 *
 * The orchestrator is the top-level agent that coordinates all other agents.
 * It handles complex tasks by:
 * 1. Analyzing task complexity
 * 2. Identifying required agents
 * 3. Creating execution plan
 * 4. Coordinating workflow execution
 * 5. Resolving conflicts
 * 6. Aggregating results
 * 7. Managing fallback strategies
 */
export class OrchestratorAgent extends BaseAgent {
  private readonly agents: Map<string, BaseAgent>;
  private readonly planner: TaskPlanner;
  private readonly workflowEngine: WorkflowEngine;
  private readonly conflictResolver: ConflictResolver;
  private readonly maxAgents: number;
  private readonly coordinationStrategy: 'sequential' | 'parallel' | 'adaptive';

  constructor(config: OrchestratorConfig) {
    super(config);
    this.agents = new Map();
    this.planner = new TaskPlanner();
    this.workflowEngine = new WorkflowEngine();
    this.conflictResolver = new ConflictResolver();
    this.maxAgents = config.maxAgents ?? 50;
    this.coordinationStrategy = config.coordinationStrategy ?? 'adaptive';

    logger.info('OrchestratorAgent initialized', {
      id: this.id,
      maxAgents: this.maxAgents,
      strategy: this.coordinationStrategy,
    });
  }

  /**
   * Register an agent with the orchestrator
   *
   * @param name - Agent name/ID
   * @param agent - Agent instance
   */
  registerAgent(name: string, agent: BaseAgent): void {
    if (this.agents.size >= this.maxAgents) {
      throw new Error(`Maximum number of agents (${this.maxAgents}) reached`);
    }

    this.agents.set(name, agent);
    logger.info(`Orchestrator registered agent: ${name}`, {
      totalAgents: this.agents.size,
    });
  }

  /**
   * Unregister an agent
   *
   * @param name - Agent name/ID
   */
  unregisterAgent(name: string): void {
    const removed = this.agents.delete(name);
    if (removed) {
      logger.info(`Orchestrator unregistered agent: ${name}`);
    }
  }

  /**
   * Get list of registered agents
   *
   * @returns Array of agent names
   */
  getAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Plan task execution
   *
   * Analyzes task and creates comprehensive execution plan.
   *
   * @param task - Task to plan
   * @returns Execution plan
   */
  async plan(task: Task): Promise<TaskPlan> {
    logger.info(`Orchestrator planning task: ${task.id}`, { type: task.type });

    // 1. Analyze complexity
    const complexity = this.analyzeComplexity(task);
    logger.debug(`Task complexity: ${complexity}`);

    // 2. Identify required agents
    const requiredAgents = this.identifyRequiredAgents(task);
    logger.debug(`Required agents: ${requiredAgents.join(', ')}`);

    // Verify agents are available
    for (const agentName of requiredAgents) {
      if (!this.agents.has(agentName)) {
        logger.warn(`Required agent not available: ${agentName}`);
      }
    }

    // 3. Decompose task into steps
    const steps = await this.planner.decompose(task);

    // 4. Resolve dependencies
    const dependencies = await this.planner.resolveDependencies(steps);

    // 5. Allocate resources
    const resources = this.allocateResources(steps);

    // 6. Create fallback strategies
    const fallbackStrategies = this.createFallbackStrategies(task, complexity);

    // 7. Estimate time
    const estimatedTime = this.planner.estimateExecutionTime(steps);

    const plan: TaskPlan = {
      id: `plan-${task.id}-${Date.now()}`,
      taskId: task.id,
      steps,
      dependencies,
      estimatedTime,
      requiredResources: resources,
      fallbackStrategies,
      createdAt: new Date(),
    };

    logger.info(`Task plan created`, {
      planId: plan.id,
      steps: steps.length,
      estimatedTime,
    });

    return plan;
  }

  /**
   * Execute task plan
   *
   * Coordinates workflow execution across multiple agents.
   *
   * @param plan - Execution plan
   * @returns Execution result
   */
  async execute(plan: TaskPlan): Promise<Result> {
    logger.info(`Orchestrator executing plan: ${plan.id}`);

    try {
      // Execute workflow using available agents
      const result = await this.workflowEngine.execute(plan, this.agents);

      logger.info(`Plan execution completed`, {
        planId: plan.id,
        success: result.success,
      });

      return result;
    } catch (error) {
      logger.error('Plan execution failed', { planId: plan.id, error });

      // Try fallback strategies
      for (const strategy of plan.fallbackStrategies) {
        logger.info(`Attempting fallback strategy: ${strategy.id}`);

        try {
          const fallbackResult = await this.executeFallback(strategy);

          if (fallbackResult.success) {
            logger.info(`Fallback strategy succeeded: ${strategy.id}`);
            return fallbackResult;
          }
        } catch (fallbackError) {
          logger.warn(`Fallback strategy failed: ${strategy.id}`, { error: fallbackError });
        }
      }

      // All fallbacks failed
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Validate execution result
   *
   * @param result - Result to validate
   * @returns Validation result
   */
  validate(result: Result): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check basic success
    if (!result.success) {
      errors.push('Execution marked as failed');
    }

    // Check for errors in result
    if (result.errors && result.errors.length > 0) {
      errors.push(...result.errors);
    }

    // Check result data
    if (result.success && !result.data) {
      warnings.push('Successful result has no data');
    }

    const valid = errors.length === 0;

    logger.debug('Validation completed', { valid, errorCount: errors.length });

    const validationResult: ValidationResult = {
      valid,
    };

    if (errors.length > 0) {
      validationResult.errors = errors;
    }

    if (warnings.length > 0) {
      validationResult.warnings = warnings;
    }

    return Promise.resolve(validationResult);
  }

  /**
   * Resolve conflicts between agent proposals
   *
   * @param proposals - Proposals from multiple agents
   * @returns Best proposal
   */
  resolveConflict(proposals: Proposal[]): Proposal {
    logger.info(`Resolving conflict between ${proposals.length} proposals`);
    return this.conflictResolver.resolve(proposals);
  }

  /**
   * Private helper methods
   */

  private analyzeComplexity(task: Task): 'low' | 'medium' | 'high' {
    // Analyze based on type
    if (task.type.includes('multi') || task.type.includes('complex')) {
      return 'high';
    }

    // Analyze based on parameter count
    const paramCount = Object.keys(task.params).length;
    if (paramCount > 10) {
      return 'high';
    } else if (paramCount > 5) {
      return 'medium';
    }

    return 'low';
  }

  private identifyRequiredAgents(task: Task): string[] {
    // Map task types to required agents
    const agentMap: Record<string, string[]> = {
      defi_swap: ['analytics', 'defi', 'security'],
      nft_mint: ['nft', 'security'],
      nft_transfer: ['nft'],
      contract_deploy: ['blockchain', 'security'],
      multi_chain_transfer: ['multichain', 'security'],
      token_transfer: ['blockchain'],
    };

    return agentMap[task.type] || ['blockchain'];
  }

  private allocateResources(_steps: unknown[]): Resource[] {
    // Determine required resources based on steps
    const resources: Resource[] = [];

    // All blockchain operations need RPC
    resources.push({
      type: 'rpc',
      name: 'blockchain-rpc',
      required: true,
    });

    // Add wallet if needed (check if any step involves signing)
    resources.push({
      type: 'wallet',
      name: 'signer',
      required: false,
    });

    return resources;
  }

  private createFallbackStrategies(
    task: Task,
    complexity: 'low' | 'medium' | 'high'
  ): FallbackStrategy[] {
    const strategies: FallbackStrategy[] = [];

    // For high complexity tasks, add retry strategy
    if (complexity === 'high') {
      strategies.push({
        id: `fallback-retry-${task.id}`,
        condition: 'execution_failed',
        steps: [],
        priority: 1,
      });
    }

    // For medium/high complexity, add alternative agent strategy
    if (complexity !== 'low') {
      strategies.push({
        id: `fallback-alternative-${task.id}`,
        condition: 'agent_unavailable',
        steps: [],
        priority: 2,
      });
    }

    return strategies;
  }

  private async executeFallback(strategy: FallbackStrategy): Promise<Result> {
    logger.debug(`Executing fallback strategy: ${strategy.id}`);

    // Execute fallback steps
    if (strategy.steps.length === 0) {
      return {
        success: false,
        error: 'Fallback strategy has no steps',
      };
    }

    const plan: TaskPlan = {
      id: `fallback-plan-${strategy.id}`,
      taskId: strategy.id,
      steps: strategy.steps,
      dependencies: [],
      estimatedTime: strategy.steps.reduce((sum, step) => sum + step.timeout, 0),
      requiredResources: [],
      fallbackStrategies: [],
      createdAt: new Date(),
    };

    return await this.workflowEngine.execute(plan, this.agents);
  }

  /**
   * Get orchestrator statistics
   *
   * @returns Statistics
   */
  getStats(): {
    registeredAgents: number;
    capabilities: string[];
    subagents: number;
    strategy: string;
  } {
    return {
      registeredAgents: this.agents.size,
      capabilities: this.getCapabilities(),
      subagents: this.subagents.size,
      strategy: this.coordinationStrategy,
    };
  }
}
