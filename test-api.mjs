const res = await fetch('http://localhost:3000/api/settings/test-line', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ cat: "x", uid: "y" })
}).catch(e => e.message);
console.log('Result:', res);
