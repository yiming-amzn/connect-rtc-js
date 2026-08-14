/**
 * By using the Citrix ucsdk (https://www.npmjs.com/package/@citrix/ucsdk), you are accepting the Citrix Developer Terms of Use  located here: https://www.cloud.com/terms-of-use.
 */

import CCPInitiationStrategyInterface from "./CCPInitiationStrategyInterface";
import { FailedState } from "../rtc_session";
import { RTC_ERRORS } from "../rtc_const";
import {CITRIX_413, CITRIX_SDK_310, CITRIX_SDK_413, CITRIX_VDI_STRATEGY, ONE_SEC_IN_MILLIS, CITRIX} from "../config/constants";

const CITRIX_READY_TIMEOUT_MS = 10000;

/**
 * Custom error class for timeout scenarios
 */
class TimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TimeoutError';
        this.isTimeout = false;
    }
}

export default class CitrixVDIStrategy extends CCPInitiationStrategyInterface {

    /**
     * @param {boolean} useRealCitrix - Whether to use real Citrix SDK or a mock
     * @param {string} vdiPlatform - The VDI platform type, e.g. "CITRIX", "CITRIX_413".
     *                              Defaults to "CITRIX" which uses the 3.1 SDK.
     */
    constructor(vdiPlatform = CITRIX, useRealCitrix = true) {
        super(); // sets this._logger to the CCP server logger (getLog(), no-op fallback in tests)

        this._loadedSdkVersion = null;

        if (useRealCitrix) {
            // SDK Version Selection Logic:
            // - Use 3.1 as default
            // - Use 4.1 opt in with CITRIX_413 VDIPlatform parameter

            try {
                // Only use CITRIX_413 if explicitly specified via parameter, otherwise default to CITRIX 310
                if (vdiPlatform === CITRIX_413) {
                    require("@citrix/ucsdk_4.1/CitrixWebRTC");
                    require("@citrix/ucsdk_4.1/CitrixBootstrap");
                    this._loadedSDKVersion = CITRIX_SDK_413;
                    this._logger.info(`CitrixVDIStrategy: Initializing with SDK version 4.1 (${CITRIX_SDK_413})`).sendInternalLogToServer();
                } else {
                    require("@citrix/ucsdk/CitrixWebRTC");
                    this._loadedSDKVersion = CITRIX_SDK_310;
                    this._logger.info(`CitrixVDIStrategy: Initializing with SDK version 3.1 (${CITRIX_SDK_310})`).sendInternalLogToServer();
                }
            } catch (error) {
                require("@citrix/ucsdk/CitrixWebRTC");
                this._loadedSDKVersion = CITRIX_SDK_310;
                this._logger.error(`CitrixVDIStrategy: Fallback to citrix 3.1 SDK due to error: ${error}`).sendInternalLogToServer();
            }
        }

        this._onConnectionNeedingCleanupHandler = () => {};

        // Connection-readiness state: resolved when vdiClientConnected event fires.
        this._resetConnectedPromise();

        this.initializeCitrix();

        // version is an Citrix object in following format
        // "version": {
        //     "type_script": "3.1.0",
        //         "webrpc": "1.7.0.0",
        //         "webrtc_codecs": "0.0.0.0",
        //         "receiver": "24.11.0.51",
        //         "vda": "0.0.0.0",
        //         "endpoint": "0.0.0.0",
        //         "osinfo": {
        //         "family": "Browser",
        //             "version": "15.3.1",
        //             "architecture": "",
        //             "distro": "",
        //             "edition": "Mac-Chrome(version:133.0.0.0, userAgent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36)"
        //     },
        //     "clientPlatform": "Browser"
        // }
        this.version = "UNKNOWN";
    }

