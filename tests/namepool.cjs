const assert = require('node:assert/strict');
const { POOL, WU_XING, pickGivenName } = require('../js/namepool.js');
assert(POOL.all.length >= 350);
assert.equal(new Set(POOL.all.map(e => e.c)).size, POOL.all.length);
for (const e of POOL.all) {
  assert.equal([...e.c].length, 1); assert(e.p && typeof e.p === 'string');
  assert(Number.isInteger(e.s) && e.s > 0); assert(WU_XING[e.w]);
  assert([0, 1].includes(e.b)); assert(['xiangxing','xingsheng','huiyi','zhishi'].includes(e.cat));
}
for (const want of [null, ...Object.keys(WU_XING)]) {
  for (const count of [1, 2]) {
    for (let i = 0; i < 1000; i++) {
      const name = pickGivenName({want, count});
      assert.equal(name.chars.length, count);
      assert.equal(new Set(name.chars.map(e=>e.c)).size, count);
      assert(name.chars.every(e => !want || e.w === want));
    }
    const impossible = pickGivenName({want, count, minStrokes: 99, maxStrokes: 0});
    assert.equal(impossible.chars.length, count);
    assert(impossible.chars.every(e => !want || e.w === want));
  }
}
const preferred = POOL.all.find(e=>e.w==='水');
assert.equal(pickGivenName({count: 1, preferred: [preferred]}).chars[0].c, preferred.c);
assert(pickGivenName({want:'火',count:2,preferred:[preferred]}).chars.every(e=>e.w==='火'));
console.log(JSON.stringify({total:POOL.all.length,duplicates:0,elements:Object.fromEntries(Object.keys(WU_XING).map(w=>[w,POOL.all.filter(e=>e.w===w).length])),samplingCases:12000}));
