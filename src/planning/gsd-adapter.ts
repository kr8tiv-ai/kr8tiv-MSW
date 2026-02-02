/**
 * GSD Format Adapter
 *
 * Bidirectional conversion between MSW internal task representation
 * and GSD XML task format used in PLAN.md files.
 */

export type MswTaskType = 'auto' | 'checkpoint:human-verify' | 'checkpoint:decision';

export interface MswTask {
  id: string;
  name: string;
  files: string[];
  action: string;
  verify: string;
  done: string;
  type: MswTaskType;
}

// --- XML escaping/unescaping ---

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function unescapeXml(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

// --- Helpers ---

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? unescapeXml(match[1].trim()) : '';
}

// --- Public API ---

/**
 * Convert an array of MSW tasks to GSD XML format.
 */
export function toGsdXml(tasks: MswTask[]): string {
  return tasks
    .map((task) => {
      const filesStr = escapeXml(task.files.join(', '));
      return [
        `<task type="${escapeXml(task.type)}">`,
        `  <name>${escapeXml(task.name)}</name>`,
        `  <files>${filesStr}</files>`,
        `  <action>${escapeXml(task.action)}</action>`,
        `  <verify>${escapeXml(task.verify)}</verify>`,
        `  <done>${escapeXml(task.done)}</done>`,
        `</task>`,
      ].join('\n');
    })
    .join('\n\n');
}

/**
 * Parse GSD XML task blocks back into MSW task objects.
 */
export function fromGsdXml(xml: string): MswTask[] {
  const taskRegex = /<task[^>]*type="([^"]*)"[^>]*>([\s\S]*?)<\/task>/g;
  const tasks: MswTask[] = [];
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = taskRegex.exec(xml)) !== null) {
    idx++;
    const type = unescapeXml(match[1]) as MswTaskType;
    const body = match[2];

    const filesRaw = extractTag(body, 'files');
    const files = filesRaw
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);

    tasks.push({
      id: String(idx),
      name: extractTag(body, 'name'),
      files,
      action: extractTag(body, 'action'),
      verify: extractTag(body, 'verify'),
      done: extractTag(body, 'done'),
      type,
    });
  }

  return tasks;
}
