# Base Agent Implementation

## Overview

Abstract base class for all agents in the framework.

**Prerequisites**: MCP servers (guides 02-04)

**Estimated Time**: 10-12 hours

**Complexity**: High

---

## What You'll Build

- BaseAgent abstract class
- Task planning framework
- Inter-agent communication
- Subagent management

---

## Phase 1: Base Class Structure (3 hours)

Create `src/agents/BaseAgent.ts`:

```typescript
import { MCPClient } from '../mcp/client.js';
import { Task, TaskPlan, Result, ValidationResult } from '../types/agent.js';
import { logger } from '../utils/logger.js';

export abstract class BaseAgent {
  protected id: string;
  protected name: string;
  protected description: string;
  protected capabilities: string[];
  protected mcpClient: MCPClient;
  protected subagents: Map<string, any>;

  constructor(config: AgentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.capabilities = config.capabilities;
    this.mcpClient = config.mcpClient;
    this.subagents = new Map();
  }

  // Abstract methods - must be implemented by subclasses
  abstract async plan(task: Task): Promise<TaskPlan>;
  abstract async execute(plan: TaskPlan): Promise<Result>;
  abstract async validate(result: Result): Promise<ValidationResult>;

  // Concrete methods - provided by base class
  async delegate(subtask: SubTask, subagentName: string): Promise<Result> {
    const subagent = this.subagents.get(subagentName);
    if (!subagent) {
      throw new Error(`Subagent ${subagentName} not found`);
    }

    logger.info(`Delegating task to ${subagentName}`, { subtask });
    return await subagent.execute(subtask);
  }

  async communicate(targetAgent: string, message: Message): Promise<Response> {
    // Inter-agent communication via message queue
    return await this.messageQueue.send(targetAgent, message);
  }

  registerSubagent(name: string, subagent: any) {
    this.subagents.set(name, subagent);
    logger.info(`Registered subagent: ${name}`);
  }

  getCapabilities(): string[] {
    return this.capabilities;
  }
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  mcpClient: MCPClient;
}
```

---

## Phase 2: Task Planning (3 hours)

Create `src/agents/planning.ts`:

```typescript
export interface Task {
  id: string;
  type: string;
  params: any;
  priority: number;
  deadline?: Date;
}

export interface TaskPlan {
  id: string;
  steps: Step[];
  dependencies: Dependency[];
  estimatedTime: number;
  requiredResources: Resource[];
  fallbackStrategies: FallbackStrategy[];
}

export interface Step {
  id: string;
  action: string;
  agent: string;
  params: any;
  dependsOn: string[];
  timeout: number;
}

export class TaskPlanner {
  async decompose(task: Task): Promise<Step[]> {
    // Break down complex task into steps
    const steps: Step[] = [];

    // Example: DeFi swap task
    if (task.type === 'defi_swap') {
      steps.push({
        id: 'step-1',
        action: 'get_price',
        agent: 'analytics',
        params: { token: task.params.from },
        dependsOn: [],
        timeout: 5000,
      });

      steps.push({
        id: 'step-2',
        action: 'get_quotes',
        agent: 'defi',
        params: { from: task.params.from, to: task.params.to },
        dependsOn: ['step-1'],
        timeout: 10000,
      });

      steps.push({
        id: 'step-3',
        action: 'validate_transaction',
        agent: 'security',
        params: { transaction: '${step-2.result}' },
        dependsOn: ['step-2'],
        timeout: 5000,
      });

      steps.push({
        id: 'step-4',
        action: 'execute_swap',
        agent: 'defi',
        params: { transaction: '${step-2.result}' },
        dependsOn: ['step-3'],
        timeout: 30000,
      });
    }

    return steps;
  }

  async resolveDependencies(steps: Step[]): Promise<Step[]> {
    // Topological sort based on dependencies
    const sorted: Step[] = [];
    const visited = new Set<string>();

    const visit = (step: Step) => {
      if (visited.has(step.id)) return;

      for (const depId of step.dependsOn) {
        const depStep = steps.find((s) => s.id === depId);
        if (depStep) visit(depStep);
      }

      visited.add(step.id);
      sorted.push(step);
    };

    steps.forEach(visit);
    return sorted;
  }
}
```

---

## Phase 3: Communication Protocol (2 hours)

Create `src/agents/communication.ts`:

```typescript
export interface Message {
  id: string;
  from: string;
  to: string;
  type: 'request' | 'response' | 'broadcast';
  payload: any;
  timestamp: number;
  replyTo?: string;
}

export class MessageQueue {
  private queues: Map<string, Message[]>;
  private handlers: Map<string, MessageHandler>;

  constructor() {
    this.queues = new Map();
    this.handlers = new Map();
  }

  async send(to: string, message: Message): Promise<Response> {
    // Add to recipient's queue
    const queue = this.queues.get(to) || [];
    queue.push(message);
    this.queues.set(to, queue);

    // If handler registered, process immediately
    const handler = this.handlers.get(to);
    if (handler) {
      return await handler(message);
    }

    // Otherwise, wait for response
    return await this.waitForResponse(message.id);
  }

  registerHandler(agentId: string, handler: MessageHandler) {
    this.handlers.set(agentId, handler);
  }

  private async waitForResponse(messageId: string): Promise<Response> {
    // Poll for response with timeout
    const timeout = 30000; // 30 seconds
    const start = Date.now();

    while (Date.now() - start < timeout) {
      // Check for response message
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Message ${messageId} timed out`);
  }
}

export type MessageHandler = (message: Message) => Promise<Response>;
```

---

## Phase 4: Testing (2-3 hours)

Create `src/agents/__tests__/BaseAgent.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { BaseAgent } from '../BaseAgent.js';

class TestAgent extends BaseAgent {
  async plan(task: Task): Promise<TaskPlan> {
    return {
      id: 'plan-1',
      steps: [],
      dependencies: [],
      estimatedTime: 1000,
      requiredResources: [],
      fallbackStrategies: [],
    };
  }

  async execute(plan: TaskPlan): Promise<Result> {
    return { success: true, data: {} };
  }

  async validate(result: Result): Promise<ValidationResult> {
    return { valid: true };
  }
}

describe('BaseAgent', () => {
  it('should create agent with config', () => {
    const agent = new TestAgent({
      id: 'test-1',
      name: 'TestAgent',
      description: 'Test agent',
      capabilities: ['test'],
      mcpClient: mockMCPClient,
    });

    expect(agent.name).toBe('TestAgent');
    expect(agent.getCapabilities()).toContain('test');
  });

  it('should register and delegate to subagents', async () => {
    const agent = new TestAgent(config);
    const subagent = { execute: vi.fn().mockResolvedValue({ success: true }) };

    agent.registerSubagent('test-subagent', subagent);

    const result = await agent.delegate({ action: 'test' }, 'test-subagent');

    expect(subagent.execute).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
```

---

**Document Version**: 1.0.0
**Status**: Production Ready