
// Resolve the CCP server logger, falling back to a no-op when constructing a strategy
// outside a CCP runtime (e.g. unit tests) so subclasses can log unconditionally.
// getLog().info(text) sends text to the CCP server log via .sendInternalLogToServer().
export function resolveStrategyLogger() {
    const noopLog = () => ({ sendInternalLogToServer() {} });
    return global.connect && global.connect.getLog
        ? global.connect.getLog()
        : { log: noopLog, info: noopLog, warn: noopLog, error: noopLog };
}

export default class CCPInitiationStrategyInterface {
    constructor() {
        this._logger = resolveStrategyLogger();
        // Last observed connection status and the UTC time it last changed. Subclasses that
        // wait on an underlying client connection (VDI strategies) call
        // _recordConnectionStatusChange() on connect/disconnect; whenConnected() surfaces it.
        this._connectionStatus = 'unknown';
        this._connectionStatusChangedAt = null;
        this._logger.info(`${this.getStrategyName()}: initialized`).sendInternalLogToServer();
    }

    /**
     * Record a connection status change ('connected' | 'disconnected') and the UTC time it
     * happened, then log it. Lets whenConnected() and other callers report when the underlying
     * client connection last changed.
     * @param {string} status
     */
    _recordConnectionStatusChange(status) {
        this._connectionStatus = status;
        this._connectionStatusChangedAt = new Date().toISOString();
        this._logger.info(`${this.getStrategyName()}: connection ${status} at ${this._connectionStatusChangedAt} UTC`).sendInternalLogToServer();
    }

    /**
     * Human-readable summary of the last known connection status and when it changed.
     */
    _connectionStatusSummary() {
        if (!this._connectionStatusChangedAt) {
            return `status ${this._connectionStatus} (no change observed yet)`;
        }
        return `last ${this._connectionStatus} at ${this._connectionStatusChangedAt} UTC`;
    }

    /**
     * Returns a promise that resolves when the strategy's underlying platform is connected
     * and ready for WebRTC operations (creating peer connections, calling getUserMedia).
     * Subclasses override to implement their own readiness semantics:
     *   - Non-VDI strategies resolve immediately.
     *   - VDI strategies wait for the underlying client connection event and may reject
     *     on a timeout.
     *
     * @returns {Promise<void>}
     */
    whenConnected() {
        this._logger.info(`${this.getStrategyName()}: whenConnected called; connection ${this._connectionStatusSummary()}`).sendInternalLogToServer();
        return Promise.resolve();
    }


    getStrategyName() {
        this._logger.error("CCPInitiationStrategyInterface: getStrategyName needs to be overridden").sendInternalLogToServer();
    }

    // the following functions are rtc_peer_connection_factory related functions
    // check if the browser supports early media connection
    _isEarlyMediaConnectionSupported() {
        this._logger.error("CCPInitiationStrategyInterface: _isEarlyMediaConnectionSupported needs to be overridden").sendInternalLogToServer();
    }

    _createRtcPeerConnection() {
        global.connect.activePeerConnectionCount++;
    }

    // the following functions are rtc_session related functions
    _gUM() {
        this._logger.error("CCPInitiationStrategyInterface: _gUM needs to be overridden").sendInternalLogToServer();
    }

    // the following functions are rtc_session related functions
    _createMediaStream() {
        this._logger.error("CCPInitiationStrategyInterface: _createMediaStream needs to be overridden").sendInternalLogToServer();
    }

    addStream() {
        this._logger.error("CCPInitiationStrategyInterface: addStream needs to be overridden").sendInternalLogToServer();
    }

    setRemoteDescription() {
        this._logger.error("CCPInitiationStrategyInterface: setRemoteDescription needs to be overridden").sendInternalLogToServer();
    }

    setRemoteDescriptionForIceRestart() {
        this._logger.error("CCPInitiationStrategyInterface: setRemoteDescriptionForIceRestart needs to be overridden").sendInternalLogToServer();
    }

    onIceStateChange() {
        this._logger.error("CCPInitiationStrategyInterface: onIceStateChange needs to be overridden").sendInternalLogToServer();
    }

    onPeerConnectionStateChange() {
        this._logger.error("CCPInitiationStrategyInterface: onPeerConnectionStateChange needs to be overridden").sendInternalLogToServer();
    }

    /**
     * Register a handler for connection cleanup events
     */
    // eslint-disable-next-line no-unused-vars
    onConnectionNeedingCleanup(handler) {
        this._logger.error("CCPInitiationStrategyInterface: onConnectionNeedingCleanup needs to be overridden").sendInternalLogToServer();
    }

    _createPeerConnection() {
        global.connect.activePeerConnectionCount++;
    }

    connect() {
        this._logger.error("CCPInitiationStrategyInterface: connect needs to be overridden").sendInternalLogToServer();
    }

    _ontrack() {
        this._logger.error("CCPInitiationStrategyInterface: _ontrack needs to be overridden").sendInternalLogToServer();
    }

    close(pc) {
        global.connect.activePeerConnectionCount--;
        pc.close();
    }

    _enumerateDevices() {
        this._logger.error("CCPInitiationStrategyInterface: _enumerateDevices needs to be overridden").sendInternalLogToServer();
    }

    _addDeviceChangeListener() {
        this._logger.error("CCPInitiationStrategyInterface: _addDeviceChangeListener needs to be overridden").sendInternalLogToServer();
    }

    _removeDeviceChangeListener() {
        this._logger.error("CCPInitiationStrategyInterface: _removeDeviceChangeListener needs to be overridden").sendInternalLogToServer();
    }

}