    /**
     * Helper function to wrap getRedirectionState with a timeout
     * @param {number} timeoutMs - Timeout in milliseconds
     * @returns {Promise} Promise that resolves with redirection state or rejects on timeout
     */
    async getRedirectionStateWithTimeout(timeoutMs = 10 * ONE_SEC_IN_MILLIS) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                const timeoutError = new TimeoutError(`getRedirectionState timed out after ${timeoutMs}ms`);
                timeoutError.isTimeout = true;
                reject(timeoutError);
            }, timeoutMs);

            window.CitrixBootstrap.getRedirectionState()
                .then(result => {
                    clearTimeout(timeoutId);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    }

    async initializeCitrix() {
        this._logger.info(`CitrixVDIStrategy: [init] START (SDK: ${this._loadedSDKVersion})`).sendInternalLogToServer();
        if(this._loadedSDKVersion === CITRIX_SDK_413) {
            let redirectionCheckStartedAt = null;
            try {
                if (window.CitrixBootstrap && typeof window.CitrixBootstrap.getRedirectionState === 'function') {
                    // Initialize Bootstrap - it will handle automatic session reconnection
                    window.CitrixBootstrap.initBootstrap("AmazonConnect");
                    window.CitrixBootstrap.initLog(global.connect.getLog(), true);

                    redirectionCheckStartedAt = Date.now();
                    this._logger.info("CitrixVDIStrategy: [bootstrap redirection-state check] START").sendInternalLogToServer();
                    const redirectionState = await this.getRedirectionStateWithTimeout(10 * ONE_SEC_IN_MILLIS);
                    this._logger.info(`CitrixVDIStrategy: [bootstrap redirection-state check] SUCCEEDED after ${Date.now() - redirectionCheckStartedAt}ms (redirectionState: ${redirectionState})`).sendInternalLogToServer();

                    // RedirectionState -2 denotes unsupported VDA for bootstrap
                    if (redirectionState !== -2) {
                        this._bootstrapEnabled = true;
                        this._logger.info("CitrixVDIStrategy: [init] using bootstrap path (VDA supports bootstrap)").sendInternalLogToServer();
                        this.initCitrixWebRTC();
                        this.initLog();
                        this._logger.info("CitrixVDIStrategy: [init] DONE (bootstrap path)").sendInternalLogToServer();
                        return;
                    }
                    // redirectionState === -2: VDA does not support bootstrap
                    this._logger.info("CitrixVDIStrategy: [init] VDA incompatible with bootstrap (redirectionState -2), falling back to standard initialization").sendInternalLogToServer();
                } else {
                    this._logger.info("CitrixVDIStrategy: [init] Bootstrap SDK unavailable, falling back to standard initialization").sendInternalLogToServer();
                }
                this.initializeWithoutBootstrap();
                this._logger.info("CitrixVDIStrategy: [init] DONE (standard fallback path)").sendInternalLogToServer();

            } catch (error) {
                const elapsed = redirectionCheckStartedAt !== null ? `${Date.now() - redirectionCheckStartedAt}ms` : "n/a";
                if (error instanceof TimeoutError || error.isTimeout) {
                    this._logger.info(`CitrixVDIStrategy: [bootstrap redirection-state check] TIMED OUT after ${elapsed}, falling back to standard initialization`).sendInternalLogToServer();
                } else {
                    this._logger.error(`CitrixVDIStrategy: [bootstrap redirection-state check] FAILED after ${elapsed}, falling back to standard initialization: ${error}`).sendInternalLogToServer();
                }
                this.initializeWithoutBootstrap();
                this._logger.info("CitrixVDIStrategy: [init] DONE (standard fallback path after bootstrap error)").sendInternalLogToServer();
            }
        }
        else {
            this._logger.info("CitrixVDIStrategy: [init] using default Citrix 3.1 SDK (no bootstrap)").sendInternalLogToServer();
            this.initializeWithoutBootstrap();
            this._logger.info("CitrixVDIStrategy: [init] DONE (Citrix 3.1 path)").sendInternalLogToServer();
        }
    }

    initializeWithoutBootstrap() {
        this.deInitializeBootstrap();
        this.initCitrixWebRTC();
        this.initGetCitrixWebrtcRedir();
        this.initLog();
    }

    deInitializeBootstrap(){
        if (window.CitrixBootstrap) {
            window.CitrixBootstrap.deinitBootstrap("AmazonConnect");
        }
    }

    initCitrixWebRTC() {
        window.CitrixWebRTC.setVMEventCallback((event) => {
            if (event.event === 'vdiClientConnected') {
                this._recordConnectionStatusChange('connected');
                this._logger.info("CitrixVDIStrategy: vdiClientConnected event received").sendInternalLogToServer();
                if (!window.CitrixWebRTC.isFeatureOn("webrtc1.0")) {
                    const errorMsg = 'Citrix WebRTC redirection feature is NOT supported!';
                    this._logger.error(`CitrixVDIStrategy: ${errorMsg}`).sendInternalLogToServer();
                    this._connectedReject(new Error(errorMsg));
                    throw new Error(errorMsg);
                }
                this._logger.info("CitrixVDIStrategy: initialized").sendInternalLogToServer();
                this.version = event.version;
                this._connectedResolve();
            } else if (event.event === 'vdiClientDisconnected') {
                this._recordConnectionStatusChange('disconnected');
                this._logger.info(`CitrixVDIStrategy: vdiClientDisconnected event received. reason: ${event.reason}, msg: ${event.msg}`).sendInternalLogToServer();
                this._resetConnectedPromise();
                try {
                    this._onConnectionNeedingCleanupHandler(this);
                    this._logger.info("CitrixVDIStrategy: VDI disconnection event triggered for cleanup").sendInternalLogToServer();
                } catch (error) {
                    this._logger.error(`CitrixVDIStrategy: Error triggering VDI disconnection event for cleanup: ${error}`).sendInternalLogToServer();
                }

            }
        });
        window.CitrixWebRTC.initUCSDK("AmazonConnect");
    }
    initGetCitrixWebrtcRedir() {
        window.getCitrixWebrtcRedir = () => Promise.resolve(1);
    }

    initLog() {
        window.CitrixWebRTC.initLog(global.connect.getLog());
    }

    /**
     * Handler for connection cleanup event.
     * @param {Function} handler - The handler function to be called when connection needs cleanup
     */
    onConnectionNeedingCleanup(handler) {
        this._logger.info("CitrixVDIStrategy: Setting VDI disconnection handler").sendInternalLogToServer();
        if (typeof handler === 'function') {
            this._onConnectionNeedingCleanupHandler = handler;
            this._logger.info("CitrixVDIStrategy: Handler set successfully").sendInternalLogToServer();
        } else {
            this._logger.error("CitrixVDIStrategy: Invalid handler provided").sendInternalLogToServer();
        }
    }

    // the following functions are rtc_peer_connection_factory related functions
    // check if the browser supports early media connection
    _isEarlyMediaConnectionSupported() {
        // Citrix WebRTC SDK doesn't support early media connection
        return false;
    }

    _createRtcPeerConnection(rtcPeerConnectionConfig, rtcPeerConnectionOptionalConfig) {
        super._createRtcPeerConnection();
        return new window.CitrixWebRTC.CitrixPeerConnection(rtcPeerConnectionConfig, rtcPeerConnectionOptionalConfig);
    }

    // the following functions are rtc_session related functions
    _gUM(constraints) {
        return window.CitrixWebRTC.getUserMedia(constraints);
    }

    _enumerateDevices() {
        return window.CitrixWebRTC.enumerateDevices();
    }

    _addDeviceChangeListener(listener) {
        // Citrix fires the event on the navigator.mediaDevices event listener.
        window.navigator.mediaDevices.addEventListener("devicechange", listener);
    }

    _removeDeviceChangeListener(listener) {
        // Citrix fires the event on the navigator.mediaDevices event listener.
        window.navigator.mediaDevices.removeEventListener("devicechange", listener);
    }

    _createMediaStream(track) {
        return window.CitrixWebRTC.createMediaStream([track]);
    }

    addStream(_pc, stream) {
        stream.getTracks().forEach(track => {
            _pc.addTransceiver(track, {});
        });
    }

    setRemoteDescription(self, rtcSession) {
        if (this.version && this.version.clientPlatform === "Browser") {
            // ChromeOS does not support addIceCandidate yet.
            self._candidates.forEach(candidate => {
                if (candidate && typeof candidate.candidate === 'string' && candidate.candidate.trim() !== '') {
                    self._sdp += `a=${candidate.candidate}\n`;
                    self.logger.info('Updated SDP for ChromeOS', `a=${candidate.candidate}\n`);
                }
            });
        }

        const answerSessionDescription = self._createSessionDescription({ type: 'answer', sdp: self._sdp });

        rtcSession._pc.setRemoteDescription(answerSessionDescription, () => {
            var remoteCandidatePromises = Promise.all(self._candidates.map(function (candidate) {
                var remoteCandidate = self._createRemoteCandidate(candidate);
                self.logger.info('Adding remote candidate', remoteCandidate);
                return rtcSession._pc.addIceCandidate(remoteCandidate);
            }));
            remoteCandidatePromises.catch(reason => {
                self.logger.warn('Error adding remote candidate', reason);
            });
            rtcSession._sessionReport.setRemoteDescriptionFailure = false;
            self._remoteDescriptionSet = true;
            self._checkAndTransit();
        }, () => {
            rtcSession._stopSession();
            rtcSession._sessionReport.setRemoteDescriptionFailure = true;
            self.transit(new FailedState(rtcSession, RTC_ERRORS.SET_REMOTE_DESCRIPTION_FAILURE));
        });
    }

    // Todo: modify the sdp for ChromeOS here by adding a=candidate line, once pc.setConfiguration is supported for IceRestart
    setRemoteDescriptionForIceRestart(self, rtcSession) {
        const answerSessionDescription = self._createSessionDescription({ type: 'answer', sdp: self._sdp });

        rtcSession._pc.setRemoteDescription(answerSessionDescription, () => {
            var remoteCandidatePromises = Promise.all(self._candidates.map(function (candidate) {
                var remoteCandidate = self._createRemoteCandidate(candidate);
                self.logger.info('Adding remote candidate', remoteCandidate);
                return rtcSession._pc.addIceCandidate(remoteCandidate);
            }));
            remoteCandidatePromises.catch(reason => {
                self.logger.warn('Error adding remote candidate', reason);
            });
            self._remoteDescriptionSetForIceRestart = true;
            self._checkAndTransit();
        }, () => {
            if (self.logger && self.logger.error) {
                self.logger.error('Ice restart failed').sendInternalLogToServer();
            }
            self.onIceRestartFailure();
        });
    }

    onIceStateChange(evt, _pc) {
        return _pc.iceConnectionState;
    }

    onPeerConnectionStateChange(_pc) {
        return _pc.connectionState_;
    }

    _createPeerConnection(configuration, optionalConfiguration) {
        super._createRtcPeerConnection();
        return new window.CitrixWebRTC.CitrixPeerConnection(configuration, optionalConfiguration);
    }

    _ontrack(self, evt) {
        window.CitrixWebRTC.mapAudioElement(self._remoteAudioElement);
        if (evt.streams.length > 1) {
            self._logger.warn('CitrixVDIStrategy: Found more than 1 streams for ' + evt.track.kind + ' track ' + evt.track.id + ' : ' +
                evt.streams.map(stream => stream.id).join(','));
        }
        if (evt.track.kind === 'video' && self._remoteVideoElement) {
            self._remoteVideoElement.srcObject = evt.streams[0];
            self._remoteVideoStream = evt.streams[0];
        } else if (evt.track.kind === 'audio' && self._remoteAudioElement) {
            self._remoteAudioElement.srcObject = evt.streams[0];
            self._remoteAudioStream = evt.streams[0];
        }
        self._remoteAudioElement.play();
    }

    /**
     * Overrides the base summary to add Citrix-specific context: the loaded SDK version,
     * the VDI client version, and whether the bootstrap reconnection path is enabled.
     * (_recordConnectionStatusChange is inherited from CCPInitiationStrategyInterface.)
     */
    _connectionStatusSummary() {
        const context = `SDK: ${this._loadedSDKVersion || 'unknown'}, clientVersion: ${this.getVdiClientVersion() || 'unknown'}, bootstrapEnabled: ${!!this._bootstrapEnabled}`;
        if (!this._connectionStatusChangedAt) {
            return `status ${this._connectionStatus} (no change observed yet); ${context}`;
        }
        return `last ${this._connectionStatus} at ${this._connectionStatusChangedAt} UTC; ${context}`;
    }

    /**
     * Resolves when the Citrix VDI client is connected and ready for WebRTC operations.
     * Rejects if the client does not connect within CITRIX_READY_TIMEOUT_MS.
     */
    whenConnected() {
        this._logger.info(`CitrixVDIStrategy: whenConnected called; VDI connection ${this._connectionStatusSummary()}`).sendInternalLogToServer();
        return Promise.race([
            this._connectedPromise,
            new Promise((_, reject) => setTimeout(
                () => reject(new Error(`${this.getStrategyName()} did not connect within ${CITRIX_READY_TIMEOUT_MS}ms; VDI connection ${this._connectionStatusSummary()}`)),
                CITRIX_READY_TIMEOUT_MS
            ))
        ]);
    }

    _resetConnectedPromise() {
        this._connectedPromise = new Promise((resolve, reject) => {
            this._connectedResolve = resolve;
            this._connectedReject = reject;
        });
    }

    getStrategyName() {
        return CITRIX_VDI_STRATEGY;
    }

    getVdiClientVersion() {
        return (this.version && this.version.receiver) || null;
    }

}
