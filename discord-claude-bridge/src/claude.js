import { spawn } from 'node:child_process';

const SYSTEM_PROMPT = `You are answering a question asked in a Discord channel.
Reply in the same language the user wrote in (Mongolian or English).
Be concise: prefer under 1800 characters. Use Discord-compatible markdown (code blocks are fine).
Do not mention that you are running inside a CLI.`;

/**
 * Claude Code CLI-г -p (print) горимоор ажиллуулж хариултын текстийг буцаана.
 * Subscription login-оо ашиглана (ANTHROPIC_API_KEY хэрэггүй).
 */
export function runClaude(prompt, opts = {}) {
  const {
    bin = process.env.CLAUDE_BIN || 'claude',
    cwd = process.env.CLAUDE_WORKDIR || process.cwd(),
    timeoutMs = Number(process.env.CLAUDE_TIMEOUT_MS ?? 600_000),
    allowedTools = process.env.CLAUDE_ALLOWED_TOOLS ?? 'Read,Glob,Grep',
    extraArgs = (process.env.CLAUDE_EXTRA_ARGS ?? '').split(' ').filter(Boolean),
    systemPrompt = SYSTEM_PROMPT,
    extraSystemPrompt = '',
    extraTools = [],
    noTools = false,
  } = opts;

  const args = ['-p', '--output-format', 'json', '--append-system-prompt', systemPrompt + extraSystemPrompt];
  const tools = [...(allowedTools ?? '').split(',').map((s) => s.trim()).filter(Boolean), ...extraTools];
  // noTools: итгэлгүй агуулга (файлын нүд) уншуулах үед Claude-д ямар ч хэрэгсэл өгөхгүй.
  if (noTools) args.push('--tools', '', '--strict-mcp-config');
  else if (tools.length) args.push('--allowedTools', ...tools);
  args.push(...extraArgs);

  return new Promise((resolve, reject) => {
    // Subscription ашиглахын тулд API key-г орчноос нь салгана.
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;

    const child = spawn(bin, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`claude timed out after ${timeoutMs} ms`));
    }, timeoutMs);

    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude exited ${code}: ${stderr.trim() || stdout.trim()}`));
      try {
        const json = JSON.parse(stdout);
        if (json.is_error) return reject(new Error(json.result || 'claude returned is_error'));
        resolve({ text: json.result ?? '', sessionId: json.session_id, costUsd: json.total_cost_usd });
      } catch {
        // json parse бүтэлгүйтвэл түүхий текстийг буцаана
        resolve({ text: stdout.trim() });
      }
    });

    child.stdin.end(prompt);
  });
}
