/**
 * Test harness for recycle.js
 *
 * Run with: node recycle.test.mjs
 *
 * No external dependencies — uses a hand-rolled runner so the tests
 * are as portable as the module itself.
 */

import Recycle from './recycle.js';

// ---------------------------------------------------------------------------
// Minimal test runner
// ---------------------------------------------------------------------------

let passed = 0, failed = 0, currentSuite = '';

function suite(name) {
    currentSuite = name;
    console.log(`\n  ${name}`);
}

function assert(description, condition) {
    if (condition) {
        console.log(`    ✓  ${description}`);
        passed++;
    } else {
        console.error(`    ✗  ${description}`);
        failed++;
    }
}

function assertThrows(description, fn) {
    try {
        fn();
        console.error(`    ✗  ${description}  (expected a throw but none occurred)`);
        failed++;
    } catch {
        console.log(`    ✓  ${description}`);
        passed++;
    }
}

// Capture console.warn output so we can assert on it without noise.
const warnings = [];
const originalWarn = console.warn;
console.warn = (...args) => warnings.push(args.join(' '));

function lastWarning() {
    return warnings[warnings.length - 1] ?? '';
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Plain constructor function
function Vec2(x = 0, y = 0) {
    this.x = x;
    this.y = y;
}

// ES6 class — the new case added in recycle.js
class Particle {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.active = false;
    }
    init(x, y) {
        this.x = x;
        this.y = y;
        this.active = true;
    }
    reset() {
        this.x = 0;
        this.y = 0;
        this.active = false;
    }
}

