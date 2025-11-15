/**
 * Conflict Resolution
 *
 * Resolves conflicts when multiple agents propose different solutions:
 * - Proposal validation
 * - Ranking by confidence, cost, and time
 * - Best proposal selection
 * - Tie-breaking strategies
 */

import { type Proposal } from '../types/agent.js';
import { logger } from '../utils/index.js';

/**
 * Conflict Resolver
 *
 * When multiple agents propose different solutions, the conflict resolver
 * determines which proposal to use based on:
 * 1. Validity (meets basic requirements)
 * 2. Confidence (how confident the agent is)
 * 3. Cost (lower is better)
 * 4. Time (faster is better)
 * 5. Rationale quality (breaking ties)
 */
export class ConflictResolver {
  private readonly minConfidence: number;

  constructor(minConfidence = 0.5) {
    this.minConfidence = minConfidence;
    logger.debug('ConflictResolver initialized', { minConfidence });
  }

  /**
   * Resolve conflict between multiple proposals
   *
   * @param proposals - Array of proposals from different agents
   * @returns Best proposal
   */
  resolve(proposals: Proposal[]): Proposal {
    logger.info(`Resolving conflict between ${proposals.length} proposals`);

    if (proposals.length === 0) {
      throw new Error('No proposals to resolve');
    }

    // 1. Filter invalid proposals
    const valid = proposals.filter((p) => this.isValid(p));

    if (valid.length === 0) {
      logger.warn('No valid proposals found', {
        totalProposals: proposals.length,
        invalidReasons: proposals.map((p) => this.getInvalidReason(p)),
      });
      throw new Error('No valid proposals');
    }

    if (valid.length === 1) {
      logger.info('Only one valid proposal, using it', { proposal: valid[0]?.id });
      return valid[0] as Proposal;
    }

    // 2. Rank proposals
    const ranked = this.rankProposals(valid);

    // 3. Check for ties at top
    const best = ranked[0] as Proposal;
    const tied = ranked.filter(
      (p) =>
        p.confidence === best.confidence &&
        p.estimatedCost === best.estimatedCost &&
        p.estimatedTime === best.estimatedTime
    );

    if (tied.length > 1) {
      // Break tie
      logger.debug(`Tie detected between ${tied.length} proposals, breaking tie`);
      return this.breakTie(tied);
    }

    logger.info('Best proposal selected', {
      proposalId: best.id,
      agent: best.agent,
      confidence: best.confidence,
      cost: best.estimatedCost,
      time: best.estimatedTime,
    });

    return best;
  }

  /**
   * Resolve multiple conflicts in batch
   *
   * @param conflictGroups - Array of proposal groups
   * @returns Array of best proposals
   */
  resolveMultiple(conflictGroups: Proposal[][]): Proposal[] {
    return conflictGroups.map((group) => this.resolve(group));
  }

  /**
   * Check if proposal is valid
   *
   * @param proposal - Proposal to validate
   * @returns True if valid
   */
  private isValid(proposal: Proposal): boolean {
    // Check required fields
    if (!proposal.action || !proposal.params) {
      return false;
    }

    // Check confidence threshold
    if (proposal.confidence < this.minConfidence) {
      return false;
    }

    // Check cost is non-negative
    if (proposal.estimatedCost < 0) {
      return false;
    }

    // Check time is positive
    if (proposal.estimatedTime <= 0) {
      return false;
    }

    return true;
  }

  /**
   * Get reason why proposal is invalid
   *
   * @param proposal - Proposal to check
   * @returns Invalid reason or null if valid
   */
  private getInvalidReason(proposal: Proposal): string | null {
    if (!proposal.action) {
      return 'Missing action';
    }

    if (!proposal.params) {
      return 'Missing params';
    }

    if (proposal.confidence < this.minConfidence) {
      return `Confidence ${proposal.confidence} below threshold ${this.minConfidence}`;
    }

    if (proposal.estimatedCost < 0) {
      return 'Negative cost';
    }

    if (proposal.estimatedTime <= 0) {
      return 'Non-positive time';
    }

    return null;
  }

