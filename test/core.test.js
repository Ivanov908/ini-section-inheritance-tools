import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIni, resolveInheritance } from '../src/index.js';

test('parses a simple section with key/value pairs', () => {
  const text = `[base]
name = base
version = 1`;
  const parsed = parseIni(text);
  assert.deepEqual(parsed.sections, [
    { name: 'base', parent: null, entries: [['name', 'base'], ['version', '1']] },
  ]);
});

test('parses inheritance directive', () => {
  const text = `[child : parent]
key = value`;
  const parsed = parseIni(text);
  assert.deepEqual(parsed.sections, [
    { name: 'child', parent: 'parent', entries: [['key', 'value']] },
  ]);
});

test('ignores comments and blank lines', () => {
  const text = `; comment
# another
[base]
; inline comment
key = value
`;
  const parsed = parseIni(text);
  assert.deepEqual(parsed.sections, [
    { name: 'base', parent: null, entries: [['key', 'value']] },
  ]);
});

test('throws on key/value outside a section', () => {
  const text = `key = value`;
  assert.throws(() => parseIni(text), /Key\/value pair outside of any section/);
});

test('throws on unrecognized line', () => {
  const text = `[section]
this is not valid`;
  assert.throws(() => parseIni(text), /Unrecognized line/);
});

test('resolves inheritance with child overriding parent', () => {
  const text = `[base]
a = 1
b = 2
[child : base]
b = 3
c = 4`;
  const parsed = parseIni(text);
  const result = resolveInheritance(parsed);
  assert.deepEqual(result, {
    base: { a: '1', b: '2' },
    child: { a: '1', b: '3', c: '4' },
  });
});

test('resolves multi-level inheritance', () => {
  const text = `[grand]
x = 1
[parent : grand]
y = 2
[child : parent]
z = 3`;
  const parsed = parseIni(text);
  const result = resolveInheritance(parsed);
  assert.deepEqual(result, {
    grand: { x: '1' },
    parent: { x: '1', y: '2' },
    child: { x: '1', y: '2', z: '3' },
  });
});

test('detects circular inheritance', () => {
  const text = `[a : b]
x = 1
[b : a]
y = 2`;
  const parsed = parseIni(text);
  assert.throws(() => resolveInheritance(parsed), /Circular inheritance detected/);
});

test('throws when parent section is missing', () => {
  const text = `[child : missing]
key = value`;
  const parsed = parseIni(text);
  assert.throws(() => resolveInheritance(parsed), /Inheritance references unknown section "missing"/);
});

test('handles sections with no entries', () => {
  const text = `[empty]
[child : empty]
key = value`;
  const parsed = parseIni(text);
  const result = resolveInheritance(parsed);
  assert.deepEqual(result, {
    empty: {},
    child: { key: 'value' },
  });
});

test('allows duplicate keys within a section, last one wins', () => {
  const text = `[base]
a = 1
a = 2`;
  const parsed = parseIni(text);
  const result = resolveInheritance(parsed);
  assert.deepEqual(result, { base: { a: '2' } });
});

test('handles whitespace around section and keys', () => {
  const text = `[  base  ]
  key  =  value  `;
  const parsed = parseIni(text);
  assert.deepEqual(parsed.sections, [
    { name: 'base', parent: null, entries: [['key', 'value']] },
  ]);
});

test('parses multiple sections and resolves them independently', () => {
  const text = `[a]
x = 1
[b]
y = 2
[c : a]
z = 3`;
  const parsed = parseIni(text);
  const result = resolveInheritance(parsed);
  assert.deepEqual(result, {
    a: { x: '1' },
    b: { y: '2' },
    c: { x: '1', z: '3' },
  });
});
