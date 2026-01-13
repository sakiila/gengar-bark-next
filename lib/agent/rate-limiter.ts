/**
 * Rate limiter for the AI Agent system.
 * Handles duplicate message detection and user abuse throttling.
 * Requirements: 5.1, 5.4
 */

import { Redis } from '@upstash/redis';
import { createHash } from 'crypto';
import { RateLimitError } from './errors';

/**
 * Configuration for rate limiting.
 */
export interface RateLimiterConfig {
  /** TTL for duplicate detection in seconds (default: 120) */
  duplicateTtlSeconds: number;
  /** TTL for user rate limit window in seconds (default: 60) */
  userLimitWindowSeconds: number;
  /** Maximum requests per user per window (default: 10) */
  maxRequestsPerUser: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  duplicateTtlSeconds: 120,
  userLimitWindowSeconds: 60,
  maxRequestsPerUser: 10,
};

/**
 * RateLimiter class for managing request rate limiting.
 * Uses Redis for distributed state management.
 */
export class RateLimiter {
  private redis: Redis;
  private config: RateLimiterConfig;

  constructor(redis?: Redis, config?: Partial<RateLimiterConfig>) {
    this.redis = redis ?? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    });
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a unique hash for duplicate detection.
   * Combines userId, channel, threadTs, and message text.
   */
  private generateMessageHash(
    userId: string,
    channel: string,
    threadTs: string,
    text: string
  ): string {
    const content = `${userId}:${channel}:${threadTs}:${text}`;
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get the Redis key for duplicate detection.
   */
  private getDuplicateKey(hash: string): string {
    return `agent:duplicate:${hash}`;
  }

  /**
   * Get the Redis key for user rate limiting.
   */
  private getUserLimitKey(userId: string): string {
    return `agent:ratelimit:${userId}`;
  }

  /**
   * Check if a message is a duplicate within the TTL window.
   * Returns true if the message is a duplicate (should be ignored).
   * Returns false if the message is new (should be processed).
   * 
   * Requirement 5.1: Duplicate messages within 2 minutes should be ignored.
   * 
   * @param userId - Slack user ID
   * @param channel - Slack channel ID
   * @param threadTs - Thread timestamp
   * @param text - Message text
   * @returns true if duplicate, false if new
   */
  async checkDuplicate(
    userId: string,
    channel: string,
    threadTs: string,
    text: string
  ): Promise<boolean> {
    const hash = this.generateMessageHash(userId, channel, threadTs, text);
    const key = this.getDuplicateKey(hash);

    // Try to set the key with NX (only if not exists)
    // If it returns null, the key already exists (duplicate)
    const result = await this.redis.set(key, '1', {
      nx: true,
      ex: this.config.duplicateTtlSeconds,
    });

    // result is 'OK' if key was set (new message), null if key exists (duplicate)
    return result === null;
  }

  /**
   * Check if a user has exceeded their rate limit.
   * Returns true if the user can make a request.
   * Returns false if the user should be throttled.
   * 
   * Requirement 5.4: More than 10 requests per minute should be throttled.
   * 
   * @param userId - Slack user ID
   * @returns true if user can proceed, false if throttled
   */
  async checkUserLimit(userId: string): Promise<boolean> {
    const key = this.getUserLimitKey(userId);
    const count = await this.redis.get<number>(key);

    // If no count or count is within limit, user can proceed
    if (count === null || count < this.config.maxRequestsPerUser) {
      return true;
    }

    // User has exceeded the limit
    return false;
  }

  /**
   * Record a request for a user, incrementing their request count.
   * Sets TTL on first request to create the rate limit window.
   * 
   * @param userId - Slack user ID
   */
  async recordRequest(userId: string): Promise<void> {
    const key = this.getUserLimitKey(userId);
    
    // Increment the counter
    const newCount = await this.redis.incr(key);
    
    // If this is the first request in the window, set the TTL
    if (newCount === 1) {
      await this.redis.expire(key, this.config.userLimitWindowSeconds);
    }
  }

  /**
   * Get the current request count for a user.
   * Useful for debugging and monitoring.
   * 
   * @param userId - Slack user ID
   * @returns Current request count or 0 if no requests
   */
  async getUserRequestCount(userId: string): Promise<number> {
    const key = this.getUserLimitKey(userId);
    const count = await this.redis.get<number>(key);
    return count ?? 0;
  }

  /**
   * Validate a request against all rate limiting rules.
   * Throws RateLimitError if any limit is exceeded.
   * Records the request if validation passes.
   * 
   * @param userId - Slack user ID
   * @param channel - Slack channel ID
   * @param threadTs - Thread timestamp
   * @param text - Message text
   * @throws RateLimitError if rate limit exceeded
   */
  async validateRequest(
    userId: string,
    channel: string,
    threadTs: string,
    text: string
  ): Promise<void> {
    // Check for duplicate message
    const isDuplicate = await this.checkDuplicate(userId, channel, threadTs, text);
    if (isDuplicate) {
      throw new RateLimitError(
        'duplicate',
        'Duplicate message detected',
        { retryAfterMs: this.config.duplicateTtlSeconds * 1000 }
      );
    }

    // Check user rate limit
    const canProceed = await this.checkUserLimit(userId);
    if (!canProceed) {
      throw new RateLimitError(
        'user',
        'User rate limit exceeded',
        { retryAfterMs: this.config.userLimitWindowSeconds * 1000 }
      );
    }

    // Record the request
    await this.recordRequest(userId);
  }

  /**
   * Get the remaining time until a user's rate limit resets.
   * Returns -1 if no rate limit is active.
   * 
   * @param userId - Slack user ID
   * @returns TTL in seconds or -1 if no limit
   */
  async getUserLimitTtl(userId: string): Promise<number> {
    const key = this.getUserLimitKey(userId);
    const ttl = await this.redis.ttl(key);
    return ttl;
  }
}

/**
 * Singleton instance for the default rate limiter.
 */
let defaultRateLimiter: RateLimiter | null = null;

/**
 * Get the default rate limiter instance.
 * Creates one if it doesn't exist.
 */
export function getRateLimiter(): RateLimiter {
  if (!defaultRateLimiter) {
    defaultRateLimiter = new RateLimiter();
  }
  return defaultRateLimiter;
}

/**
 * Create a new rate limiter with custom configuration.
 * Useful for testing or specialized use cases.
 */
export function createRateLimiter(
  redis?: Redis,
  config?: Partial<RateLimiterConfig>
): RateLimiter {
  return new RateLimiter(redis, config);
}
