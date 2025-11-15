/**
 * Agent System Type Definitions
 *
 * Core types for the multi-agent framework:
 * - Task planning and execution
 * - Inter-agent communication
 * - Result validation
 * - Workflow orchestration
 */

/**
 * Task represents work to be performed by an agent
 */
export interface Task {
  id: string;
  type: string;
  params: Record<string, unknown>;
  priority: number;
  deadline?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * SubTask for delegation to subagents
 */
export interface SubTask {
  action: string;
  params: Record<string, unknown>;
  timeout?: number;
}

/**
 * Step in a task execution plan
 */
export interface Step {
  id: string;
  action: string;
  agent: string;
  params: Record<string, unknown>;
  dependsOn: string[];
  timeout: number;
  retryCount?: number;
  fallback?: Step;
}

/**
 * Dependency between steps
 */
export interface Dependency {
  fromStep: string;
  toStep: string;
  type: 'hard' | 'soft';
}

/**
 * Resource required for task execution
 */
export interface Resource {
  type: 'rpc' | 'api' | 'wallet' | 'memory';
  name: string;
  required: boolean;
  config?: Record<string, unknown>;
}

/**
 * Fallback strategy when primary execution fails
 */
export interface FallbackStrategy {
  id: string;
  condition: string;
  steps: Step[];
  priority: number;
}

/**
 * Complete task execution plan
 */
export interface TaskPlan {
  id: string;
  taskId: string;
  steps: Step[];
  dependencies: Dependency[];
  estimatedTime: number;
  requiredResources: Resource[];
  fallbackStrategies: FallbackStrategy[];
  createdAt: Date;
}

/**
 * Result of task/step execution
 */
export interface Result<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: string[];
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

/**
 * Validation result for executed task
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Message types for inter-agent communication
 */
export type MessageType = 'request' | 'response' | 'broadcast' | 'notification';

/**
 * Message for inter-agent communication
 */
export interface Message<T = unknown> {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  payload: T;
  timestamp: number;
  replyTo?: string;
  priority?: number;
}

/**
 * Response to a message
 */
export interface Response<T = unknown> {
  messageId: string;
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

/**
 * Message handler function type
 */
export type MessageHandler<T = unknown, R = unknown> = (
  message: Message<T>
) => Promise<Response<R>>;

/**
 * Proposal from an agent for conflict resolution
 */
export interface Proposal {
  id: string;
  agent: string;
  action: string;
  params: Record<string, unknown>;
  confidence: number;
  estimatedCost: number;
  estimatedTime: number;
  rationale: string;
  metadata?: Record<string, unknown>;
}

/**
 * Agent capability descriptor
 */
export interface Capability {
  name: string;
  description: string;
  requiredResources: Resource[];
  estimatedCost?: number;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  mcpClient?: unknown; // Will be typed when MCP client is created
  maxConcurrentTasks?: number;
  timeout?: number;
}

/**
 * Orchestrator-specific configuration
 */
export interface OrchestratorConfig extends AgentConfig {
  maxAgents?: number;
  coordinationStrategy?: 'sequential' | 'parallel' | 'adaptive';
}

/**
 * Workflow execution mode
 */
export type WorkflowMode = 'sequential' | 'parallel' | 'conditional' | 'hybrid';

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  mode: WorkflowMode;
  stepResults: Map<string, Result>;
  startTime: number;
  timeout?: number;
}
