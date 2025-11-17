import { describe, it, expect, beforeEach } from 'vitest';
import { SpecializedAgentBase } from '../../../src/agents/SpecializedAgentBase.js';
import {
  type Task,
  type TaskPlan,
  type Result,
  type ValidationResult,
  type AgentConfig,
  type Step,
} from '../../../src/types/agent.js';

/**
 * Concrete test implementation of SpecializedAgentBase
 */
class TestSpecializedAgent extends SpecializedAgentBase {
  public stepExecutor?: (step: Step, previousResults: Map<string, Result>) => Promise<Result>;

  async plan(task: Task): Promise<TaskPlan> {
    return {
      id: `plan-${task.id}`,
      taskId: task.id,
      steps: [
        this.createStep('step-1', 'action_1', task.params, [], 5000),
        this.createStep('step-2', 'action_2', { derived: true }, ['step-1'], 5000),
      ],
      dependencies: [],
      estimatedTime: 10000,
      requiredResources: [],
      fallbackStrategies: [],
      createdAt: new Date(),
    };
  }

  async executeStep(step: Step, previousResults: Map<string, Result>): Promise<Result> {
    // Use custom executor if provided (for testing different scenarios)
    if (this.stepExecutor) {
      return this.stepExecutor(step, previousResults);
    }

    // Default: return success with step info
    return this.createSuccessResult({
      stepId: step.id,
      action: step.action,
      previousData: Array.from(previousResults.keys()),
    });
  }

  async validate(result: Result): Promise<ValidationResult> {
    return {
      valid: result.success === true,
      errors: result.success ? [] : ['Execution failed'],
    };
  }

  // Expose protected methods for testing
  public testCreateTask(type: string, params: Record<string, unknown>, priority?: number): Task {
    return this.createTask(type, params, priority);
  }

  public testExecuteDomainTask<T>(type: string, params: Record<string, unknown>): Promise<T> {
    return this.executeDomainTask<T>(type, params);
  }

  public testExecuteDomainTaskSafe<T>(
    type: string,
    params: Record<string, unknown>
  ): Promise<Result<T>> {
    return this.executeDomainTaskSafe<T>(type, params);
  }

  public testBuildDependencies(steps: readonly Step[]) {
    return this.buildDependencies(steps);
  }

  public testTopologicalSort(steps: readonly Step[]): Step[] {
    return this.topologicalSort(steps);
  }

  public testCreateSuccessResult<T>(data: T, metadata?: Record<string, unknown>): Result<T> {
    return this.createSuccessResult(data, metadata);
  }

  public testCreateFailureResult(error: string, metadata?: Record<string, unknown>): Result {
    return this.createFailureResult(error, metadata);
  }

  public testGetStepData<T>(stepId: string, previousResults: Map<string, Result>): T {
    return this.getStepData<T>(stepId, previousResults);
  }

  public testGetStepDataSafe<T>(
    stepId: string,
    previousResults: Map<string, Result>
  ): T | undefined {
    return this.getStepDataSafe<T>(stepId, previousResults);
  }

  public testCreateStep(
    id: string,
    action: string,
    params: Record<string, unknown>,
    dependsOn?: string[],
    timeout?: number
  ): Step {
    return this.createStep(id, action, params, dependsOn, timeout);
  }

  public testValidateRequiredParams(
    params: Record<string, unknown>,
    required: readonly string[]
  ): void {
    return this.validateRequiredParams(params, required);
  }
}

