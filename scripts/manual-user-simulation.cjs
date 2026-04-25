#!/usr/bin/env node
/**
 * scripts/manual-user-simulation.cjs
 *
 * Interactive CLI to simulate a single user session.
 * - Prompts for email
 * - Forages a NextAuth session cookie (requires NEXTAUTH_SECRET)
 * - Shows current `next-action` ruleId/action/topic
 * - Lets you choose: complete lesson, submit practice (random score), exit
 * - Re-fetches `next-action` after each action and prints updated state
 */

'use strict';

const readline = require('readline');
const { stdin: input, stdout: output } = require('process');
const rl = readline.createInterface({ input, output });
const path = require('path');

const BASE_URL = (
  process.env.BASE_URL ||
  process.env.NEXTAUTH_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

function question(prompt) {
  return new Promise((resolve) => rl.question(prompt, (ans) => resolve(ans.trim())));
}

async function getEncoder() {
  const mod = await import('next-auth/jwt');
  return mod.encode;
}

async function createSessionCookie(userId, email, name = 'Manual User') {
  if (!NEXTAUTH_SECRET) throw new Error('NEXTAUTH_SECRET is not set');
  const encode = await getEncoder();
  const now = Math.floor(Date.now() / 1000);
  const token = await encode({
    token: {
      sub: userId,
      id: userId,
      email,
      name,
      role: 'user',
      iat: now,
      exp: now + 3600,
      jti: `manual-${userId}-${now}`,
    },
    secret: NEXTAUTH_SECRET,
    maxAge: 3600,
  });
  const cookieName = BASE_URL.startsWith('https')
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';
  return `${cookieName}=${token}`;
}

let _fetch = global.fetch;
if (!_fetch) {
  try {
    _fetch = require('node-fetch');
  } catch (e) {
    /* will error later */
  }
}

async function apiGet(path, cookie) {
  if (!_fetch) throw new Error('fetch not available (Node <18) and node-fetch not installed');
  const url = `${BASE_URL}${path}`;
  const res = await _fetch(url, {
    method: 'GET',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function apiPost(path, cookie, payload) {
  if (!_fetch) throw new Error('fetch not available (Node <18) and node-fetch not installed');
  const url = `${BASE_URL}${path}`;
  const res = await _fetch(url, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

function prettyAction(body) {
  if (!body) return 'no body';
  const ruleId = body.ruleId || (body.action && body.action.ruleId) || body.rule || null;
  const actionType = body.kind || body.type || (body.action && body.action.type) || null;
  const topic = body.topic || (body.action && (body.action.topic || body.action.topicId)) || null;
  return { ruleId, actionType, topic, raw: body };
}

async function main() {
  try {
    const email = await question('Enter email: ');
    let cookie = null;

    if (NEXTAUTH_SECRET) {
      // Create a lightweight user id using email
      const userId = `manual-${email.replace(/[^a-z0-9]/gi, '-')}`;
      try {
        cookie = await createSessionCookie(userId, email);
        console.log('Session cookie forged.');
      } catch (e) {
        console.error('Failed to forge session:', e && e.message ? e.message : e);
      }
    } else {
      console.log('NEXTAUTH_SECRET not set. You must paste a session cookie.');
      const provided = await question('Paste session cookie (name=value): ');
      cookie = provided;
    }

    if (!cookie) {
      console.error('No session cookie available. Exiting.');
      rl.close();
      process.exit(1);
    }

    // initial next-action
    const initial = await apiGet('/api/home/next-action', cookie);
    const info = prettyAction(initial.body);
    console.log('Current next-action:');
    console.log('  ruleId:', info.ruleId);
    console.log('  actionType:', info.actionType);
    console.log('  topic:', info.topic);

    // interactive loop
    while (true) {
      console.log('\nChoose action:');
      console.log('  1) Complete lesson');
      console.log('  2) Submit practice (random score)');
      console.log('  3) Exit');
      const choice = await question('> ');
      if (choice === '1') {
        // send complete-action
        // try to pull id from last next-action
        const last = await apiGet('/api/home/next-action', cookie);
        const payload = {};
        if (last && last.body && (last.body.id || (last.body.action && last.body.action.id))) {
          payload.id = last.body.id || last.body.action.id;
        }
        const res = await apiPost('/api/home/complete-action', cookie, payload);
        console.log('complete-action status:', res.status);
        console.log('response body:', JSON.stringify(res.body, null, 2));
      } else if (choice === '2') {
        // submit practice with random answers
        // craft a small payload
        const answers = [{ q: 'sim', ans: Math.random() < 0.5 ? 'A' : 'B' }];
        const payload = { answers, meta: { simulated: true } };
        const res = await apiPost('/api/tests/submit', cookie, payload);
        console.log('tests/submit status:', res.status);
        console.log('response body:', JSON.stringify(res.body, null, 2));
      } else if (choice === '3') {
        console.log('Exiting.');
        rl.close();
        process.exit(0);
      } else {
        console.log('Unknown choice. Try again.');
      }

      // re-call next-action and display
      const next = await apiGet('/api/home/next-action', cookie);
      const ninfo = prettyAction(next.body);
      console.log('\nUpdated next-action:');
      console.log('  ruleId:', ninfo.ruleId);
      console.log('  actionType:', ninfo.actionType);
      console.log('  topic:', ninfo.topic);
    }
  } catch (e) {
    console.error('Fatal error:', e && e.stack ? e.stack : e);
    rl.close();
    process.exit(1);
  }
}

main();
