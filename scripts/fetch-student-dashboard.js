(async () => {
  try {
    const res = await fetch('http://localhost:3000/student-home-dashboard');
    const text = await res.text();
    console.log('STATUS:', res.status);
    console.log('SNIPPET:', text.slice(0, 2000));
  } catch (err) {
    console.error('FETCH_ERROR', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
