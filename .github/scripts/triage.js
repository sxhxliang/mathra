// Labels and assigns issues and pull requests from their Conventional Commits title.
//   fix(latex): …   → bug, latex
//   feat(core)!: …  → enhancement, core, breaking
//   pgfmath: …      → pgfmath
// A title without a `prefix:` gets no label. Labels are only added, never removed.
// The author is assigned when the issue or pull request is opened.
// Run by .github/workflows/triage.yml through actions/github-script.

const TYPES = {
  fix: 'bug', bug: 'bug', feat: 'enhancement', feature: 'enhancement',
  docs: 'documentation', doc: 'documentation', perf: 'performance',
  refactor: 'refactor', test: 'test', tests: 'test', ci: 'ci', build: 'build',
  style: 'style', revert: 'revert', chore: 'chore', release: 'release',
  a11y: 'accessibility', deps: 'dependencies',
};
const ALIASES = { a11y: 'accessibility', deps: 'dependencies', docs: 'documentation', doc: 'documentation' };
const COLORS = {
  bug: 'd73a4a', enhancement: 'a2eeef', documentation: '0075ca', performance: 'fbca04',
  refactor: 'd4c5f9', test: 'bfd4f2', ci: '5319e7', build: '5319e7', style: 'd4c5f9',
  revert: 'e99695', chore: 'ededed', release: '0e8a16', accessibility: 'f143ab',
  dependencies: '0366d6', breaking: 'b60205',
};

function labelsFor(title) {
  const m = /^([A-Za-z][\w-]*)(?:\(([^)]+)\))?(!)?:\s/.exec(title.trim());
  if (!m) return [];
  const [, type, scope, bang] = m;
  const out = [TYPES[type.toLowerCase()] ?? type.toLowerCase()];
  for (const s of (scope ?? '').split(',')) {
    const name = s.trim().toLowerCase();
    if (name && name.length <= 30) out.push(ALIASES[name] ?? name);
  }
  if (bang) out.push('breaking');
  return [...new Set(out)];
}

async function triage({ github, context, core }) {
  const item = context.payload.issue ?? context.payload.pull_request;
  const { owner, repo } = context.repo;
  const issue_number = item.number;
  const edited = context.payload.action === 'edited';

  const labels = !edited || context.payload.changes?.title ? labelsFor(item.title) : [];
  for (const name of labels) {
    try {
      await github.rest.issues.getLabel({ owner, repo, name });
    } catch (e) {
      if (e.status !== 404) throw e;
      await github.rest.issues.createLabel({ owner, repo, name, color: COLORS[name] ?? 'c5def5' });
    }
  }
  if (labels.length) {
    await github.rest.issues.addLabels({ owner, repo, issue_number, labels });
    core.info(`labels: ${labels.join(', ')}`);
  }

  const author = item.user.login;
  if (!edited && item.user.type !== 'Bot' && !item.assignees.length) {
    try {
      await github.rest.issues.addAssignees({ owner, repo, issue_number, assignees: [author] });
      core.info(`assigned: ${author}`);
    } catch (e) {
      core.warning(`could not assign ${author}: ${e.message}`);
    }
  }
}

module.exports = { triage, labelsFor };
