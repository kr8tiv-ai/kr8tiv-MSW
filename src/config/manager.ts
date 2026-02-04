/**
 * Config Manager - Validates and migrates MSW configuration
 *
 * Features:
 * - Schema validation
 * - Version migration
 * - Helpful error messages
 * - Default config generation
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface MswConfig {
  version: string;
  notebookUrl?: string;
  profileDir?: string;
  headless?: boolean;
  timeout?: number;
  autoConversation?: {
    enabled: boolean;
    maxDepth: number;
    scoreThreshold: number;
  };
  ralph?: {
    enabled: boolean;
    maxIterations: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  migrated?: boolean;
}

const CURRENT_VERSION = '1.0.0';

const DEFAULT_CONFIG: MswConfig = {
  version: CURRENT_VERSION,
  headless: false,
  timeout: 120000,
  autoConversation: {
    enabled: true,
    maxDepth: 10,
    scoreThreshold: 70,
  },
  ralph: {
    enabled: true,
    maxIterations: 10,
  },
};

export class ConfigManager {
  private configPath: string;

  constructor(projectDir?: string) {
    const dir = projectDir ?? process.cwd();
    this.configPath = path.join(dir, '.msw', 'config.json');
  }

  /**
   * Load and validate configuration
   */
  loadConfig(): { config: MswConfig; validation: ValidationResult } {
    // Create default if doesn't exist
    if (!fs.existsSync(this.configPath)) {
      return {
        config: DEFAULT_CONFIG,
        validation: {
          valid: true,
          errors: [],
          warnings: ['No config found, using defaults'],
        },
      };
    }

    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(raw) as MswConfig;

      // Validate and potentially migrate
      const validation = this.validate(config);

      if (validation.migrated) {
        // Save migrated config
        this.saveConfig(config);
      }

      return { config, validation };
    } catch (err) {
      return {
        config: DEFAULT_CONFIG,
        validation: {
          valid: false,
          errors: [`Failed to load config: ${err instanceof Error ? err.message : String(err)}`],
          warnings: [],
        },
      };
    }
  }

  /**
   * Validate configuration and migrate if needed
   */
  validate(config: MswConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let migrated = false;

    // Version check and migration
    if (!config.version) {
      warnings.push('Missing version field, assuming 1.0.0');
      config.version = CURRENT_VERSION;
      migrated = true;
    } else if (config.version !== CURRENT_VERSION) {
      // Perform migration
      const migrationResult = this.migrate(config);
      if (migrationResult.success) {
        warnings.push(`Migrated from v${config.version} to v${CURRENT_VERSION}`);
        config.version = CURRENT_VERSION;
        migrated = true;
      } else {
        errors.push(`Migration failed: ${migrationResult.error}`);
      }
    }

    // Validate notebookUrl format (if provided)
    if (config.notebookUrl) {
      if (!config.notebookUrl.startsWith('https://notebooklm.google.com/notebook/')) {
        errors.push('Invalid notebookUrl format - must start with https://notebooklm.google.com/notebook/');
      }
    }

    // Validate timeout
    if (config.timeout !== undefined) {
      if (typeof config.timeout !== 'number' || config.timeout < 1000) {
        errors.push('timeout must be a number >= 1000 (in milliseconds)');
      }
    }

    // Validate autoConversation config
    if (config.autoConversation) {
      if (typeof config.autoConversation.maxDepth !== 'number' || config.autoConversation.maxDepth < 1) {
        errors.push('autoConversation.maxDepth must be a number >= 1');
      }
      if (typeof config.autoConversation.scoreThreshold !== 'number' ||
          config.autoConversation.scoreThreshold < 0 ||
          config.autoConversation.scoreThreshold > 100) {
        errors.push('autoConversation.scoreThreshold must be between 0 and 100');
      }
    }

    // Validate ralph config
    if (config.ralph) {
      if (typeof config.ralph.maxIterations !== 'number' || config.ralph.maxIterations < 1) {
        errors.push('ralph.maxIterations must be a number >= 1');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      migrated,
    };
  }

  /**
   * Migrate old config versions to current
   */
  private migrate(config: MswConfig): { success: boolean; error?: string } {
    try {
      // Currently only v1.0.0 exists, but this prepares for future migrations
      // Example: if (config.version === '0.9.0') { ... }

      // Add missing fields with defaults
      if (!config.autoConversation) {
        config.autoConversation = DEFAULT_CONFIG.autoConversation;
      }

      if (!config.ralph) {
        config.ralph = DEFAULT_CONFIG.ralph;
      }

      if (config.timeout === undefined) {
        config.timeout = DEFAULT_CONFIG.timeout;
      }

      if (config.headless === undefined) {
        config.headless = DEFAULT_CONFIG.headless;
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Save configuration to disk
   */
  saveConfig(config: MswConfig): void {
    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Initialize default config
   */
  initConfig(notebookUrl?: string): MswConfig {
    const config = { ...DEFAULT_CONFIG };

    if (notebookUrl) {
      config.notebookUrl = notebookUrl;
    }

    this.saveConfig(config);
    return config;
  }

  /**
   * Update specific config fields
   */
  updateConfig(updates: Partial<MswConfig>): ValidationResult {
    const { config } = this.loadConfig();

    // Merge updates
    Object.assign(config, updates);

    // Validate merged config
    const validation = this.validate(config);

    if (validation.valid) {
      this.saveConfig(config);
    }

    return validation;
  }

  /**
   * Get config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Check if config exists
   */
  configExists(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * Detect config drift by comparing with snapshot
   */
  detectDrift(): { hasDrift: boolean; changes: string[]; snapshot?: MswConfig } {
    const snapshotPath = this.configPath + '.snapshot';

    if (!fs.existsSync(snapshotPath)) {
      return {
        hasDrift: false,
        changes: ['No snapshot available - create one with createSnapshot()'],
      };
    }

    try {
      const current = this.loadConfig().config;
      const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8')) as MswConfig;

      const changes = this.compareConfigs(snapshot, current);

      return {
        hasDrift: changes.length > 0,
        changes,
        snapshot,
      };
    } catch (err) {
      return {
        hasDrift: false,
        changes: [`Failed to detect drift: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  }

  /**
   * Create a config snapshot for drift detection
   */
  createSnapshot(): void {
    const snapshotPath = this.configPath + '.snapshot';
    const { config } = this.loadConfig();

    fs.writeFileSync(snapshotPath, JSON.stringify(config, null, 2));
    console.log('[config] Created config snapshot');
  }

  /**
   * Compare two configs and return list of changes
   */
  private compareConfigs(baseline: MswConfig, current: MswConfig): string[] {
    const changes: string[] = [];

    // Check top-level fields
    for (const key of Object.keys(baseline) as Array<keyof MswConfig>) {
      const baselineValue = baseline[key];
      const currentValue = current[key];

      if (typeof baselineValue === 'object' && typeof currentValue === 'object') {
        // Deep comparison for nested objects
        const nestedChanges = this.compareObjects(
          baselineValue as Record<string, unknown>,
          currentValue as Record<string, unknown>,
          key,
        );
        changes.push(...nestedChanges);
      } else if (baselineValue !== currentValue) {
        changes.push(`${key}: ${baselineValue} → ${currentValue}`);
      }
    }

    // Check for added fields
    for (const key of Object.keys(current) as Array<keyof MswConfig>) {
      if (!(key in baseline)) {
        changes.push(`Added field: ${key}`);
      }
    }

    return changes;
  }

  /**
   * Deep compare nested objects
   */
  private compareObjects(
    baseline: Record<string, unknown>,
    current: Record<string, unknown>,
    prefix: string,
  ): string[] {
    const changes: string[] = [];

    for (const key of Object.keys(baseline)) {
      const baselineValue = baseline[key];
      const currentValue = current[key];

      if (baselineValue !== currentValue) {
        changes.push(`${prefix}.${key}: ${baselineValue} → ${currentValue}`);
      }
    }

    for (const key of Object.keys(current)) {
      if (!(key in baseline)) {
        changes.push(`Added field: ${prefix}.${key}`);
      }
    }

    return changes;
  }

  /**
   * Reset config to snapshot
   */
  resetToSnapshot(): { success: boolean; error?: string } {
    const snapshotPath = this.configPath + '.snapshot';

    if (!fs.existsSync(snapshotPath)) {
      return {
        success: false,
        error: 'No snapshot available',
      };
    }

    try {
      const snapshot = fs.readFileSync(snapshotPath, 'utf-8');
      fs.writeFileSync(this.configPath, snapshot);
      console.log('[config] Reset to snapshot');

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
