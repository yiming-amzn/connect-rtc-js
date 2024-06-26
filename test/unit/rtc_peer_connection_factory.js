/**
 * Copyright 2022 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import './test-setup';
import RtcPeerConnectionFactory from '../../src/js/rtc_peer_connection_factory';
import chai from 'chai';
import sinon from 'sinon';
import {RTC_PEER_CONNECTION_IDLE_TIMEOUT_MS} from "../../src/js/rtc_const";
import StandardStrategy from "../../src/js/strategies/StandardStrategy";

describe('RTC Peer Connection Factory', () => {

    sinon.stub(RtcPeerConnectionFactory.prototype, '_initializeWebSocketEventListeners').returns({});
    sinon.stub(RtcPeerConnectionFactory.prototype, '_networkConnectivityChecker').returns({});
    sinon.stub(RtcPeerConnectionFactory.prototype, '_isEarlyMediaConnectionSupported').returns(true);
    var createPeerConnectionStub = sinon.stub(RtcPeerConnectionFactory.prototype, '_createRtcPeerConnection').returns({});
    var requestAccessStub = sinon.stub().resolves('iceServer');

    describe('StandardStrategy', () => {
        var pcFactory = new RtcPeerConnectionFactory(console, null, null, requestAccessStub, sinon.stub(), new StandardStrategy());

        it('uses StandardStrategy', () => {
            chai.assert(console.log.calledWith('StandardStrategy initialized'));
        });

        it('check _peerConnectionRequestInFlight eventually resolves to false', async() => {
            await chai.assert(requestAccessStub.calledOnce);
            chai.assert(createPeerConnectionStub.calledOnce);
            chai.assert(createPeerConnectionStub.calledWith('iceServer'));
            chai.assert.isFalse(pcFactory._peerConnectionRequestInFlight);
        });

        it('check create peer connection is called when _peerConnectionRequestInFlight is false', async() => {
            requestAccessStub.resetHistory();
            createPeerConnectionStub.resetHistory();
            pcFactory._peerConnectionRequestInFlight = false;
            pcFactory._requestPeerConnection();
            chai.assert.isTrue(pcFactory._peerConnectionRequestInFlight);
            await chai.assert(requestAccessStub.calledOnce);
            chai.assert(createPeerConnectionStub.calledOnce);
            chai.assert(createPeerConnectionStub.calledWith('iceServer'));
            chai.assert.isFalse(pcFactory._peerConnectionRequestInFlight);
        });

        it('check create peer connection is not called when _peerConnectionRequestInFlight is false and request ICE access promise is not fulfilled', async() => {
            requestAccessStub.resetHistory();
            createPeerConnectionStub.resetHistory();
            pcFactory._peerConnectionRequestInFlight = false;
            requestAccessStub.rejects('error');
            pcFactory._requestPeerConnection();
            chai.assert.isTrue(pcFactory._peerConnectionRequestInFlight);
            await chai.assert(requestAccessStub.calledOnce);
            chai.assert(createPeerConnectionStub.notCalled);
            chai.assert.isFalse(pcFactory._peerConnectionRequestInFlight);
        });

        it('check create peer connection is not called when _peerConnectionRequestInFlight is true', () => {
            requestAccessStub.resetHistory();
            createPeerConnectionStub.resetHistory();
            pcFactory._peerConnectionRequestInFlight = true;
            pcFactory._requestPeerConnection();
            chai.assert(requestAccessStub.notCalled);
            chai.assert(createPeerConnectionStub.notCalled);
        });

        it('check clearIdleRtcPeerConnectionTimerId clears timer id', () => {
            pcFactory._idleRtcPeerConnectionTimerId = setTimeout(() => {console.log('clearIdleRtcPeerConnectionTimerIdTest');}, RTC_PEER_CONNECTION_IDLE_TIMEOUT_MS);
            chai.assert.isNotNull(pcFactory._idleRtcPeerConnectionTimerId);
            pcFactory.clearIdleRtcPeerConnectionTimerId();
            chai.assert.isNull(pcFactory._idleRtcPeerConnectionTimerId);
        });
    });
});