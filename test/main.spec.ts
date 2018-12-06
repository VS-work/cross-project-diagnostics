import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { DiagnosticManager, LiftingDiagnosticManager, EndpointDiagnosticManager, getLevelAvailability } from '../src';
import { Level } from '../src';

chai.use(chaiAsPromised);

const expect = chai.expect;
const sandbox = sinon.createSandbox();

describe('logging', () => {
  afterEach(() => {
    sandbox.restore();
  });

  it('with 3 diagnistics manager', () => {
    const ws = new LiftingDiagnosticManager({module: 'ws', version: '1.0.0', requestId: '#Q001', level: Level.ALL});
    const wsreader = new LiftingDiagnosticManager({module: 'wsreader', version: '2.0.0', requestId: '#Q001', level: Level.ALL});
    const vizabi = new EndpointDiagnosticManager({module: 'vizabi', version: '3.0.0', requestId: '#Q001', level: Level.ALL});

    wsreader.addOutputTo(vizabi);
    ws.addOutputTo(wsreader);


    ws.debug('foo1', 'notice 1');
    wsreader.debug('foo2', 'notice 2');
    vizabi.debug('foo3', 'notice 3');

    expect(!!vizabi.content).to.be.true;
  });

  it('with 3 classes', () => {
    class Ws {
      private diag: LiftingDiagnosticManager;

      constructor(parentDiagnostic: DiagnosticManager) {
        this.diag = new LiftingDiagnosticManager({module: 'ws', version: '1.0.0', requestId: '#Q001', level: Level.ALL});
        this.diag.addOutputTo(parentDiagnostic);
      }

      go1() {
        this.diag.error('go1', 'some err', new Error('foo'));
        this.diag.warning('go1', 'some warn');
        this.diag.debug('go1', 'some info');
      }
    }

    class WsReader {
      private readonly diag: LiftingDiagnosticManager;

      constructor(parentDiagnostic: DiagnosticManager) {
        this.diag = new LiftingDiagnosticManager({module: 'wsreader', version: '2.0.0', requestId: '#Q001', level: Level.ALL});
        this.diag.addOutputTo(parentDiagnostic);
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
      private readonly diag: LiftingDiagnosticManager;

      constructor(parentDiagnostic: DiagnosticManager) {
        this.diag = new LiftingDiagnosticManager({module: 'vizabi', version: '3.0.0', requestId: '#Q001', level: Level.ALL});
        this.diag.addOutputTo(parentDiagnostic);
      }

      go3() {
        this.diag.error('go3', 'some err', new Error('foo'));
        this.diag.warning('go3', 'some warn');
        this.diag.debug('go3', 'some info');
        const wsReader = new WsReader(this.diag);
        wsReader.go2();
      }
    }


    const main = new EndpointDiagnosticManager({module: 'tools-page', version: '0.1.0', requestId: '#Q001', level: Level.ALL});

    const vizabi = new Vizabi(main);

    vizabi.go3();

    expect(!!main.content).to.be.true;
  });
});

describe('getLevelAvailability', () => {
  it('off-error', () => {
    expect(getLevelAvailability(Level.OFF, Level.ERROR)).to.be.false;
  });
  it('debug-error', () => {
    expect(getLevelAvailability(Level.DEBUG, Level.ERROR)).to.be.true;
  });
  it('warning-error', () => {
    expect(getLevelAvailability(Level.WARNING, Level.ERROR)).to.be.true;
  });
  it('error-error', () => {
    expect(getLevelAvailability(Level.ERROR, Level.ERROR)).to.be.true;
  });
  it('fatal-error', () => {
    expect(getLevelAvailability(Level.FATAL, Level.ERROR)).to.be.false;
  });
});
