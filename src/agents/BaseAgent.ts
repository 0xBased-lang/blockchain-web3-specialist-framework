/**
 * Base Agent Class
 *
 * Abstract base class for all agents in the framework.
 * Provides core functionality for:
 * - Task planning and execution
 * - Subagent delegation
 * - Inter-agent communication
 * - Result validation
 *
 * All specialized agents (DeFi, NFT, Analytics, etc.) extend this class.
 */

import {
  type Task,
  type TaskPlan,
  type Result,
  type ValidationResult,
  type SubTask,
  type Message,
  type Response,
  type AgentConfig,
} from '../types/agent.js';
import { logger } from '../utils/index.js';

/**
 * BaseAgent Abstract Class
 *
 * Must implement:
 * - plan(): Create execution plan from task
 * - execute(): Execute the plan
 * - validate(): Validate execution result
 */
export abstract class BaseAgent {
  protected readonly id: string;
  protected readonly name: string;
  protected readonly description: string;
  protected readonly capabilities: string[];
  protected readonly mcpClient: unknown;
  protected readonly subagents: Map<string, BaseAgent>;
  protected readonly maxConcurrentTasks: number;
  protected readonly timeout: number;

  constructor(config: AgentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.capabilities = config.capabilities;
    this.mcpClient = config.mcpClient;
    this.subagents = new Map();
    this.maxConcurrentTasks = config.maxConcurrentTasks ?? 10;
    this.timeout = config.timeout ?? 30000; // 30 seconds default
  }

  /**
   * Abstract Methods - Must be implemented by subclasses
   */

  /**
   * Create execution plan from task
   *
   * Analyzes task and creates detailed execution plan with steps,
   * dependencies, and fallback strategies.
   *
   * @param task - Task to plan
   * @returns Detailed execution plan
   */
  abstract plan(task: Task): Promise<TaskPlan>;

  /**
   * Execute the task plan
   *
   * Runs the steps in the plan, manages dependencies, and handles errors.
   *
   * @param plan - Execution plan to run
   * @returns Execution result
   */
  abstract execute(plan: TaskPlan): Promise<Result>;

  /**
   * Validate execution result
   *
   * Verifies that execution result meets requirements and expectations.
   *
   * @param result - Result to validate
   * @returns Validation result with errors/warnings
   */
  abstract validate(result: Result): Promise<ValidationResult>;

  /**
   * Concrete Methods - Provided by base class
   */

  /**
   * Execute a complete task (plan → execute → validate)
   *
   * @param task - Task to execute
   * @returns Validated execution result
   */
  async executeTask(task: Task): Promise<Result> {
    logger.info(`Agent ${this.name} starting task`, { taskId: task.id, type: task.type });

    try {
      // 1. Plan
      const plan = await this.plan(task);
      logger.debug(`Plan created for task ${task.id}`, {
        steps: plan.steps.length,
        estimatedTime: plan.estimatedTime,
      });

      // 2. Execute
      const result = await this.execute(plan);
      logger.debug(`Execution completed for task ${task.id}`, { success: result.success });

      // 3. Validate
      const validation = await this.validate(result);

      if (!validation.valid) {
        logger.warn(`Validation failed for task ${task.id}`, { errors: validation.errors });
        return {
          success: false,
          error: `Validation failed: ${validation.errors?.join(', ')}`,
          data: result.data,
        };
      }

      logger.info(`Task ${task.id} completed successfully`);
      return result;
    } catch (error) {
      logger.error(`Task ${task.id} failed`, { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delegate subtask to a registered subagent
   *
   * @param subtask - Subtask to delegate
   * @param subagentName - Name of subagent to delegate to
   * @returns Execution result from subagent
   */
  async delegate(subtask: SubTask, subagentName: string): Promise<Result> {
    const subagent = this.subagents.get(subagentName);

    if (!subagent) {
      const error = `Subagent ${subagentName} not found`;
      logger.error(error, {
        agent: this.name,
        availableSubagents: Array.from(this.subagents.keys()),
      });
      throw new Error(error);
    }

    logger.info(`Agent ${this.name} delegating to ${subagentName}`, { action: subtask.action });

    try {
      // Convert subtask to full task
      const task: Task = {
        id: `${this.id}-subtask-${Date.now()}`,
        type: subtask.action,
        params: subtask.params,
        priority: 1,
      };

      // Execute via subagent
      const result = await subagent.executeTask(task);

      logger.debug(`Delegation to ${subagentName} completed`, { success: result.success });
      return result;
    } catch (error) {
      logger.error(`Delegation to ${subagentName} failed`, { error });
      throw error;
    }
  }

  /**
   * Send message to another agent (for inter-agent communication)
   *
   * This is a placeholder for future message queue implementation.
   * Currently throws as message queue is not yet implemented.
   *
   * @param targetAgent - Target agent ID
   * @param message - Message to send
   * @returns Response from target agent
   */
  async communicate(_targetAgent: string, _message: Message): Promise<Response> {
    logger.warn('Inter-agent communication not yet implemented', {
      from: this.id,
      to: _targetAgent,
    });

    // Placeholder - will be implemented with MessageQueue
    throw new Error('Inter-agent communication not yet implemented');
  }

  /**
   * Register a subagent
   *
   * Allows this agent to delegate work to the registered subagent.
   *
   * @param name - Name/ID of subagent
   * @param subagent - Subagent instance
   */
  registerSubagent(name: string, subagent: BaseAgent): void {
    this.subagents.set(name, subagent);
    logger.info(`Agent ${this.name} registered subagent: ${name}`);
  }

  /**
   * Unregister a subagent
   *
   * @param name - Name/ID of subagent to remove
   */
  unregisterSubagent(name: string): void {
    const removed = this.subagents.delete(name);
    if (removed) {
      logger.info(`Agent ${this.name} unregistered subagent: ${name}`);
    }
  }

  /**
   * Get agent capabilities
   *
   * @returns List of capability names
   */
  getCapabilities(): string[] {
    return [...this.capabilities];
  }

  /**
   * Check if agent has a specific capability
   *
   * @param capability - Capability name to check
   * @returns True if agent has the capability
   */
  hasCapability(capability: string): boolean {
    return this.capabilities.includes(capability);
  }

  /**
   * Get agent metadata
   *
   * @returns Agent information
   */
  getMetadata(): {
    id: string;
    name: string;
    description: string;
    capabilities: string[];
    subagentCount: number;
  } {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      capabilities: this.getCapabilities(),
      subagentCount: this.subagents.size,
    };
  }

  /**
   * Get list of registered subagents
   *
   * @returns Array of subagent names
   */
  getSubagents(): string[] {
    return Array.from(this.subagents.keys());
  }
}
