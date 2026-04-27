const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const exts = ['.ts', '.tsx', '.js', '.jsx'];

const JOB_MAP = {
  "'pending'": 'JobStatus.Pending',
  '"pending"': 'JobStatus.Pending',
  "'running'": 'JobStatus.Running',
  '"running"': 'JobStatus.Running',
  "'failed'": 'JobStatus.Failed',
  '"failed"': 'JobStatus.Failed',
  "'completed'": 'JobStatus.Completed',
  '"completed"': 'JobStatus.Completed',
  "'cancelled'": 'JobStatus.Cancelled',
  '"cancelled"': 'JobStatus.Cancelled',
};

const APPROVAL_MAP = {
  "'approved'": 'ApprovalStatus.Approved',
  '"approved"': 'ApprovalStatus.Approved',
  "'rejected'": 'ApprovalStatus.Rejected',
  '"rejected"': 'ApprovalStatus.Rejected',
  "'draft'": 'ApprovalStatus.Draft',
  '"draft"': 'ApprovalStatus.Draft',
};

function walk(dir) {
  const results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function (file) {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      const base = path.basename(file);
      const skipDirs = ['node_modules', '.git', '.next', 'dist', 'build', 'out'];
      if (skipDirs.includes(base)) return;
      results.push(...walk(file));
    } else {
      if (exts.includes(path.extname(file))) results.push(file);
    }
  });
  return results;
}

function ensureImport(content) {
  if (content.includes("from '@/lib/ai-engine/types'")) return content;
  // place after other imports
  const lines = content.split('\n');
  let insertAt = 0;
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    if (lines[i].startsWith('import')) insertAt = i + 1;
  }
  const imp = "import { JobStatus, ApprovalStatus } from '@/lib/ai-engine/types'";
  lines.splice(insertAt, 0, imp);
  return lines.join('\n');
}

function transformFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  // let original = content; // preserved for debugging
  let changed = false;

  // Replace patterns like status: 'pending' or status: "pending"
  Object.entries(JOB_MAP).forEach(([k, v]) => {
    const re = new RegExp("(status\s*:\s*)" + k, 'g');
    if (re.test(content)) {
      content = content.replace(re, `$1${v}`);
      changed = true;
    }
    const re2 = new RegExp("(where:\s*\{[^}]*status\s*:\s*)" + k, 'g');
    if (re2.test(content)) {
      content = content.replace(re2, `$1${v}`);
      changed = true;
    }
    const re3 = new RegExp("(==|===|!=|!==|\bin\b|\bincludes\b)\\s*" + k, 'g');
    if (re3.test(content)) {
      content = content.replace(re3, match => match.replace(k, v));
      changed = true;
    }
  });

  Object.entries(APPROVAL_MAP).forEach(([k, v]) => {
    const re = new RegExp("(status\s*:\s*)" + k, 'g');
    if (re.test(content)) {
      content = content.replace(re, `$1${v}`);
      changed = true;
    }
    const re2 = new RegExp("(where:\s*\{[^}]*status\s*:\s*)" + k, 'g');
    if (re2.test(content)) {
      content = content.replace(re2, `$1${v}`);
      changed = true;
    }
    const re3 = new RegExp("(==|===|!=|!==|\bin\b|\bincludes\b)\\s*" + k, 'g');
    if (re3.test(content)) {
      content = content.replace(re3, match => match.replace(k, v));
      changed = true;
    }
  });

  if (changed) {
    // add import if missing
    if (!content.includes("from '@/lib/ai-engine/types'")) {
      content = ensureImport(content);
    }
    fs.writeFileSync(file, content, 'utf8');
    console.log('Patched', file);
  }
}

(function main() {
  const files = walk(ROOT);
  files.forEach(transformFile);
  console.log('Done');
})();