describe('SpecializedAgentBase', () => {
  let agent: TestSpecializedAgent;
  let config: AgentConfig;

  beforeEach(() => {
    config = {
      id: 'test-specialized-agent-1',
      name: 'TestSpecializedAgent',
      description: 'Agent for testing specialized base',
      capabilities: ['test', 'specialized'],
      mcpClient: {},
      maxConcurrentTasks: 3,
      timeout: 15000,
    };

    agent = new TestSpecializedAgent(config);
  });

  describe('Initialization', () => {
    it('should create agent with config', () => {
      expect(agent).toBeDefined();
      expect(agent.getMetadata().name).toBe('TestSpecializedAgent');
      expect(agent.getMetadata().id).toBe('test-specialized-agent-1');
    });
  });

  describe('createTask', () => {
    it('should create task with correct structure', () => {
      const task = agent.testCreateTask('test_task', { foo: 'bar' }, 5);

      expect(task.type).toBe('test_task');
      expect(task.params).toEqual({ foo: 'bar' });
      expect(task.priority).toBe(5);
      expect(task.id).toContain('test-specialized-agent-1-test_task');
      expect(task.metadata?.['agentName']).toBe('TestSpecializedAgent');
    });

    it('should use default priority of 1', () => {
      const task = agent.testCreateTask('test_task', {});
      expect(task.priority).toBe(1);
    });

    it('should create unique task IDs', () => {
      const task1 = agent.testCreateTask('test', {});
      const task2 = agent.testCreateTask('test', {});

      expect(task1.id).not.toBe(task2.id);
    });
  });

  describe('executeDomainTask', () => {
    it('should execute task and unwrap successful result', async () => {
      const result = await agent.testExecuteDomainTask<{ stepId: string }>('test_action', {
        param: 'value',
      });

      expect(result).toBeDefined();
      expect(result.stepId).toBeDefined();
    });

    it('should throw error on task failure', async () => {
      // Make executeStep return failure
      agent.stepExecutor = async () => ({
        success: false,
        error: 'Task execution failed',
        timestamp: Date.now(),
      });

      await expect(agent.testExecuteDomainTask('failing_task', {})).rejects.toThrow(
        'Validation failed'
      );
    });

    it('should return undefined when result has no data', async () => {
      agent.stepExecutor = async () => ({
        success: true,
        data: undefined,
        timestamp: Date.now(),
      });

      const result = await agent.testExecuteDomainTask('no_data_task', {});
      expect(result).toBeUndefined();
    });
  });

  describe('executeDomainTaskSafe', () => {
    it('should return Result object on success', async () => {
      const result = await agent.testExecuteDomainTaskSafe<{ stepId: string }>('test_action', {});

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return failure Result without throwing', async () => {
      agent.stepExecutor = async () => ({
        success: false,
        error: 'Controlled failure',
        timestamp: Date.now(),
      });

      const result = await agent.testExecuteDomainTaskSafe('failing_task', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });
  });

  describe('buildDependencies', () => {
    it('should extract dependencies from steps', () => {
      const steps: Step[] = [
        agent.testCreateStep('step-1', 'action-1', {}, []),
        agent.testCreateStep('step-2', 'action-2', {}, ['step-1']),
        agent.testCreateStep('step-3', 'action-3', {}, ['step-1', 'step-2']),
      ];

      const deps = agent.testBuildDependencies(steps);

      expect(deps).toHaveLength(3);
      expect(deps).toContainEqual({ fromStep: 'step-1', toStep: 'step-2', type: 'hard' });
      expect(deps).toContainEqual({ fromStep: 'step-1', toStep: 'step-3', type: 'hard' });
      expect(deps).toContainEqual({ fromStep: 'step-2', toStep: 'step-3', type: 'hard' });
    });

    it('should return empty array for steps with no dependencies', () => {
      const steps: Step[] = [
        agent.testCreateStep('step-1', 'action-1', {}, []),
        agent.testCreateStep('step-2', 'action-2', {}, []),
      ];

      const deps = agent.testBuildDependencies(steps);
      expect(deps).toHaveLength(0);
    });
  });

  describe('topologicalSort', () => {
    it('should sort steps by dependencies', () => {
      const steps: Step[] = [
        agent.testCreateStep('step-3', 'action-3', {}, ['step-1', 'step-2']),
        agent.testCreateStep('step-2', 'action-2', {}, ['step-1']),
        agent.testCreateStep('step-1', 'action-1', {}, []),
      ];

      const sorted = agent.testTopologicalSort(steps);

      const step1Idx = sorted.findIndex((s) => s.id === 'step-1');
      const step2Idx = sorted.findIndex((s) => s.id === 'step-2');
      const step3Idx = sorted.findIndex((s) => s.id === 'step-3');

      expect(step1Idx).toBeLessThan(step2Idx);
      expect(step2Idx).toBeLessThan(step3Idx);
    });

    it('should handle independent steps in any order', () => {
      const steps: Step[] = [
        agent.testCreateStep('step-1', 'action-1', {}, []),
        agent.testCreateStep('step-2', 'action-2', {}, []),
        agent.testCreateStep('step-3', 'action-3', {}, []),
      ];

      const sorted = agent.testTopologicalSort(steps);
      expect(sorted).toHaveLength(3);
    });

    it('should detect circular dependencies', () => {
      const steps: Step[] = [
        agent.testCreateStep('step-1', 'action-1', {}, ['step-2']),
        agent.testCreateStep('step-2', 'action-2', {}, ['step-1']),
      ];

      expect(() => agent.testTopologicalSort(steps)).toThrow('Circular dependency detected');
    });

    it('should handle complex dependency graph', () => {
      const steps: Step[] = [
        agent.testCreateStep('step-4', 'action-4', {}, ['step-2', 'step-3']),
        agent.testCreateStep('step-2', 'action-2', {}, ['step-1']),
        agent.testCreateStep('step-3', 'action-3', {}, ['step-1']),
        agent.testCreateStep('step-1', 'action-1', {}, []),
      ];

      const sorted = agent.testTopologicalSort(steps);

      expect(sorted[0]?.id).toBe('step-1');
      expect(sorted[3]?.id).toBe('step-4');
    });
  });

  describe('execute', () => {
    it('should execute all steps in order', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'test_workflow',
        params: { foo: 'bar' },
        priority: 1,
      };

      const plan = await agent.plan(task);
      const result = await agent.execute(plan);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should stop execution on step failure', async () => {
      let stepCount = 0;

      agent.stepExecutor = async (step) => {
        stepCount++;

        if (step.id === 'step-2') {
          return {
            success: false,
            error: 'Step 2 failed',
            timestamp: Date.now(),
          };
        }

        return {
          success: true,
          data: { stepId: step.id },
          timestamp: Date.now(),
        };
      };

      const task: Task = {
        id: 'task-1',
        type: 'failing_workflow',
        params: {},
        priority: 1,
      };

      const plan = await agent.plan(task);
      const result = await agent.execute(plan);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Step action_2 failed');
      expect(result.metadata?.['failedStep']).toBe('step-2');
    });

    it('should handle step exceptions', async () => {
      agent.stepExecutor = async (step) => {
        if (step.id === 'step-1') {
          throw new Error('Step threw exception');
        }
        return { success: true, data: {}, timestamp: Date.now() };
      };

      const task: Task = { id: 'task-1', type: 'exception_workflow', params: {}, priority: 1 };
      const plan = await agent.plan(task);
      const result = await agent.execute(plan);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Step threw exception');
    });

    it('should pass results between steps', async () => {
      const executedSteps: string[] = [];

      agent.stepExecutor = async (step, previousResults) => {
        executedSteps.push(step.id);

        return {
          success: true,
          data: {
            stepId: step.id,
            previousCount: previousResults.size,
          },
          timestamp: Date.now(),
        };
      };

      const task: Task = { id: 'task-1', type: 'multi_step', params: {}, priority: 1 };
      const plan = await agent.plan(task);
      await agent.execute(plan);

      expect(executedSteps).toEqual(['step-1', 'step-2']);
    });
  });

  describe('createSuccessResult', () => {
    it('should create success result with data', () => {
      const result = agent.testCreateSuccessResult({ foo: 'bar' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ foo: 'bar' });
      expect(result.timestamp).toBeDefined();
    });

    it('should include metadata when provided', () => {
      const result = agent.testCreateSuccessResult({ data: 'value' }, { source: 'test' });

      expect(result.metadata).toEqual({ source: 'test' });
    });

    it('should not have metadata when not provided', () => {
      const result = agent.testCreateSuccessResult({ data: 'value' });

      expect(result.metadata).toBeUndefined();
    });
  });

  describe('createFailureResult', () => {
    it('should create failure result with error', () => {
      const result = agent.testCreateFailureResult('Something went wrong');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
      expect(result.timestamp).toBeDefined();
    });

    it('should include metadata when provided', () => {
      const result = agent.testCreateFailureResult('Error occurred', { errorCode: 500 });

      expect(result.metadata).toEqual({ errorCode: 500 });
    });
  });

  describe('getStepData', () => {
    it('should retrieve data from successful step', () => {
      const previousResults = new Map<string, Result>();
      previousResults.set('step-1', {
        success: true,
        data: { value: 42 },
        timestamp: Date.now(),
      });

      const data = agent.testGetStepData<{ value: number }>('step-1', previousResults);

      expect(data).toEqual({ value: 42 });
    });

    it('should throw error if step not found', () => {
      const previousResults = new Map<string, Result>();

      expect(() => agent.testGetStepData('nonexistent', previousResults)).toThrow(
        'Result for step nonexistent not found'
      );
    });

    it('should throw error if step failed', () => {
      const previousResults = new Map<string, Result>();
      previousResults.set('failed-step', {
        success: false,
        error: 'Step failed',
        timestamp: Date.now(),
      });

      expect(() => agent.testGetStepData('failed-step', previousResults)).toThrow(
        'Step failed-step failed'
      );
    });

    it('should throw error if step has no data', () => {
      const previousResults = new Map<string, Result>();
      previousResults.set('no-data-step', {
        success: true,
        timestamp: Date.now(),
      });

      expect(() => agent.testGetStepData('no-data-step', previousResults)).toThrow(
        'Step no-data-step has no data'
      );
    });
  });

  describe('getStepDataSafe', () => {
    it('should retrieve data from successful step', () => {
      const previousResults = new Map<string, Result>();
      previousResults.set('step-1', {
        success: true,
        data: { value: 42 },
        timestamp: Date.now(),
      });

      const data = agent.testGetStepDataSafe<{ value: number }>('step-1', previousResults);

      expect(data).toEqual({ value: 42 });
    });

    it('should return undefined for nonexistent step', () => {
      const previousResults = new Map<string, Result>();

      const data = agent.testGetStepDataSafe('nonexistent', previousResults);

      expect(data).toBeUndefined();
    });

    it('should return undefined for failed step', () => {
      const previousResults = new Map<string, Result>();
      previousResults.set('failed-step', {
        success: false,
        error: 'Failed',
        timestamp: Date.now(),
      });

      const data = agent.testGetStepDataSafe('failed-step', previousResults);

      expect(data).toBeUndefined();
    });

    it('should return undefined for step with no data', () => {
      const previousResults = new Map<string, Result>();
      previousResults.set('no-data', {
        success: true,
        timestamp: Date.now(),
      });

      const data = agent.testGetStepDataSafe('no-data', previousResults);

      expect(data).toBeUndefined();
    });
  });

  describe('createStep', () => {
    it('should create step with required fields', () => {
      const step = agent.testCreateStep('step-1', 'my_action', { foo: 'bar' });

      expect(step.id).toBe('step-1');
      expect(step.action).toBe('my_action');
      expect(step.agent).toBe('TestSpecializedAgent');
      expect(step.params).toEqual({ foo: 'bar' });
      expect(step.dependsOn).toEqual([]);
      expect(step.timeout).toBe(30000);
    });

    it('should set dependencies when provided', () => {
      const step = agent.testCreateStep('step-2', 'action', {}, ['step-1']);

      expect(step.dependsOn).toEqual(['step-1']);
    });

    it('should use custom timeout when provided', () => {
      const step = agent.testCreateStep('step-1', 'action', {}, [], 5000);

      expect(step.timeout).toBe(5000);
    });
  });

  describe('validateRequiredParams', () => {
    it('should pass validation when all required params present', () => {
      const params = { foo: 'bar', baz: 123 };

      expect(() => agent.testValidateRequiredParams(params, ['foo', 'baz'])).not.toThrow();
    });

    it('should throw error when required param missing', () => {
      const params = { foo: 'bar' };

      expect(() => agent.testValidateRequiredParams(params, ['foo', 'baz'])).toThrow(
        'Missing required parameters: baz'
      );
    });

    it('should throw error when param is undefined', () => {
      const params = { foo: 'bar', baz: undefined };

      expect(() => agent.testValidateRequiredParams(params, ['foo', 'baz'])).toThrow(
        'Missing required parameters: baz'
      );
    });

    it('should list all missing params', () => {
      const params = { foo: 'bar' };

      expect(() =>
        agent.testValidateRequiredParams(params, ['foo', 'baz', 'qux'])
      ).toThrow('Missing required parameters: baz, qux');
    });

    it('should accept zero values as valid', () => {
      const params = { count: 0, flag: false };

      expect(() =>
        agent.testValidateRequiredParams(params, ['count', 'flag'])
      ).not.toThrow();
    });
  });
});
