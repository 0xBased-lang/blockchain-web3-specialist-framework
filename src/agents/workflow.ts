/**
 * Workflow Engine
 *
 * Manages execution of task plans with:
 * - Sequential execution
 * - Parallel execution
 * - Dependency management
 * - Timeout handling
 * - Parameter resolution from previous steps
 */

import {
  type TaskPlan,
  type Step,
  type Result,
  type WorkflowMode,
  type WorkflowContext,
} from '../types/agent.js';
import { BaseAgent } from './BaseAgent.js';
import { logger } from '../utils/index.js';

/**
 * Workflow Engine
 *
 * Executes task plans with different execution modes:
 * - Sequential: Steps execute one after another
 * - Parallel: Independent steps execute simultaneously
 * - Conditional: Steps execute based on conditions
 * - Hybrid: Mix of sequential and parallel based on dependencies
 */
export class WorkflowEngine {
  constructor() {
    logger.debug('WorkflowEngine initialized');
  }

  /**
   * Execute a complete task plan
   *
   * Determines execution mode based on dependencies and executes steps.
   *
   * @param plan - Task plan to execute
   * @param agents - Map of available agents
   * @returns Aggregated execution result
   */
  async execute(plan: TaskPlan, agents: Map<string, BaseAgent>): Promise<Result> {
    logger.info(`Executing workflow plan: ${plan.id}`, {
      steps: plan.steps.length,
      estimatedTime: plan.estimatedTime,
    });

    const context: WorkflowContext = {
      mode: this.determineMode(plan),
      stepResults: new Map(),
      startTime: Date.now(),
    };

    try {
      // Execute based on determined mode
      switch (context.mode) {
        case 'sequential':
          await this.executeSequential(plan.steps, agents, context);
          break;

        case 'parallel':
          await this.executeParallel(plan.steps, agents, context);
          break;

        case 'hybrid':
          await this.executeHybrid(plan.steps, agents, context);
          break;

        default:
          // Default to sequential
          await this.executeSequential(plan.steps, agents, context);
      }

      // Aggregate results
      const aggregatedResult = this.aggregateResults(context);

      logger.info(`Workflow completed successfully`, {
        planId: plan.id,
        executedSteps: context.stepResults.size,
        duration: Date.now() - context.startTime,
      });

      return aggregatedResult;
    } catch (error) {
      logger.error(`Workflow execution failed`, { planId: plan.id, error });
      throw error;
    }
  }

  /**
   * Execute steps sequentially
   *
   * @param steps - Steps to execute
   * @param agents - Available agents
   * @param context - Execution context
   */
  async executeSequential(
    steps: Step[],
    agents: Map<string, BaseAgent>,
    context: WorkflowContext
  ): Promise<void> {
    logger.debug(`Executing ${steps.length} steps sequentially`);

    for (const step of steps) {
      const result = await this.executeStep(step, agents, context);
      context.stepResults.set(step.id, result);

      // Stop if step failed
      if (!result.success) {
        throw new Error(`Step ${step.id} failed: ${result.error}`);
      }
    }
  }

  /**
   * Execute independent steps in parallel
   *
   * @param steps - Steps to execute
   * @param agents - Available agents
   * @param context - Execution context
   */
  async executeParallel(
    steps: Step[],
    agents: Map<string, BaseAgent>,
    context: WorkflowContext
  ): Promise<void> {
    logger.debug(`Executing ${steps.length} steps in parallel`);

    // Execute all steps simultaneously
    const promises = steps.map(async (step) => {
      const result = await this.executeStep(step, agents, context);
      context.stepResults.set(step.id, result);
      return result;
    });

    const results = await Promise.all(promises);

    // Check for failures
    const failed = results.find((r) => !r.success);
    if (failed) {
      throw new Error(`Parallel execution failed: ${failed.error}`);
    }
  }

  /**
   * Execute steps with dependency-aware parallelization (hybrid mode)
   *
   * Groups steps by dependency level and executes each level in parallel.
   *
   * @param steps - Steps to execute
   * @param agents - Available agents
   * @param context - Execution context
   */
  async executeHybrid(
    steps: Step[],
    agents: Map<string, BaseAgent>,
    context: WorkflowContext
  ): Promise<void> {
    logger.debug(`Executing ${steps.length} steps in hybrid mode`);

    // Group steps by dependency level
    const levels = this.groupByDependencyLevel(steps);

    // Execute each level in parallel, levels sequentially
    for (const [level, levelSteps] of levels.entries()) {
      logger.debug(`Executing level ${level} with ${levelSteps.length} steps`);

      const promises = levelSteps.map(async (step) => {
        const result = await this.executeStep(step, agents, context);
        context.stepResults.set(step.id, result);
        return result;
      });

      const results = await Promise.all(promises);

      // Check for failures
      const failed = results.find((r) => !r.success);
      if (failed) {
        throw new Error(`Hybrid execution failed at level ${level}: ${failed.error}`);
      }
    }
  }

