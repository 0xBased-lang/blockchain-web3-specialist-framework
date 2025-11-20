/**
 * Task Planning Infrastructure
 *
 * Provides utilities for:
 * - Task decomposition into steps
 * - Dependency resolution (topological sort)
 * - Resource allocation
 * - Execution time estimation
 */

import { type Task, type Step, type Dependency } from '../types/agent.js';
import { logger } from '../utils/index.js';

/**
 * Task Planner
 *
 * Handles task decomposition and planning logic.
 * Used by agents to create execution plans from high-level tasks.
 */
export class TaskPlanner {
  /**
   * Decompose a task into executable steps
   *
   * Breaks down complex tasks into smaller, manageable steps with
   * proper dependencies and timeouts.
   *
   * @param task - High-level task to decompose
   * @returns Array of execution steps
   */
  decompose(task: Task): Step[] {
    logger.debug(`Decomposing task`, { taskId: task.id, type: task.type });

    const steps: Step[] = [];

    // Task-specific decomposition logic
    switch (task.type) {
      case 'defi_swap':
        steps.push(...this.decomposeDefiSwap(task));
        break;

      case 'nft_mint':
        steps.push(...this.decomposeNftMint(task));
        break;

      case 'contract_deploy':
        steps.push(...this.decomposeContractDeploy(task));
        break;

      case 'multi_chain_transfer':
        steps.push(...this.decomposeMultiChainTransfer(task));
        break;

      default:
        // Default: single-step execution
        steps.push({
          id: `${task.id}-step-1`,
          action: task.type,
          agent: 'blockchain',
          params: task.params,
          dependsOn: [],
          timeout: 30000,
        });
    }

    logger.debug(`Task decomposed into ${steps.length} steps`, { taskId: task.id });
    return steps;
  }

  /**
   * Resolve dependencies between steps (topological sort)
   *
   * Orders steps so that dependencies are executed before dependent steps.
   * Detects circular dependencies.
   *
   * @param steps - Steps to sort
   * @returns Topologically sorted steps
   */
  resolveDependencies(steps: Step[]): Dependency[] {
    const dependencies: Dependency[] = [];

    // Build dependency graph
    for (const step of steps) {
      for (const depId of step.dependsOn) {
        const depStep = steps.find((s) => s.id === depId);
        if (!depStep) {
          throw new Error(`Dependency ${depId} not found for step ${step.id}`);
        }

        dependencies.push({
          fromStep: depId,
          toStep: step.id,
          type: 'hard',
        });
      }
    }

    // Check for circular dependencies
    this.detectCircularDependencies(dependencies);

    logger.debug(`Resolved ${dependencies.length} dependencies`);
    return dependencies;
  }

  /**
   * Sort steps in topological order
   *
   * @param steps - Steps to sort
   * @returns Steps sorted by dependencies
   */
  topologicalSort(steps: Step[]): Step[] {
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

    steps.forEach(visit);
    return sorted;
  }

  /**
   * Estimate total execution time for steps
   *
   * @param steps - Steps to estimate
   * @returns Estimated time in milliseconds
   */
  estimateExecutionTime(steps: Step[]): number {
    // Find critical path (longest dependency chain)
    const criticalPath = this.findCriticalPath(steps);

    const totalTime = criticalPath.reduce((sum, step) => sum + step.timeout, 0);

    logger.debug(`Estimated execution time: ${totalTime}ms`, {
      steps: steps.length,
      criticalPathLength: criticalPath.length,
    });

    return totalTime;
  }

  /**
   * Private helper methods
   */

  private decomposeDefiSwap(task: Task): Step[] {
    const { from, to, amount } = task.params as {
      from: string;
      to: string;
      amount: string;
    };

    return [
      {
        id: `${task.id}-step-1`,
        action: 'get_price',
        agent: 'analytics',
        params: { token: from },
        dependsOn: [],
        timeout: 5000,
      },
      {
        id: `${task.id}-step-2`,
        action: 'get_quotes',
        agent: 'defi',
        params: { from, to, amount },
        dependsOn: [`${task.id}-step-1`],
        timeout: 10000,
      },
      {
        id: `${task.id}-step-3`,
        action: 'validate_transaction',
        agent: 'security',
        params: { from, to, amount },
        dependsOn: [`${task.id}-step-2`],
        timeout: 5000,
      },
      {
        id: `${task.id}-step-4`,
        action: 'execute_swap',
        agent: 'defi',
        params: { from, to, amount },
        dependsOn: [`${task.id}-step-3`],
        timeout: 30000,
      },
    ];
  }

