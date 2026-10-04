export interface AgentMetadataWaitOptions {
  readonly timeoutMs: number;
  readonly pollIntervalMs: number;
  readonly now: () => number;
  readonly sleep: (milliseconds: number) => Promise<void>;
}

export interface AgentMetadataWaitResult<T> {
  readonly metadata: T;
  readonly timedOut: boolean;
}

function metadataReadiness(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const recording = Reflect.get(metadata, 'recording');
  if (!recording || typeof recording !== 'object') return null;
  const readiness = Reflect.get(recording, 'agentReadiness');
  return typeof readiness === 'string' ? readiness : null;
}

async function fetchBeforeDeadline<T>(
  fetchMetadata: (signal: AbortSignal) => Promise<T>,
  remainingMs: number,
): Promise<T | null> {
  if (remainingMs <= 0) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remainingMs);
  try {
    return await fetchMetadata(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) return null;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function waitForAgentMetadata<T>(
  fetchMetadata: (signal: AbortSignal) => Promise<T>,
  options: AgentMetadataWaitOptions
): Promise<AgentMetadataWaitResult<T>> {
  const startedAt = options.now();
  const initial = await fetchBeforeDeadline(fetchMetadata, options.timeoutMs);
  if (!initial) throw new Error('Agent metadata request exceeded the wait timeout');
  let metadata = initial;
  while (metadataReadiness(metadata) === 'preparing') {
    const remainingMs = options.timeoutMs - (options.now() - startedAt);
    if (remainingMs <= 0) return { metadata, timedOut: true };
    await options.sleep(Math.min(options.pollIntervalMs, remainingMs));
    if (options.now() - startedAt >= options.timeoutMs) {
      return { metadata, timedOut: true };
    }
    const next = await fetchBeforeDeadline(
      fetchMetadata,
      options.timeoutMs - (options.now() - startedAt),
    );
    if (!next) return { metadata, timedOut: true };
    metadata = next;
  }
  return { metadata, timedOut: false };
}
