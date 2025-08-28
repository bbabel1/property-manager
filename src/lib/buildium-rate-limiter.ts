// Buildium API Rate Limiter
// Handles rate limiting, request queuing, retry logic, and request spacing

interface RateLimitConfig {
  maxConcurrentRequests: number
  requestsPerSecond: number
  retryAttempts: number
  retryDelayMs: number
  requestSpacingMs: number
}

interface QueuedRequest {
  id: string
  execute: () => Promise<any>
  resolve: (value: any) => void
  reject: (error: any) => void
  retryCount: number
}

export class BuildiumRateLimiter {
  private config: RateLimitConfig
  private queue: QueuedRequest[] = []
  private activeRequests = 0
  private lastRequestTime = 0

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      maxConcurrentRequests: 10,
      requestsPerSecond: 10,
      retryAttempts: 3,
      retryDelayMs: 200,
      requestSpacingMs: 100,
      ...config
    }
  }

  /**
   * Execute a request with rate limiting, queuing, and retry logic
   */
  async executeRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        id: Math.random().toString(36).substr(2, 9),
        execute: requestFn,
        resolve,
        reject,
        retryCount: 0
      }

      this.queue.push(request)
      this.processQueue()
    })
  }

  /**
   * Process the request queue
   */
  private async processQueue() {
    if (this.activeRequests >= this.config.maxConcurrentRequests || this.queue.length === 0) {
      return
    }

    const request = this.queue.shift()
    if (!request) return

    this.activeRequests++

    try {
      // Ensure minimum spacing between requests
      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequestTime
      if (timeSinceLastRequest < this.config.requestSpacingMs) {
        await this.delay(this.config.requestSpacingMs - timeSinceLastRequest)
      }

      const result = await request.execute()
      this.lastRequestTime = Date.now()
      request.resolve(result)

    } catch (error: any) {
      // Handle rate limiting (429 errors)
      if (error.status === 429 && request.retryCount < this.config.retryAttempts) {
        console.log(`Rate limited, retrying request ${request.id} (attempt ${request.retryCount + 1}/${this.config.retryAttempts})`)
        
        request.retryCount++
        const delayMs = this.config.retryDelayMs * Math.pow(2, request.retryCount - 1) // Exponential backoff
        await this.delay(delayMs)
        
        // Re-queue the request
        this.queue.unshift(request)
      } else {
        request.reject(error)
      }
    } finally {
      this.activeRequests--
      // Process next request in queue
      setImmediate(() => this.processQueue())
    }
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      maxConcurrentRequests: this.config.maxConcurrentRequests
    }
  }

  /**
   * Clear the queue
   */
  clearQueue() {
    this.queue.forEach(request => {
      request.reject(new Error('Queue cleared'))
    })
    this.queue = []
  }
}

// Default rate limiter instance
export const buildiumRateLimiter = new BuildiumRateLimiter()

/**
 * Wrapper function for making rate-limited Buildium API calls
 */
export async function rateLimitedBuildiumRequest<T>(
  requestFn: () => Promise<T>,
  customConfig?: Partial<RateLimitConfig>
): Promise<T> {
  const limiter = customConfig ? new BuildiumRateLimiter(customConfig) : buildiumRateLimiter
  return limiter.executeRequest(requestFn)
}

/**
 * Utility for bulk operations with progress tracking
 */
export async function bulkBuildiumOperations<T, R>(
  items: T[],
  operation: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i++) {
    const result = await rateLimitedBuildiumRequest(() => operation(items[i], i))
    results.push(result)
    
    if (onProgress) {
      onProgress(i + 1, items.length)
    }
  }
  
  return results
}
