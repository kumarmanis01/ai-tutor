// valid.js — uses lazy factories, should NOT trigger rule
function getRedis() {
  // pretend factory
  return {};
}

function getQueue(name) {
  const connection = getRedis();
  return { name, connection };
}

export function enqueueSomething() {
  const q = getQueue('content');
  q.add('job', { payload: true });
}
