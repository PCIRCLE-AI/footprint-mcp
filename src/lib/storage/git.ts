import git from 'isomorphic-git';
import fs from 'fs';
import path from 'path';

/**
 * Git commit information
 */
export interface GitInfo {
  commitHash: string; // Full SHA-1 hash
  timestamp: string; // ISO 8601 format
  message?: string; // Commit message (optional)
  author?: string; // Author name (optional)
}

/**
 * Find git root directory by walking up the directory tree
 * @param startDir - Starting directory
 * @returns Git root directory or null if not found
 */
async function findGitRoot(startDir: string): Promise<string | null> {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const gitDir = path.join(currentDir, '.git');
    if (fs.existsSync(gitDir)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}

/**
 * Get current Git commit information with proper error logging
 * @param dir - Directory path (defaults to process.cwd())
 * @returns GitInfo or null if not a git repository
 */
export async function getCurrentCommit(
  dir: string = process.cwd(),
): Promise<GitInfo | null> {
  try {
    // Find git root directory
    const gitRoot = await findGitRoot(dir);
    if (!gitRoot) {
      console.warn(`[Git] Not a git repository: ${dir}`);
      return null;
    }

    // Get current commit SHA
    const commits = await git.log({
      fs,
      dir: gitRoot,
      depth: 1,
    });

    if (commits.length === 0) {
      console.warn(`[Git] No commits found in repository: ${gitRoot}`);
      return null;
    }

    const commit = commits[0];

    return {
      commitHash: commit.oid,
      timestamp: new Date(commit.commit.committer.timestamp * 1000).toISOString(),
      message: commit.commit.message,
      author: commit.commit.author.name,
    };
  } catch (error) {
    // Log specific error for debugging
    console.error(
      `[Git] Failed to get commit info from ${dir}:`,
      error instanceof Error ? error.message : String(error)
    );
    return null;
  }
}