// Class with private fields — the hardest case for Object.create()
class Token {
    #value = null;
    setValue(v) { this.#value = v; }
    getValue()  { return this.#value; }
}

// ---------------------------------------------------------------------------
// Helper: fresh cache name per test to avoid cross-test pollution
// ---------------------------------------------------------------------------
let _uid = 0;
const uid = () => `test_${_uid++}`;

// ---------------------------------------------------------------------------
// Suite 1 – guard rails
// ---------------------------------------------------------------------------

suite('Guard rails');

{
    const result = Recycle.add(Vec2, '');
    assert('returns null when name is omitted', result === null);
    assert('emits a warning when name is omitted', lastWarning().includes('Must define a name'));
}

{
    const name = uid();
    const first  = Recycle.add(Vec2, name);
    const second = Recycle.add(Vec2, name);
    assert('returns the same cache for duplicate registrations of the same class', first === second);
}

{
    const name = uid();
    Recycle.add(Vec2, name);
    Recycle.add(Particle, name); // different class, same name
    assert('warns on name collision with a different class', lastWarning().includes('already a cache named'));
}

// ---------------------------------------------------------------------------
// Suite 2 – plain constructor function
// ---------------------------------------------------------------------------

suite('Plain constructor function');

{
    const cache = Recycle.add(Vec2, uid());
    const obj = cache.setUp();
    assert('setUp returns an object', obj !== null && typeof obj === 'object');
    assert('instance has correct prototype', obj instanceof Vec2);
    assert('cache is empty after fresh setUp', cache.getLength() === 0);

    cache.recycle(obj);
    assert('cache length is 1 after recycle', cache.getLength() === 1);

    const reused = cache.setUp();
    assert('setUp returns the recycled instance', reused === obj);
    assert('cache is empty again after re-setUp', cache.getLength() === 0);
}

{
    const cache = Recycle.add(Vec2, uid(),
        function (x, y) { this.x = x; this.y = y; },  // setUp
        function ()      { this.x = 0; this.y = 0; }   // tearDown
    );
    const obj = cache.setUp(3, 7);
    assert('custom setUp receives arguments', obj.x === 3 && obj.y === 7);

    cache.recycle(obj);
    assert('custom tearDown resets properties', obj.x === 0 && obj.y === 0);
}

// ---------------------------------------------------------------------------
// Suite 3 – ES6 class (no setUp/tearDown)
// ---------------------------------------------------------------------------

suite('ES6 class — no setUp/tearDown');

{
    const cache = Recycle.add(Particle, uid());
    const p = cache.setUp();
    assert('setUp returns an instance of the class', p instanceof Particle);
    assert('constructor ran — default property present', p.active === false);

    p.init(10, 20);
    cache.recycle(p);
    assert('cache length is 1 after recycle', cache.getLength() === 1);

    const p2 = cache.setUp();
    assert('setUp returns the same instance from cache', p2 === p);
    assert('recycled instance still has mutated state (tearDown is caller\'s job without a tearDown fn)', p2.active === true);
}

// ---------------------------------------------------------------------------
// Suite 4 – ES6 class (with setUp/tearDown)
// ---------------------------------------------------------------------------

suite('ES6 class — with setUp/tearDown');

{
    const cache = Recycle.add(
        Particle,
        uid(),
        function (x, y) { this.init(x, y); },
        function ()      { this.reset();    }
    );

    const p = cache.setUp(5, 9);
    assert('custom setUp delegates to class method', p.x === 5 && p.y === 9 && p.active === true);

    cache.recycle(p);
    assert('custom tearDown delegates to class method', p.active === false && p.x === 0);

    const p2 = cache.setUp(1, 2);
    assert('re-setUp re-initialises the recycled instance', p2.x === 1 && p2.y === 2 && p2.active === true);
}

// ---------------------------------------------------------------------------
// Suite 5 – class with private fields
// ---------------------------------------------------------------------------

suite('Class with private fields');

{
    const cache = Recycle.add(
        Token,
        uid(),
        function (v) { this.setValue(v); },
        function ()  { this.setValue(null); }
    );

    const t = cache.setUp('hello');
    assert('private field accessible via accessor after setUp', t.getValue() === 'hello');

    cache.recycle(t);
    assert('private field reset by tearDown', t.getValue() === null);

    // Accessing a private field on an Object.create() shell throws;
    // confirming it does NOT throw here proves we used `new`.
    let threw = false;
    try { t.getValue(); } catch { threw = true; }
    assert('no TypeError from private field access (instance created with `new`)', !threw);
}

// ---------------------------------------------------------------------------
// Suite 6 – Array cache
// ---------------------------------------------------------------------------

suite('Array cache');

{
    const cache = Recycle.add(Array, uid());
    const arr = cache.setUp(1, 2, 3);
    assert('setUp returns an Array', Array.isArray(arr));
    assert('setUp fills array with arguments', arr[0] === 1 && arr[1] === 2 && arr[2] === 3);

    cache.recycle(arr);
    assert('cache length is 1 after recycle', cache.getLength() === 1);
    assert('recycle clears the array', arr.length === 0);

    const arr2 = cache.setUp(7, 8);
    assert('setUp returns the recycled array', arr2 === arr);
    assert('re-setUp fills array again', arr2[0] === 7 && arr2[1] === 8);
}

{
    // Nested array recycle (depth > 1)
    const cache = Recycle.add(Array, uid());
    const inner1 = cache.setUp(10, 20);
    const inner2 = cache.setUp(30, 40);
    const outer  = cache.setUp();
    outer[0] = inner1;
    outer[1] = inner2;
    outer.length = 2;

    cache.recycle(outer, 2);
    assert('depth-2 recycle clears outer array',  outer.length  === 0);
    assert('depth-2 recycle clears inner arrays', inner1.length === 0 && inner2.length === 0);
    assert('cache length is 3 after depth-2 recycle', cache.getLength() === 3);
}

// ---------------------------------------------------------------------------
// Suite 7 – mixinMethods
// ---------------------------------------------------------------------------

suite('mixinMethods');

{
    class Bullet {
        constructor() { this.speed = 0; }
    }
    const name = uid();
    Recycle.add(
        Bullet,
        name,
        function (s) { this.speed = s; },
        function ()  { this.speed = 0; },
        true  // mixinMethods
    );

    assert('static setUp mixed onto class', typeof Bullet.setUp === 'function');
    assert('static recycle mixed onto class', typeof Bullet.recycle === 'function');
    assert('prototype recycle mixed onto class', typeof Bullet.prototype.recycle === 'function');

    const b = Bullet.setUp(99);
    assert('static setUp works via mixin', b.speed === 99);

    b.recycle();
    assert('prototype recycle works via mixin', b.speed === 0);

    const b2 = Bullet.setUp(42);
    assert('static recycle returns the cached instance', b2 === b);
}

// ---------------------------------------------------------------------------
// Suite 8 – debug mode
// ---------------------------------------------------------------------------

suite('Debug mode');

{
    const cache = Recycle.add(Vec2, uid(), null, null, false, true /* debug */);
    const obj = cache.setUp();
    assert('debug setUp adds recycled=false property', obj.recycled === false);

    cache.recycle(obj);
    assert('debug recycle sets recycled=true', obj.recycled === true);

    // Recycling the same object twice should warn
    const warnsBefore = warnings.length;
    cache.recycle(obj);
    assert('double-recycle emits a warning in debug mode', warnings.length > warnsBefore && lastWarning().includes('already been recycled'));
}

{
    // Debug mode for classes
    const cache = Recycle.add(Particle, uid(), null, null, false, true);
    const p = cache.setUp();
    assert('debug setUp works for class instances', p instanceof Particle && p.recycled === false);
    cache.recycle(p);
    assert('debug recycle works for class instances', p.recycled === true);
}

{
    // Debug mode for arrays: warns on non-array push
    const cache = Recycle.add(Array, uid(), null, null, false, true);
    const warnsBefore = warnings.length;
    cache.recycle({});  // not an array
    assert('debug array cache warns on non-Array recycle', warnings.length > warnsBefore && lastWarning().includes('non-Array'));
}

// ---------------------------------------------------------------------------
// Suite 9 – cache registry
// ---------------------------------------------------------------------------

suite('Cache registry');

{
    const name = uid();
    const cache = Recycle.add(Vec2, name);
    assert('cache is accessible via Recycle.cache[name]', Recycle.cache[name] === cache);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.warn = originalWarn; // restore

console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${passed + failed} tests — ${passed} passed, ${failed} failed`);
if (failed > 0) {
    console.error(`\n  ${failed} FAILURE(S) — see ✗ lines above.\n`);
    process.exit(1);
} else {
    console.log(`\n  All tests passed.\n`);
}