  private decomposeNftMint(task: Task): Step[] {
    const { metadata, recipient } = task.params as {
      metadata: unknown;
      recipient: string;
    };

    return [
      {
        id: `${task.id}-step-1`,
        action: 'upload_metadata',
        agent: 'nft',
        params: { metadata },
        dependsOn: [],
        timeout: 10000,
      },
      {
        id: `${task.id}-step-2`,
        action: 'validate_metadata',
        agent: 'security',
        params: { metadata },
        dependsOn: [`${task.id}-step-1`],
        timeout: 5000,
      },
      {
        id: `${task.id}-step-3`,
        action: 'mint_nft',
        agent: 'nft',
        params: { metadata, recipient },
        dependsOn: [`${task.id}-step-2`],
        timeout: 30000,
      },
    ];
  }

  private decomposeContractDeploy(task: Task): Step[] {
    const { bytecode, abi, constructorArgs } = task.params as {
      bytecode: string;
      abi: unknown;
      constructorArgs: unknown[];
    };

    return [
      {
        id: `${task.id}-step-1`,
        action: 'validate_bytecode',
        agent: 'security',
        params: { bytecode, abi },
        dependsOn: [],
        timeout: 5000,
      },
      {
        id: `${task.id}-step-2`,
        action: 'estimate_gas',
        agent: 'blockchain',
        params: { bytecode, constructorArgs },
        dependsOn: [`${task.id}-step-1`],
        timeout: 5000,
      },
      {
        id: `${task.id}-step-3`,
        action: 'deploy_contract',
        agent: 'blockchain',
        params: { bytecode, abi, constructorArgs },
        dependsOn: [`${task.id}-step-2`],
        timeout: 60000,
      },
      {
        id: `${task.id}-step-4`,
        action: 'verify_deployment',
        agent: 'blockchain',
        params: {},
        dependsOn: [`${task.id}-step-3`],
        timeout: 10000,
      },
    ];
  }

  private decomposeMultiChainTransfer(task: Task): Step[] {
    const { fromChain, toChain, amount, recipient } = task.params as {
      fromChain: string;
      toChain: string;
      amount: string;
      recipient: string;
    };

    return [
      {
        id: `${task.id}-step-1`,
        action: 'detect_chains',
        agent: 'multichain',
        params: { fromChain, toChain },
        dependsOn: [],
        timeout: 5000,
      },
      {
        id: `${task.id}-step-2`,
        action: 'validate_addresses',
        agent: 'security',
        params: { recipient, toChain },
        dependsOn: [`${task.id}-step-1`],
        timeout: 5000,
      },
      {
        id: `${task.id}-step-3`,
        action: 'execute_transfer',
        agent: 'multichain',
        params: { fromChain, toChain, amount, recipient },
        dependsOn: [`${task.id}-step-2`],
        timeout: 45000,
      },
    ];
  }

  private detectCircularDependencies(dependencies: Dependency[]): void {
    const graph = new Map<string, Set<string>>();

    // Build adjacency list
    for (const dep of dependencies) {
      if (!graph.has(dep.fromStep)) {
        graph.set(dep.fromStep, new Set());
      }
      graph.get(dep.fromStep)?.add(dep.toStep);
    }

    // DFS to detect cycles
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            if (hasCycle(neighbor)) return true;
          } else if (recursionStack.has(neighbor)) {
            return true;
          }
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (hasCycle(node)) {
          throw new Error('Circular dependency detected in task plan');
        }
      }
    }
  }

  private findCriticalPath(steps: Step[]): Step[] {
    // For now, use simple sequential ordering
    // TODO: Implement proper critical path analysis for parallel execution
    return this.topologicalSort(steps);
  }
}