  /**
   * Rank proposals by priority rules
   *
   * Priority:
   * 1. Higher confidence
   * 2. Lower cost
   * 3. Faster time
   * 4. Agent name (alphabetical - for determinism)
   *
   * @param proposals - Valid proposals
   * @returns Ranked proposals (best first)
   */
  private rankProposals(proposals: Proposal[]): Proposal[] {
    return [...proposals].sort((a, b) => {
      // 1. Rank by confidence (higher is better)
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }

      // 2. Rank by cost (lower is better)
      if (a.estimatedCost !== b.estimatedCost) {
        return a.estimatedCost - b.estimatedCost;
      }

      // 3. Rank by time (faster is better)
      if (a.estimatedTime !== b.estimatedTime) {
        return a.estimatedTime - b.estimatedTime;
      }

      // 4. Rank by agent name (alphabetical for determinism)
      return a.agent.localeCompare(b.agent);
    });
  }

  /**
   * Break tie between equally-ranked proposals
   *
   * Uses rationale length and quality as tie-breaker.
   *
   * @param tied - Tied proposals
   * @returns Best proposal from tied set
   */
  private breakTie(tied: Proposal[]): Proposal {
    logger.debug('Breaking tie using rationale quality');

    // Score rationale by length and keywords
    const scored = tied.map((proposal) => ({
      proposal,
      score: this.scoreRationale(proposal.rationale),
    }));

    // Sort by score (higher is better)
    scored.sort((a, b) => b.score - a.score);

    const winner = scored[0]?.proposal;
    if (!winner) {
      // Fallback: just take first
      return tied[0] as Proposal;
    }

    logger.debug('Tie broken', {
      winner: winner.id,
      agent: winner.agent,
      score: scored[0]?.score,
    });

    return winner;
  }

  /**
   * Score proposal rationale for tie-breaking
   *
   * Higher score = better rationale
   *
   * @param rationale - Rationale text
   * @returns Score (higher is better)
   */
  private scoreRationale(rationale: string): number {
    let score = 0;

    // Base score: length (more detailed is better, up to a point)
    score += Math.min(rationale.length / 10, 50); // Cap at 50 points

    // Bonus for quality keywords
    const qualityKeywords = [
      'because',
      'therefore',
      'optimal',
      'efficient',
      'secure',
      'reliable',
      'tested',
      'proven',
      'validated',
      'best',
      'recommended',
    ];

    for (const keyword of qualityKeywords) {
      if (rationale.toLowerCase().includes(keyword)) {
        score += 5;
      }
    }

    // Penalty for vague words
    const vagueWords = ['maybe', 'possibly', 'might', 'could be', 'unsure', 'unknown'];

    for (const word of vagueWords) {
      if (rationale.toLowerCase().includes(word)) {
        score -= 3;
      }
    }

    return Math.max(0, score); // Ensure non-negative
  }

  /**
   * Get statistics about proposal set
   *
   * @param proposals - Proposals to analyze
   * @returns Statistics
   */
  getStats(proposals: Proposal[]): {
    total: number;
    valid: number;
    invalid: number;
    avgConfidence: number;
    avgCost: number;
    avgTime: number;
  } {
    const valid = proposals.filter((p) => this.isValid(p));

    const avgConfidence =
      valid.length > 0 ? valid.reduce((sum, p) => sum + p.confidence, 0) / valid.length : 0;

    const avgCost =
      valid.length > 0 ? valid.reduce((sum, p) => sum + p.estimatedCost, 0) / valid.length : 0;

    const avgTime =
      valid.length > 0 ? valid.reduce((sum, p) => sum + p.estimatedTime, 0) / valid.length : 0;

    return {
      total: proposals.length,
      valid: valid.length,
      invalid: proposals.length - valid.length,
      avgConfidence,
      avgCost,
      avgTime,
    };
  }
}
