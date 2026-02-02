/**
 * Ralph Runner -- orchestrates the Ralph loop lifecycle.
 * Main entry point that MCP tools call to start/status/stop loops.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RalphConfig, RalphState } from '../types/execution.js';
import { IterationTracker } from './iteration-tracker.js';

/** Hook configuration structure for .claude/settings.json */
interface HookEntry {
  type: string;
  command: string;
  timeout: number;
}

interface HookEventConfig {
  hooks: HookEntry[];
}

interface ClaudeSettings {
  hooks?: Record<string, HookEventConfig[]>;
  [key: string]: unknown;
}

const STOP_HOOK_COMMAND = 'node "$CLAUDE_PROJECT_DIR/dist/execution/stop-hook.js"';
const HOOK_TIMEOUT = 60;

export class RalphRunner {
  private readonly projectDir: string;
  private readonly tracker: IterationTracker;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
    this.tracker = new IterationTracker(projectDir);
  }

  /**
   * Start a new Ralph loop. Initializes state and returns hook config
   * for the caller (MCP tool) to install.
   */
  start(config: RalphConfig): { hookConfig: ClaudeSettings } {
    this.tracker.init(config);

    const hookConfig = this.buildHookConfig();
    return { hookConfig };
  }

  /** Load and return current Ralph state, or null if none exists */
  status(): RalphState | null {
    return this.tracker.load();
  }

  /** Stop the Ralph loop by deactivating state */
  stop(): void {
    this.tracker.reset();
  }

  /** Path to .claude/settings.json */
  getHookConfigPath(): string {
    return path.join(this.projectDir, '.claude', 'settings.json');
  }

  /**
   * Install the stop hook into .claude/settings.json.
   * Reads existing settings, merges hook config, writes back.
   * Creates the file and directory if they don't exist.
   * Preserves existing hooks.
   */
  installHook(): void {
    const settingsPath = this.getHookConfigPath();
    const settingsDir = path.dirname(settingsPath);

    // Ensure .claude directory exists
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }

    // Load existing settings or start fresh
    let settings: ClaudeSettings = {};
    if (fs.existsSync(settingsPath)) {
      try {
        const raw = fs.readFileSync(settingsPath, 'utf-8');
        settings = JSON.parse(raw) as ClaudeSettings;
      } catch {
        // Corrupted file -- start fresh
        settings = {};
      }
    }

    // Merge hook config
    const newHookConfig = this.buildHookConfig();
    if (!settings.hooks) {
      settings.hooks = {};
    }

    // Merge each hook event (Stop, SubagentStop), preserving existing hooks
    for (const [event, configs] of Object.entries(newHookConfig.hooks ?? {})) {
      const existing = settings.hooks[event] ?? [];
      // Check if our hook command is already installed
      const alreadyInstalled = existing.some((cfg) =>
        cfg.hooks.some((h) => h.command === STOP_HOOK_COMMAND),
      );
      if (!alreadyInstalled) {
        settings.hooks[event] = [...existing, ...configs];
      }
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  /** Build the hook configuration object for Stop and SubagentStop events */
  private buildHookConfig(): ClaudeSettings {
    const hookEntry: HookEntry = {
      type: 'command',
      command: STOP_HOOK_COMMAND,
      timeout: HOOK_TIMEOUT,
    };

    const eventConfig: HookEventConfig = { hooks: [hookEntry] };

    return {
      hooks: {
        Stop: [eventConfig],
        SubagentStop: [eventConfig],
      },
    };
  }
}
