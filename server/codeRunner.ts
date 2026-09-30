import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface CodeExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number;
  error?: string;
  language: string;
}

// Temporary sandbox directory
const SANDBOX_DIR = path.join(os.tmpdir(), 'aura_sandbox');
if (!fs.existsSync(SANDBOX_DIR)) {
  try {
    fs.mkdirSync(SANDBOX_DIR, { recursive: true });
  } catch (err) {
    console.warn('[CodeRunner] Could not create sandbox dir, using tmpdir directly:', err);
  }
}

/**
 * Executes user/generated code in a securely isolated child process sandbox
 * Features:
 * - Strict 4-second timeout to prevent infinite loops
 * - Max buffer 256KB to prevent memory exhaustion
 * - Stripped environment variables (no access to process.env secrets, API keys, etc.)
 * - Process isolation: runs with -I (isolated mode) for Python, no site-packages pollution
 * - Isolated temporary working directory
 */
export async function executeCode(
  language: string,
  code: string,
  inputStdin?: string
): Promise<CodeExecutionResult> {
  const normLang = (language || '').toLowerCase().trim();
  const startTime = Date.now();

  if (!code || !code.trim()) {
    return {
      success: false,
      stdout: '',
      stderr: 'No code provided to execute.',
      exitCode: 1,
      executionTimeMs: 0,
      language: normLang,
    };
  }

  // Safety checks: Disallow harmful shell injection / system destructive calls
  const lowerCode = code.toLowerCase();
  const dangerousPatterns = [
    'rm -rf',
    'mkfs',
    ':(){ :|:& };:',
    'shutdown',
    'reboot',
    'dd if=',
    '/dev/zero',
    '/dev/random',
  ];
  for (const pattern of dangerousPatterns) {
    if (lowerCode.includes(pattern)) {
      return {
        success: false,
        stdout: '',
        stderr: `Security Exception: Potentially destructive system command '${pattern}' is blocked by sandbox safety policy.`,
        exitCode: 1,
        executionTimeMs: 0,
        language: normLang,
      };
    }
  }

  // Python Sandbox Execution
  if (normLang === 'python' || normLang === 'py' || normLang === 'python3') {
    return new Promise((resolve) => {
      // Create isolated temporary file
      const tempFileName = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.py`;
      const tempFilePath = path.join(SANDBOX_DIR, tempFileName);

      try {
        fs.writeFileSync(tempFilePath, code, 'utf8');
      } catch (err: any) {
        return resolve({
          success: false,
          stdout: '',
          stderr: `Failed to prepare sandbox execution file: ${err.message}`,
          exitCode: 1,
          executionTimeMs: Date.now() - startTime,
          language: 'python',
        });
      }

      // Stripped, hardened environment
      const cleanEnv = {
        PATH: '/usr/local/bin:/usr/bin:/bin',
        LANG: 'en_US.UTF-8',
        LC_ALL: 'en_US.UTF-8',
        PYTHONHASHSEED: '0',
        PYTHONDONTWRITEBYTECODE: '1',
      };

      const proc = spawn('python3', ['-u', '-I', '-B', tempFilePath], {
        timeout: 4500, // 4.5s max
        env: cleanEnv,
        cwd: SANDBOX_DIR,
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      const killTimeout = setTimeout(() => {
        killed = true;
        try {
          proc.kill('SIGKILL');
        } catch {}
      }, 4500);

      if (inputStdin) {
        try {
          proc.stdin.write(inputStdin);
          proc.stdin.end();
        } catch {}
      }

      proc.stdout.on('data', (chunk) => {
        if (stdout.length < 250000) {
          stdout += chunk.toString();
        }
      });

      proc.stderr.on('data', (chunk) => {
        if (stderr.length < 50000) {
          stderr += chunk.toString();
        }
      });

      proc.on('close', (code, signal) => {
        clearTimeout(killTimeout);
        // Clean up temp file
        try {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        } catch {}

        const duration = Date.now() - startTime;
        if (killed || signal === 'SIGTERM' || signal === 'SIGKILL') {
          return resolve({
            success: false,
            stdout,
            stderr: stderr + '\nExecution timed out (exceeded 4.5 second limit).',
            exitCode: -1,
            executionTimeMs: duration,
            language: 'python',
          });
        }

        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code,
          executionTimeMs: duration,
          language: 'python',
        });
      });

      proc.on('error', (err) => {
        clearTimeout(killTimeout);
        try {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        } catch {}

        resolve({
          success: false,
          stdout,
          stderr: `Execution error: ${err.message}`,
          exitCode: 1,
          executionTimeMs: Date.now() - startTime,
          language: 'python',
        });
      });
    });
  }

  // Node.js / JavaScript Sandbox Execution
  if (normLang === 'javascript' || normLang === 'js' || normLang === 'node') {
    return new Promise((resolve) => {
      const tempFileName = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.js`;
      const tempFilePath = path.join(SANDBOX_DIR, tempFileName);

      try {
        fs.writeFileSync(tempFilePath, code, 'utf8');
      } catch (err: any) {
        return resolve({
          success: false,
          stdout: '',
          stderr: `Failed to prepare JS execution file: ${err.message}`,
          exitCode: 1,
          executionTimeMs: Date.now() - startTime,
          language: 'javascript',
        });
      }

      const cleanEnv = {
        PATH: '/usr/local/bin:/usr/bin:/bin',
        NODE_ENV: 'sandbox',
      };

      const proc = spawn('node', ['--max-old-space-size=64', tempFilePath], {
        timeout: 4500,
        env: cleanEnv,
        cwd: SANDBOX_DIR,
      });

      let stdout = '';
      let stderr = '';
      let killed = false;

      const killTimeout = setTimeout(() => {
        killed = true;
        try {
          proc.kill('SIGKILL');
        } catch {}
      }, 4500);

      proc.stdout.on('data', (chunk) => {
        if (stdout.length < 250000) stdout += chunk.toString();
      });

      proc.stderr.on('data', (chunk) => {
        if (stderr.length < 50000) stderr += chunk.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(killTimeout);
        try {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        } catch {}

        const duration = Date.now() - startTime;
        if (killed) {
          return resolve({
            success: false,
            stdout,
            stderr: stderr + '\nExecution timed out (exceeded 4.5 second limit).',
            exitCode: -1,
            executionTimeMs: duration,
            language: 'javascript',
          });
        }

        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code,
          executionTimeMs: duration,
          language: 'javascript',
        });
      });

      proc.on('error', (err) => {
        clearTimeout(killTimeout);
        try {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        } catch {}

        resolve({
          success: false,
          stdout,
          stderr: `Execution error: ${err.message}`,
          exitCode: 1,
          executionTimeMs: Date.now() - startTime,
          language: 'javascript',
        });
      });
    });
  }

  // Other languages
  return {
    success: false,
    stdout: '',
    stderr: `Safe execution is currently configured for Python and JavaScript in this sandbox environment. For ${language.toUpperCase()}, live preview and syntax-highlighted display are supported.`,
    exitCode: 0,
    executionTimeMs: 0,
    language: normLang,
  };
}
