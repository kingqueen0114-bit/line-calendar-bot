/**
 * GitHub API integration for dev agent
 * Handles webhooks, PR creation, and repository operations
 */

import crypto from 'crypto';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'yuiyane';
const REPO_NAME = process.env.GITHUB_REPO_NAME || 'line-calendar-bot';

/**
 * Verify GitHub webhook signature
 */
export function verifyGitHubSignature(payload, signature) {
  if (!GITHUB_WEBHOOK_SECRET || !signature) {
    console.warn('GitHub webhook secret or signature missing');
    return false;
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', GITHUB_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

/**
 * Process GitHub webhook events
 */
export async function processGitHubWebhook(event, payload) {
  switch (event) {
    case 'issues':
      return handleIssueEvent(payload);
    case 'issue_comment':
      return handleIssueComment(payload);
    case 'pull_request':
      return handlePullRequestEvent(payload);
    case 'push':
      return handlePushEvent(payload);
    default:
      return { ignored: true, event };
  }
}

/**
 * Handle issue events (opened, edited, labeled)
 */
async function handleIssueEvent(payload) {
  const { action, issue } = payload;

  if (action === 'opened' || action === 'labeled') {
    // Check for auto-dev label
    const hasAutoDevLabel = issue.labels?.some(
      l => l.name === 'auto-dev' || l.name === 'claude-agent'
    );

    if (hasAutoDevLabel) {
      return {
        task: {
          id: `issue-${issue.number}`,
          title: issue.title,
          description: issue.body || '',
          type: categorizeIssue(issue),
          priority: getPriority(issue),
          source: 'github-issue',
          issueNumber: issue.number,
          issueUrl: issue.html_url,
          status: 'pending',
          createdAt: new Date().toISOString()
        }
      };
    }
  }

  return { ignored: true, reason: 'No auto-dev label or not an open action' };
}

/**
 * Handle issue comments (for @claude-agent mentions)
 */
async function handleIssueComment(payload) {
  const { action, comment, issue } = payload;

  if (action !== 'created') {
    return { ignored: true };
  }

  // Check for @claude-agent mention
  if (comment.body?.includes('@claude-agent') || comment.body?.includes('@dev-agent')) {
    return {
      task: {
        id: `comment-${comment.id}`,
        title: `Comment request on #${issue.number}`,
        description: comment.body,
        type: 'comment-request',
        priority: 'high',
        source: 'github-comment',
        issueNumber: issue.number,
        commentId: comment.id,
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    };
  }

  return { ignored: true };
}

/**
 * Handle pull request events
 */
async function handlePullRequestEvent(payload) {
  const { action, pull_request } = payload;

  if (action === 'opened' && pull_request.body?.includes('[auto-review]')) {
    return {
      task: {
        id: `pr-review-${pull_request.number}`,
        title: `Review PR #${pull_request.number}`,
        description: pull_request.body,
        type: 'pr-review',
        priority: 'high',
        source: 'github-pr',
        prNumber: pull_request.number,
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    };
  }

  return { ignored: true };
}

/**
 * Handle push events
 */
async function handlePushEvent(payload) {
  // Could trigger test runs or deployments
  return { ignored: true, event: 'push', ref: payload.ref };
}

/**
 * Categorize issue type based on labels and content
 */
function categorizeIssue(issue) {
  const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];
  const title = issue.title.toLowerCase();
  const body = (issue.body || '').toLowerCase();

  if (labels.includes('bug') || title.includes('bug') || title.includes('fix')) {
    return 'bugfix';
  }
  if (labels.includes('enhancement') || labels.includes('feature')) {
    return 'feature';
  }
  if (labels.includes('refactor')) {
    return 'refactor';
  }
  if (labels.includes('docs') || labels.includes('documentation')) {
    return 'docs';
  }
  if (labels.includes('test')) {
    return 'test';
  }

  return 'feature';
}

/**
 * Get priority from issue labels
 */
function getPriority(issue) {
  const labels = issue.labels?.map(l => l.name.toLowerCase()) || [];

  if (labels.includes('priority:critical') || labels.includes('urgent')) {
    return 'critical';
  }
  if (labels.includes('priority:high') || labels.includes('important')) {
    return 'high';
  }
  if (labels.includes('priority:low')) {
    return 'low';
  }

  return 'medium';
}

/**
 * GitHub API request helper
 */
async function githubRequest(endpoint, options = {}) {
  const url = endpoint.startsWith('https')
    ? endpoint
    : `https://api.github.com${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'dev-agent/1.0',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Get file content from repository
 */
export async function getFileContent(path, ref = 'main') {
  try {
    const data = await githubRequest(
      `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${ref}`
    );
    return Buffer.from(data.content, 'base64').toString('utf-8');
  } catch (error) {
    if (error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

/**
 * Create a new branch
 */
export async function createBranch(branchName, baseBranch = 'main') {
  // Get base branch SHA
  const baseRef = await githubRequest(
    `/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/${baseBranch}`
  );

  // Create new branch
  await githubRequest(
    `/repos/${REPO_OWNER}/${REPO_NAME}/git/refs`,
    {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseRef.object.sha
      })
    }
  );

  return branchName;
}

/**
 * Create or update a file in the repository
 */
export async function createOrUpdateFile(path, content, message, branch) {
  // Check if file exists
  let sha;
  try {
    const existing = await githubRequest(
      `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${branch}`
    );
    sha = existing.sha;
  } catch {
    // File doesn't exist
  }

  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch
  };

  if (sha) {
    body.sha = sha;
  }

  return githubRequest(
    `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
    {
      method: 'PUT',
      body: JSON.stringify(body)
    }
  );
}

/**
 * Create a pull request
 */
export async function createPullRequest(title, body, head, base = 'main') {
  return githubRequest(
    `/repos/${REPO_OWNER}/${REPO_NAME}/pulls`,
    {
      method: 'POST',
      body: JSON.stringify({
        title,
        body,
        head,
        base
      })
    }
  );
}

/**
 * Add a comment to an issue or PR
 */
export async function addComment(issueNumber, body) {
  return githubRequest(
    `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ body })
    }
  );
}

/**
 * Close an issue
 */
export async function closeIssue(issueNumber) {
  return githubRequest(
    `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed' })
    }
  );
}

/**
 * Get repository tree (file list)
 */
export async function getRepoTree(path = '', ref = 'main') {
  const tree = await githubRequest(
    `/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${ref}?recursive=1`
  );

  if (path) {
    return tree.tree.filter(item => item.path.startsWith(path));
  }

  return tree.tree;
}
