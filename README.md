# ini-section-inheritance-tools

Parses INI files that support section inheritance directives of the form `[child : parent]` and produces merged configuration objects.

```js
import { parseIni, resolveInheritance } from 'ini-section-inheritance-tools';

const text = `
[base]
host = localhost
port = 5432

[production : base]
host = db.example.com
`;

const parsed = parseIni(text);
const config = resolveInheritance(parsed);

console.log(config.production);
// { host: 'db.example.com', port: '5432' }
```

## Why this exists

Plain INI has no way to express shared defaults. You either duplicate values across sections or write your own merge layer. This library adds one directive — `[child : parent]` — and resolves the inheritance graph into plain objects. The trade-off is that it only supports a single parent per section. Multiple inheritance would require a conflict-resolution rule, and any rule we picked would surprise half the users. One parent keeps the semantics obvious: the child overrides the parent, and the parent's own ancestors are applied before that.

## The awkward edge

Inheritance cycles are rejected with an error. If `a` inherits from `b` and `b` inherits from `a`, `resolveInheritance` throws `Circular inheritance detected involving section "a"` rather than looping forever. The same applies to a missing parent: you get `Inheritance references unknown section "missing"`.
