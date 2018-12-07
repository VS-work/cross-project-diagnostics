# Gapminder Cross-project Diagnostics System

## Goal

To find out why a certain error or unexpected behavior over the Gapminder ecosystem (including Waffle Server,
Tools Page and Gapminder Offline) happened so that `Targeted User` can fix the bug causing the error as easy as possible.

## Definitions of Key Terms

This task is regarding the ability to collect and read diagnostic data over all `Gapminder ecosystem`.
The ecosystem contains different related projects (
[Waffle Server](https://github.com/Gapminder/waffle-server),
[Gapminder Tools Page](https://github.com/Gapminder/tools-page),
[Gapminder Offline](https://github.com/Gapminder/gapminder-offline),
[DDFcsv Reader](https://github.com/vizabi/vizabi-ddfcsv-reader), etc.).

All operations regarding the diagnostic process should be provided by a special instance (JS object) of `Diagnostic Agent`.

There are two kinds of `Diagnostic Agent`:
 * `Lifting Diagnostic Agent`
 * `Endpoint Diagnostic Agent`

The main purpose of `Lifting Diagnostic Agent`  is to collect its own data and transfer it to the parent `Diagnostic Agent`.

The main purpose of `Endpoint Diagnostic Agent` is to collect its own data and collect data from all
dependant `Diagnostic Agents` (both kinds of them), and gather all of the data.

The `Gapminder ecosystem` has two basic kinds of relations (data transmission approach) between projects:
 * `Internal relation` (between DDFcsv Reader and DDF Query Validator, for example)
 * `External relation` (between WS Reader and Waffle Server, for example).

The main difference between internal and external relation is that projects with internal relations
must be connected via the same context - V8 (node or browser) environment.
On the contrary, projects with external relations must be connected via an external protocol (HTTP, for example).

## Examples

Here is an example illustrates how to create different kinds of `Diagnostic Managers` and how they related each between other:

```typescript
import { LiftingDiagnosticManager, EndpointDiagnosticManager } from 'cross-project-diagnostics';

const ws = new LiftingDiagnosticManager({module: 'ws', version: '1.0.0', requestId: '#Q001', level: Level.ALL});
const wsreader = new LiftingDiagnosticManager({module: 'wsreader', version: '2.0.0', requestId: '#Q001', level: Level.ALL});
const vizabi = new EndpointDiagnosticManager({module: 'vizabi', version: '3.0.0', requestId: '#Q001', level: Level.ALL});

wsreader.addOutputTo(vizabi);
ws.addOutputTo(wsreader);

ws.debug('foo1', 'notice 1');
wsreader.debug('foo2', 'notice 2');
vizabi.debug('foo3', 'notice 3');

console.log(JSON.stringify(vizabi.content, null, 2));
```

Here is a recommended way to create different kinds of `Diagnostic Managers` via `createDiagnosticManagerOn`:

```typescript
import { LiftingDiagnosticManager, EndpointDiagnosticManager } from 'cross-project-diagnostics';

const vizabi: EndpointDiagnosticManager = createDiagnosticManagerOn('vizabi', '3.0.0').forRequest('#Q001').withSeverityLevel(Level.DEBUG);
const wsreader = createDiagnosticManagerOn('wsreader', '2.0.0').basedOn(vizabi);
const ws = createDiagnosticManagerOn('ws', '1.0.0').basedOn(wsreader);

ws.debug('foo1', 'notice 1');
wsreader.debug('foo2', 'notice 2');
vizabi.debug('foo3', 'notice 3');

console.log(JSON.stringify(vizabi.content, null, 2));
```

Important notes:
 * `createDiagnosticManagerOn(...).forRequest(...).withSeverityLevel(...)` produces EndpointDiagnosticManager
 * `createDiagnosticManagerOn(...).basedOn(...)` produces LiftingDiagnosticManager

Output for both cases is the following:
```
[
  {
    "module": "ws",
    "version": "1.0.0",
    "requestId": "#Q001",
    "funName": "foo1",
    "message": "notice 1",
    "level": "debug"
  },
  {
    "module": "wsreader",
    "version": "2.0.0",
    "requestId": "#Q001",
    "funName": "foo2",
    "message": "notice 2",
    "level": "debug"
  },
  {
    "module": "vizabi",
    "version": "3.0.0",
    "requestId": "#Q001",
    "funName": "foo3",
    "message": "notice 3",
    "level": "debug"
  }
]
```

Here is a more complicated example illustrates how to use `Diagnostic Manager` between different modules:

```typescript
import { DiagnosticManager, EndpointDiagnosticManager, createDiagnosticManagerOn } from 'cross-project-diagnostics';

class Ws {
  private diag: DiagnosticManager;

  constructor(parentDiagnostic: DiagnosticManager) {
    this.diag = createDiagnosticManagerOn('ws', '1.0.0').basedOn(parentDiagnostic);
  }

  go1() {
    this.diag.error('go1', 'some err', new Error('foo'));
    this.diag.warning('go1', 'some warn');
    this.diag.debug('go1', 'some info');
  }
}

class WsReader {
  private readonly diag: DiagnosticManager;

  constructor(parentDiagnostic: DiagnosticManager) {
    this.diag = createDiagnosticManagerOn('wsreader', '2.0.0').basedOn(parentDiagnostic);
  }

  go2() {
    this.diag.error('go2', 'some err', new Error('foo'));
    this.diag.warning('go2', 'some warn');
    this.diag.debug('go2', 'some info');
    const ws = new Ws(this.diag);
    ws.go1();
  }
}

class Vizabi {
  private readonly diag: DiagnosticManager;

  constructor(parentDiagnostic: DiagnosticManager) {
    this.diag = createDiagnosticManagerOn('vizabi', '3.0.0').basedOn(parentDiagnostic);
  }

  go3() {
    this.diag.error('go3', 'some err', new Error('foo'));
    this.diag.warning('go3', 'some warn');
    this.diag.debug('go3', 'some info');
    const wsReader = new WsReader(this.diag);
    wsReader.go2();
  }
}

const main = createDiagnosticManagerOn('tools-page', '0.1.0').forRequest('#Q001').withSeverityLevel(Level.DEBUG);
const vizabi = new Vizabi(main);

vizabi.go3();

console.log(JSON.stringify(main.content, null, 2));
```

Let's improve the following kind of code:

```typescript
this.diag.error('go1', 'some err', new Error('foo'));
this.diag.warning('go1', 'some warn');
this.diag.debug('go1', 'some info');
```

As we can see, the first parameter of diagnistic functions (error, warning and debug) is 'function name'. Obviously, we don't need to duplicate it.
`prepareDiagnosticFor` method resolves this issue:

```typescript
const { error, warning, debug } = this.diag.prepareDiagnosticFor('go1');

error('some err', new Error('foo'));
warning('some warn');
debug('some info');
```

Full example is here:

```typescript
class Ws {
  private diag: LiftingDiagnosticManager;

  constructor(parentDiagnostic: DiagnosticManager) {
    this.diag = createDiagnosticManagerOn('ws', '1.0.0').basedOn(parentDiagnostic);
  }

  go1() {
    const { error, warning, debug } = this.diag.prepareDiagnosticFor('go1');

    error('some err', new Error('foo'));
    warning('some warn');
    debug('some info');
  }
}

class WsReader {
  private readonly diag: LiftingDiagnosticManager;

  constructor(parentDiagnostic: DiagnosticManager) {
    this.diag = createDiagnosticManagerOn('wsreader', '2.0.0').basedOn(parentDiagnostic);
  }

  go2() {
    const { error, warning, debug } = this.diag.prepareDiagnosticFor('go2');

    error('some err', new Error('foo'));
    warning('some warn');
    debug('some info');

    const ws = new Ws(this.diag);
    ws.go1();
  }
}

class Vizabi {
  private readonly diag: LiftingDiagnosticManager;

  constructor(parentDiagnostic: DiagnosticManager) {
    this.diag = createDiagnosticManagerOn('vizabi', '3.0.0').basedOn(parentDiagnostic);
  }

  go3() {
    const { error, warning, debug } = this.diag.prepareDiagnosticFor('go3');

    error('some err', new Error('foo'));
    warning('some warn');
    debug('some info');

    const wsReader = new WsReader(this.diag);
    wsReader.go2();
  }
}

const main = createDiagnosticManagerOn('tools-page', '0.1.0').forRequest('#Q001').withSeverityLevel(Level.DEBUG);
const vizabi = new Vizabi(main);

vizabi.go3();

console.log(JSON.stringify(main.content, null, 2));
```

Output for example above is following:

```
[
  {
    "module": "vizabi",
    "version": "3.0.0",
    "requestId": "#Q001",
    "funName": "go3",
    "message": "some err",
    "level": "error",
    "attachment": <stacktrace for the error>
  },
  {
    "module": "vizabi",
    "version": "3.0.0",
    "requestId": "#Q001",
    "funName": "go3",
    "message": "some warn",
    "level": "warning"
  },
  {
    "module": "vizabi",
    "version": "3.0.0",
    "requestId": "#Q001",
    "funName": "go3",
    "message": "some info",
    "level": "debug"
  },
  {
    "module": "wsreader",
    "version": "2.0.0",
    "requestId": "#Q001",
    "funName": "go2",
    "message": "some err",
    "level": "error",
    "attachment": <stacktrace for the error>
  },
  {
    "module": "wsreader",
    "version": "2.0.0",
    "requestId": "#Q001",
    "funName": "go2",
    "message": "some warn",
    "level": "warning"
  },
  {
    "module": "wsreader",
    "version": "2.0.0",
    "requestId": "#Q001",
    "funName": "go2",
    "message": "some info",
    "level": "debug"
  },
  {
    "module": "ws",
    "version": "1.0.0",
    "requestId": "#Q001",
    "funName": "go1",
    "message": "some err",
    "level": "error",
    "attachment": <stacktrace for the error>
  },
  {
    "module": "ws",
    "version": "1.0.0",
    "requestId": "#Q001",
    "funName": "go1",
    "message": "some warn",
    "level": "warning"
  },
  {
    "module": "ws",
    "version": "1.0.0",
    "requestId": "#Q001",
    "funName": "go1",
    "message": "some info",
    "level": "debug"
  }
]
```
