import * as chai from 'chai';
import * as sinon from 'sinon';
import sinonChai from 'sinon-chai';
import VirtualWssConnectionManager from '../../src/virtual_wss_connection_manager';

chai.use(sinonChai);
const expect = chai.expect;

describe('VirtualWssConnectionManager', () => {
    let sandbox: sinon.SinonSandbox;
    let logger: any;
    let unsubscribe: sinon.SinonStub;
    let wssManager: any;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        logger = {
            info: sandbox.stub(),
            error: sandbox.stub(),
        };
        unsubscribe = sandbox.stub();
        wssManager = {
            subscribeTopics: sandbox.stub(),
            onMessage: sandbox.stub().returns(unsubscribe),
            sendMessage: sandbox.stub(),
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    function makeManager() {
        return new VirtualWssConnectionManager(logger, 'conn-1', wssManager);
    }

    describe('close', () => {
        it('unsubscribes from the softphone topic on first close', () => {
            const mgr = makeManager();

            mgr.close();

            expect(unsubscribe).to.have.been.calledOnce;
            expect(logger.info).to.have.been.calledWith('closing virtual connection');
        });

        it('is idempotent: a second close does not call unsubscribe again and does not throw', () => {
            const mgr = makeManager();

            mgr.close();
            unsubscribe.resetHistory();

            expect(() => mgr.close()).to.not.throw();
            expect(unsubscribe).to.not.have.been.called;
        });

        it('logs that the connection is already closed on a redundant close', () => {
            const mgr = makeManager();

            mgr.close();
            logger.info.resetHistory();
            mgr.close();

            expect(logger.info).to.have.been.calledWith('virtual connection already closed, skipping unsubscribe');
        });
    });
});