  /**
   * Execute a single step
   *
   * @param step - Step to execute
   * @param agents - Available agents
   * @param context - Execution context
   * @returns Step execution result
   */
  private async executeStep(
    step: Step,
    agents: Map<string, BaseAgent>,
    context: WorkflowContext
  ): Promise<Result> {
    logger.debug(`Executing step: ${step.id}`, { action: step.action, agent: step.agent });

    // Check dependencies
    const depsReady = step.dependsOn.every((depId) => context.stepResults.has(depId));
    if (!depsReady) {
      const missingDeps = step.dependsOn.filter((depId) => !context.stepResults.has(depId));
      return {
        success: false,
        error: `Dependencies not ready for step ${step.id}: ${missingDeps.join(', ')}`,
      };
    }

    // Get agent
    const agent = agents.get(step.agent);
    if (!agent) {
      return {
        success: false,
        error: `Agent ${step.agent} not found`,
      };
    }

    // Resolve parameters with dependency results
    const resolvedParams = this.resolveParams(step.params, context.stepResults);

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(async () => {
        // Create task plan for this step with resolved params
        const resolvedStep = {
          ...step,
          params: resolvedParams,
        };

        const stepPlan = {
          id: `plan-${step.id}`,
          taskId: step.id,
          steps: [resolvedStep],
          dependencies: [],
          estimatedTime: step.timeout,
          requiredResources: [],
          fallbackStrategies: [],
          createdAt: new Date(),
        };

        return await agent.execute(stepPlan);
      }, step.timeout);

      logger.debug(`Step completed: ${step.id}`, { success: result.success });
      return result;
    } catch (error) {
      logger.error(`Step failed: ${step.id}`, { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Resolve step parameters by substituting results from previous steps
   *
   * Supports syntax: ${step-id.field} or ${step-id}
   *
   * @param params - Parameters with potential references
   * @param stepResults - Previous step results
   * @returns Resolved parameters
   */
  private resolveParams(
    params: Record<string, unknown>,
    stepResults: Map<string, Result>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        // Extract reference: ${step-id.field} or ${step-id}
        const ref = value.slice(2, -1);
        const [stepId, field] = ref.split('.');

        const stepResult = stepResults.get(stepId ?? '');
        if (stepResult && field) {
          // Access specific field
          resolved[key] = (stepResult.data as Record<string, unknown>)?.[field] ?? value;
        } else if (stepResult) {
          // Use entire result data
          resolved[key] = stepResult.data;
        } else {
          // Reference not found, keep original
          resolved[key] = value;
        }
      } else {
        // Not a reference, use as-is
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * Execute function with timeout
   *
   * @param fn - Function to execute
   * @param timeout - Timeout in milliseconds
   * @returns Function result
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
      ),
    ]);
  }

  /**
   * Determine workflow execution mode based on task plan
   *
   * @param plan - Task plan
   * @returns Execution mode
   */
  private determineMode(plan: TaskPlan): WorkflowMode {
    // Check if any step has dependencies
    const hasDependencies = plan.steps.some((step) => step.dependsOn.length > 0);

    if (!hasDependencies) {
      // No dependencies = parallel execution
      return 'parallel';
    }

    // Check if can be parallelized by levels
    const levels = this.groupByDependencyLevel(plan.steps);
    if (levels.size > 1) {
      // Multiple levels = hybrid execution
      return 'hybrid';
    }

    // Default to sequential
    return 'sequential';
  }

  /**
   * Group steps by dependency level for parallel execution
   *
   * Level 0: No dependencies
   * Level 1: Depends only on level 0
   * Level N: Depends only on levels 0..N-1
   *
   * @param steps - Steps to group
   * @returns Map of level to steps
   */
  private groupByDependencyLevel(steps: Step[]): Map<number, Step[]> {
    const levels = new Map<number, Step[]>();
    const stepLevels = new Map<string, number>();

    // Calculate level for each step
    const calculateLevel = (step: Step): number => {
      // If already calculated, return it
      if (stepLevels.has(step.id)) {
        return stepLevels.get(step.id) ?? 0;
      }

      // If no dependencies, level 0
      if (step.dependsOn.length === 0) {
        stepLevels.set(step.id, 0);
        return 0;
      }

      // Level = max(dependency levels) + 1
      let maxDepLevel = -1;
      for (const depId of step.dependsOn) {
        const depStep = steps.find((s) => s.id === depId);
        if (depStep) {
          const depLevel = calculateLevel(depStep);
          maxDepLevel = Math.max(maxDepLevel, depLevel);
        }
      }

      const level = maxDepLevel + 1;
      stepLevels.set(step.id, level);
      return level;
    };

    // Group by level
    for (const step of steps) {
      const level = calculateLevel(step);

      if (!levels.has(level)) {
        levels.set(level, []);
      }

      levels.get(level)?.push(step);
    }

    return levels;
  }

  /**
   * Aggregate results from all steps
   *
   * @param context - Execution context
   * @returns Aggregated result
   */
  private aggregateResults(context: WorkflowContext): Result {
    const results: Record<string, unknown> = {};
    let hasFailure = false;
    const errors: string[] = [];

    for (const [stepId, result] of context.stepResults.entries()) {
      results[stepId] = result.data;

      if (!result.success) {
        hasFailure = true;
        if (result.error) {
          errors.push(`${stepId}: ${result.error}`);
        }
      }
    }

    const aggregated: Result = {
      success: !hasFailure,
      data: results,
      metadata: {
        executedSteps: context.stepResults.size,
        duration: Date.now() - context.startTime,
        mode: context.mode,
      },
    };

    if (errors.length > 0) {
      aggregated.errors = errors;
    }

    return aggregated;
  }
}
