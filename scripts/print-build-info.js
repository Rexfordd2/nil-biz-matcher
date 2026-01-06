import { execSync } from 'node:child_process';
import process from 'node:process';

function tryExec(command) {
  try {
    const output = execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return output || null;
  } catch {
    return null;
  }
}

function parseRepoFromRemote(remoteUrl) {
  if (!remoteUrl) return null;
  // Handle SSH: git@github.com:owner/repo.git
  const sshMatch = remoteUrl.match(/^[\w.-]+@[\w.-]+:([^/]+)\/(.+?)(\.git)?$/);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2].replace(/\.git$/, '')}`;
  }
  // Handle HTTPS: https://github.com/owner/repo.git
  try {
    const url = new URL(remoteUrl.replace(/^git\+/, ''));
    const parts = url.pathname.replace(/^\/+/, '').split('/');
    if (parts.length >= 2) {
      const owner = parts[0];
      const repo = parts[1].replace(/\.git$/, '');
      return `${owner}/${repo}`;
    }
  } catch {
    // not a valid URL, ignore
  }
  return null;
}

const {
  VERCEL_GIT_COMMIT_SHA,
  VERCEL_GIT_COMMIT_REF,
  VERCEL_GIT_REPO_OWNER,
  VERCEL_GIT_REPO_SLUG,
} = process.env;

const envCommit = VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null;
const envBranch = VERCEL_GIT_COMMIT_REF || process.env.BRANCH || process.env.GIT_BRANCH || null;
const envRepo =
  (VERCEL_GIT_REPO_OWNER && VERCEL_GIT_REPO_SLUG && `${VERCEL_GIT_REPO_OWNER}/${VERCEL_GIT_REPO_SLUG}`) ||
  null;

const gitRemote = tryExec('git config --get remote.origin.url');
const gitBranch = envBranch || tryExec('git rev-parse --abbrev-ref HEAD');
const gitCommit = envCommit || tryExec('git rev-parse HEAD');
const repoName =
  envRepo ||
  parseRepoFromRemote(gitRemote) ||
  (process.env.npm_package_name ? `${process.env.npm_package_name}` : null);

const commitShort = gitCommit ? gitCommit.substring(0, 12) : '(unknown)';
const branchName = gitBranch || '(unknown)';
const remoteUrl = gitRemote || '(unavailable)';
const repoDisplay = repoName || '(unknown)';

const lines = [
  '===================== Deploy Diagnostics =====================',
  `Repo:    ${repoDisplay}`,
  `Remote:  ${remoteUrl}`,
  `Branch:  ${branchName}`,
  `Commit:  ${commitShort}`,
  '==============================================================',
];

console.log(lines.join('\n'));


