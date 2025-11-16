/**
 * Specialized Agent Base Class
 *
 * Provides common utilities and patterns for specialized agents.
 * Extends BaseAgent with helpers for:
 * - Task creation from domain params
 * - Step execution management
 * - Result unwrapping
 * - Error handling
 */

import { BaseAgent } from './BaseAgent.js';
import type {
  Task,
  TaskPlan,
  Result,
  Step,
  Dependency,
} from '../types/agent.js';
import { logger } from '../utils/index.js';

/**
 * Helper class for specialized agents
 *
 * Provides utility methods for task management and execution.
 */
export abstract class SpecializedAgentBase extends BaseAgent {
  /**
   * Create a Task from domain-specific parameters
   *
   * @param type - Task type
   * @param params - Task parameters
   * @param priority - Task priority (default: 1)
   * @returns Task object
   */
  protected createTask(type: string, params: Record<string, unknown>, priority = 1): Task {
    return {
      id: `${this.id}-${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type,
      params,
      priority,
      metadata: {
        agentName: this.name,
        createdAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Execute a domain-specific task and unwrap result
   *
   * @param type - Task type
   * @param params - Task parameters
   * @returns Unwrapped result data
   * @throws Error if task fails
   */
  protected async executeDomainTask<T>(type: string, params: Record<string, unknown>): Promise<T> {
    const task = this.createTask(type, params);
    const result = await this.executeTask(task);

    if (!result.success) {
      throw new Error(result.error || `Task ${type} failed`);
    }

    return result.data as T;
  }

  /**
   * Execute a domain-specific task and return Result
   *
   * Useful when you want to handle errors yourself
   *
   * @param type - Task type
   * @param params - Task parameters
   * @returns Result object
   */
  protected async executeDomainTaskSafe<T>(
    type: string,
    params: Record<string, unknown>
  ): Promise<Result<T>> {
    const task = this.createTask(type, params);
    const result = await this.executeTask(task);

    return result as Result<T>;
  }

  /**
   * Build dependencies array from steps
   *
   * Extracts dependencies from step.dependsOn arrays
   *
   * @param steps - Array of steps
   * @returns Array of dependencies
   */
  protected buildDependencies(steps: readonly Step[]): Dependency[] {
    const dependencies: Dependency[] = [];

    for (const step of steps) {
      for (const depId of step.dependsOn) {
        dependencies.push({
          fromStep: depId,
          toStep: step.id,
          type: 'hard',
        });
      }
    }

    return dependencies;
  }

  /**
   * Topologically sort steps by dependencies
   *
   * @param steps - Steps to sort
   * @returns Sorted steps
   */
  protected topologicalSort(steps: readonly Step[]): Step[] {
    const sorted: Step[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (step: Step): void => {
      if (visited.has(step.id)) return;

      if (visiting.has(step.id)) {
        throw new Error(`Circular dependency detected involving step ${step.id}`);
      }

      visiting.add(step.id);

      // Visit dependencies first
      for (const depId of step.dependsOn) {
        const depStep = steps.find((s) => s.id === depId);
        if (depStep) {
          visit(depStep);
        }
      }

      visiting.delete(step.id);
      visited.add(step.id);
      sorted.push(step);
    };

    for (const step of steps) {
      visit(step);
    }

    return sorted;
  }

  /**
   * Execute a single step
   *
   * Subclasses override this to handle step execution
   *
   * @param step - Step to execute
   * @param previousResults - Results from previous steps
   * @returns Step execution result
   */
  protected abstract executeStep(
    step: Step,
    previousResults: Map<string, Result>
  ): Promise<Result>;

  /**
   * Execute plan steps in dependency order
   *
   * Common implementation used by all specialized agents
   *
   * @param plan - Task plan to execute
   * @returns Final result
   */
  async execute(plan: TaskPlan): Promise<Result> {
    logger.info(`${this.name} executing plan`, {
      planId: plan.id,
      steps: plan.steps.length,
    });

    const stepResults = new Map<string, Result>();

    try {
      // Sort steps by dependencies
      const sortedSteps = this.topologicalSort(plan.steps);

      // Execute steps sequentially
      for (const step of sortedSteps) {
        logger.debug(`Executing step: ${step.action}`, {
          stepId: step.id,
          agent: step.agent,
        });

        try {
          const result = await this.executeStep(step, stepResults);
          stepResults.set(step.id, result);

          if (!result.success) {
            logger.warn(`Step failed: ${step.action}`, {
              stepId: step.id,
              error: result.error,
            });

            return {
              success: false,
              error: `Step ${step.action} failed: ${result.error}`,
              metadata: {
                failedStep: step.id,
                failedAction: step.action,
              },
            };
          }

          logger.debug(`Step completed: ${step.action}`, { stepId: step.id });
        } catch (error) {
          logger.error(`Step threw error: ${step.action}`, {
            stepId: step.id,
            error,
          });

          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            metadata: {
              failedStep: step.id,
              failedAction: step.action,
            },
          };
        }
      }

      // Get result from final step
      const finalStepId = plan.steps[plan.steps.length - 1]?.id;
      const finalResult = finalStepId ? stepResults.get(finalStepId) : undefined;

      if (!finalResult) {
        return {
          success: false,
          error: 'No final result available',
        };
      }

      logger.info(`${this.name} plan execution completed`, {
        planId: plan.id,
        success: finalResult.success,
      });

      return finalResult;
    } catch (error) {
      logger.error(`Plan execution failed`, {
        planId: plan.id,
        error,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create a success Result
   *
   * @param data - Result data
   * @param metadata - Optional metadata
   * @returns Success result
   */
  protected createSuccessResult<T>(data: T, metadata?: Record<string, unknown>): Result<T> {
    return {
      success: true,
      data,
      metadata,
      timestamp: Date.now(),
    };
  }

  /**
   * Create a failure Result
   *
   * @param error - Error message
   * @param metadata - Optional metadata
   * @returns Failure result
   */
  protected createFailureResult(error: string, metadata?: Record<string, unknown>): Result {
    return {
      success: false,
      error,
      metadata,
      timestamp: Date.now(),
    };
  }

  /**
   * Get data from a previous step result
   *
   * @param stepId - Step ID
   * @param previousResults - Map of previous results
   * @returns Step result data
   * @throws Error if step result not found or failed
   */
  protected getStepData<T>(stepId: string, previousResults: Map<string, Result>): T {
    const result = previousResults.get(stepId);

    if (!result) {
      throw new Error(`Result for step ${stepId} not found`);
    }

    if (!result.success) {
      throw new Error(`Step ${stepId} failed: ${result.error}`);
    }

    if (!result.data) {
      throw new Error(`Step ${stepId} has no data`);
    }

    return result.data as T;
  }

  /**
   * Safely get data from a previous step result
   *
   * Returns undefined if step failed or has no data
   *
   * @param stepId - Step ID
   * @param previousResults - Map of previous results
   * @returns Step result data or undefined
   */
  protected getStepDataSafe<T>(stepId: string, previousResults: Map<string, Result>): T | undefined {
    const result = previousResults.get(stepId);

    if (!result?.success || !result.data) {
      return undefined;
    }

    return result.data as T;
  }

  /**
   * Create a step definition
   *
   * Helper to create properly-typed Step objects
   *
   * @param id - Step ID
   * @param action - Action name
   * @param params - Action parameters
   * @param dependsOn - Dependencies
   * @param timeout - Timeout in ms (default: 30000)
   * @returns Step object
   */
  protected createStep(
    id: string,
    action: string,
    params: Record<string, unknown>,
    dependsOn: string[] = [],
    timeout = 30000
  ): Step {
    return {
      id,
      action,
      agent: this.name,
      params,
      dependsOn,
      timeout,
    };
  }

  /**
   * Validate required parameters
   *
   * @param params - Parameters to validate
   * @param required - Required parameter names
   * @throws Error if required parameters missing
   */
  protected validateRequiredParams(
    params: Record<string, unknown>,
    required: readonly string[]
  ): void {
    const missing = required.filter((key) => !(key in params) || params[key] === undefined);

    if (missing.length > 0) {
      throw new Error(`Missing required parameters: ${missing.join(', ')}`);
    }
  }
}
