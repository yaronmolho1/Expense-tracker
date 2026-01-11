/**
 * Feature Flags System
 * 
 * Allows enabling/disabling features without code deployment.
 * Useful for A/B testing, gradual rollouts, and kill switches.
 */

export interface FeatureFlag {
  enabled: boolean;
  rolloutPercentage?: number; // 0-100
  enabledFor?: string[]; // Specific user IDs
  description?: string;
}

export interface FeatureFlagConfig {
  [key: string]: FeatureFlag;
}

/**
 * Feature Flags Configuration
 * 
 * In production, this would come from a database or external service.
 * For now, configured via environment variables.
 */
export const featureFlags: FeatureFlagConfig = {
  // AI Features
  aiCategorization: {
    enabled: process.env.FF_AI_CATEGORIZATION !== 'false',
    description: 'Automatic transaction categorization using Claude AI',
    rolloutPercentage: 100,
  },
  
  // Subscription Detection
  subscriptionDetection: {
    enabled: process.env.FF_SUBSCRIPTION_DETECTION !== 'false',
    description: 'Automatic subscription detection',
    rolloutPercentage: 100,
  },
  
  // Business Merge Suggestions
  businessMergeDetection: {
    enabled: process.env.FF_BUSINESS_MERGE_DETECTION !== 'false',
    description: 'Fuzzy matching for duplicate business detection',
    rolloutPercentage: 100,
  },
  
  // Exchange Rate Features
  exchangeRateSync: {
    enabled: process.env.FF_EXCHANGE_RATE_SYNC !== 'false',
    description: 'Daily sync of exchange rates from Bank of Israel',
    rolloutPercentage: 100,
  },
  
  // UI Features
  budgetTracking: {
    enabled: true,
    description: 'Budget setting and tracking features',
  },
  
  timeFlowView: {
    enabled: true,
    description: 'Time-flow expense analysis table',
  },
  
  // Experimental Features
  exportToCsv: {
    enabled: process.env.FF_EXPORT_CSV === 'true',
    description: 'Export transactions to CSV',
    rolloutPercentage: 0, // Not yet implemented
  },
  
  multiCurrency: {
    enabled: true,
    description: 'Multi-currency support (USD, EUR, ILS)',
  },
  
  // Performance Optimizations
  queryCache: {
    enabled: process.env.FF_QUERY_CACHE !== 'false',
    description: 'Enable query result caching',
    rolloutPercentage: 100,
  },
  
  // Admin Features
  adminDashboard: {
    enabled: process.env.FF_ADMIN_DASHBOARD === 'true',
    description: 'Admin dashboard with system metrics',
    rolloutPercentage: 0, // Not yet implemented
  },
};

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(
  flagName: keyof typeof featureFlags,
  userId?: string
): boolean {
  const flag = featureFlags[flagName];
  
  if (!flag) {
    console.warn(`Feature flag "${flagName}" not found, defaulting to false`);
    return false;
  }
  
  // Check if explicitly disabled
  if (!flag.enabled) {
    return false;
  }
  
  // Check if enabled for specific users
  if (flag.enabledFor && userId) {
    return flag.enabledFor.includes(userId);
  }
  
  // Check rollout percentage
  if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
    // For now, use simple percentage check
    // In production, use consistent hashing based on userId
    if (userId) {
      const hash = simpleHash(userId);
      return (hash % 100) < flag.rolloutPercentage;
    }
    // If no userId, use random for anonymous users
    return Math.random() * 100 < flag.rolloutPercentage;
  }
  
  return true;
}

/**
 * Get all feature flags status
 */
export function getAllFeatureFlags(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  
  for (const [name, flag] of Object.entries(featureFlags)) {
    result[name] = flag.enabled;
  }
  
  return result;
}

/**
 * Get feature flag with metadata
 */
export function getFeatureFlag(flagName: keyof typeof featureFlags): FeatureFlag | null {
  return featureFlags[flagName] || null;
}

/**
 * Simple hash function for consistent user rollouts
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Feature flag middleware for API routes
 */
export function requireFeature(flagName: keyof typeof featureFlags) {
  return (userId?: string) => {
    if (!isFeatureEnabled(flagName, userId)) {
      throw new Error(`Feature "${flagName}" is not enabled`);
    }
  };
}
