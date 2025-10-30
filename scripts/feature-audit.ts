import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const IGNORE = [
  'node_modules',
  '.next',
  '.git',
  'dist',
  'out',
  'coverage',
  path.join('prisma', 'migrations'),
];

type FeatureItem = { found: boolean; files: string[] };
type ApiRoutesItem = { found: string[]; files: string[] };

type Features = {
  referrals: FeatureItem;
  inviteComponent: FeatureItem;
  shareBadge: FeatureItem;
  badgesModel: FeatureItem;
  challengesModel: FeatureItem;
  weeklyChallenge: FeatureItem;
  leaderboard: FeatureItem;
  auth: FeatureItem;
  razorpayPayments: FeatureItem;
  prismaSchema: FeatureItem;
  prismaMigrations: FeatureItem;
  todoMarkers: FeatureItem;
  darkModeUsage: FeatureItem;
  apiRoutes: ApiRoutesItem;
  pagesProfile: FeatureItem;
  pagesRooms: FeatureItem;
};

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (IGNORE.some((i) => full.includes(path.join(ROOT, i)))) continue;
    if (e.isDirectory()) files = files.concat(walk(full));
    else files.push(full);
  }
  return files;
}

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

function scan() {
  const allFiles = walk(ROOT).filter((f) => /\.(js|ts|jsx|tsx|prisma|json|md)$/i.test(f));
  const features: Features = {
    referrals: { found: false, files: [] },
    inviteComponent: { found: false, files: [] },
    shareBadge: { found: false, files: [] },
    badgesModel: { found: false, files: [] },
    challengesModel: { found: false, files: [] },
    weeklyChallenge: { found: false, files: [] },
    leaderboard: { found: false, files: [] },
    auth: { found: false, files: [] },
    razorpayPayments: { found: false, files: [] },
    prismaSchema: { found: false, files: [] },
    prismaMigrations: { found: false, files: [] },
    todoMarkers: { found: false, files: [] },
    darkModeUsage: { found: false, files: [] },
    apiRoutes: { found: [], files: [] },
    pagesProfile: { found: false, files: [] },
    pagesRooms: { found: false, files: [] },
  };

  for (const f of allFiles) {
    let c: string;
    try {
      c = read(f);
    } catch {
      continue;
    }

    if (/\bTODO\b|\bFIXME\b/.test(c)) {
      features.todoMarkers.found = true;
      features.todoMarkers.files.push(f);
    }

    if (c.includes('dark:') || c.includes('darkMode') || c.includes('dark ')) {
      features.darkModeUsage.found = true;
      features.darkModeUsage.files.push(f);
    }

    if (f.endsWith('schema.prisma')) {
      features.prismaSchema.found = true;
      features.prismaSchema.files.push(f);
      if (/model\s+Referral\b/.test(c)) {
        features.referrals.found = true;
        features.referrals.files.push(f);
      }
      if (/model\s+Badge\b/.test(c)) {
        features.badgesModel.found = true;
        features.badgesModel.files.push(f);
      }
      if (/model\s+Challenge\b/.test(c) || /model\s+ChallengeParticipation\b/.test(c)) {
        features.challengesModel.found = true;
        features.challengesModel.files.push(f);
      }
    }

    if (f.includes(path.join('prisma', 'migrations'))) {
      features.prismaMigrations.found = true;
      features.prismaMigrations.files.push(f);
    }

    if (/InviteButton/i.test(c) || f.toLowerCase().includes('invitebutton')) {
      features.inviteComponent.found = true;
      features.inviteComponent.files.push(f);
    }
    if (/ShareBadge/i.test(c) || f.toLowerCase().includes('sharebadge')) {
      features.shareBadge.found = true;
      features.shareBadge.files.push(f);
    }
    if (/userBadge|UserBadge|badge.upsert|prisma\.badge/i.test(c)) {
      features.badgesModel.found = true;
      features.badgesModel.files.push(f);
    }
    if (/WeeklyChallenge/i.test(c) || f.toLowerCase().includes('weeklychallenge')) {
      features.weeklyChallenge.found = true;
      features.weeklyChallenge.files.push(f);
    }
    if (/Leaderboard/i.test(c) || f.toLowerCase().includes('leaderboard')) {
      features.leaderboard.found = true;
      features.leaderboard.files.push(f);
    }
    if (/next-auth|getServerSession|AuthModal|AuthRedeemOnSignIn|magic|verify-code/i.test(c)) {
      features.auth.found = true;
      features.auth.files.push(f);
    }
    if (/Razorpay|razorpay|stripe|payment|checkout|subscription/i.test(c)) {
      features.razorpayPayments.found = true;
      features.razorpayPayments.files.push(f);
    }

    if (
      f.includes(path.join('app', 'api')) &&
      /export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE)\s*\(/.test(c)
    ) {
      features.apiRoutes.files.push(f);
      if (!features.apiRoutes.found.includes(f)) features.apiRoutes.found.push(f);
    }

    if (
      f.match(/app[\/\\]profile[\/\\]page\./i) ||
      f.endsWith(path.join('app', 'profile', 'page.tsx'))
    ) {
      features.pagesProfile.found = true;
      features.pagesProfile.files.push(f);
    }
    if (
      f.match(/app[\/\\]rooms([\/\\]|\b)/i) ||
      f.match(/app[\/\\]rooms[\/\\]\[roomId\][\/\\]page\./i)
    ) {
      features.pagesRooms.found = true;
      features.pagesRooms.files.push(f);
    }

    if (/\/api\/referral|referral\.create|referral\.redeem|model\s+Referral/i.test(c)) {
      features.referrals.found = true;
      features.referrals.files.push(f);
    }
  }

  const implemented: string[] = [];
  const inProgress: string[] = [];
  const missing: string[] = [];

  if (features.referrals.found) implemented.push('Referrals / invite codes');
  else missing.push('Referrals / invite codes');
  if (features.inviteComponent.found) implemented.push('InviteButton UI');
  else missing.push('InviteButton UI');
  if (features.shareBadge.found || features.badgesModel.found)
    implemented.push('Share badge / badge model');
  else missing.push('Badges + Share feature');
  if (features.weeklyChallenge.found || features.challengesModel.found)
    implemented.push('Weekly Challenges (model + UI)');
  else missing.push('Weekly Challenges');
  if (features.leaderboard.found) implemented.push('Leaderboard UI/API');
  else missing.push('Leaderboard');
  if (features.auth.found) implemented.push('Authentication');
  else missing.push('Authentication');
  if (features.razorpayPayments.found) implemented.push('Payments (Razorpay or other)');
  else missing.push('Payments integration');
  if (features.prismaSchema.found) implemented.push('Prisma schema present');
  else missing.push('Prisma schema');
  if (features.prismaMigrations.found) implemented.push('Prisma migrations present');
  else inProgress.push('Prisma migrations (verify drift)');
  if (features.todoMarkers.found) inProgress.push('Files with TODO/FIXME markers');

  const report = {
    summary: { implemented, inProgress, missing },
    details: features,
    scannedFiles: allFiles.length,
    timestamp: new Date().toISOString(),
  };

  return report;
}

const result = scan();
const outPath = path.join(process.cwd(), 'feature-audit.json');
fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
console.log('Feature audit written to', outPath);
console.log('Summary:', JSON.stringify(result.summary, null, 2));
