export const UNDEFINED = 'undefined';
export const DCV_STRATEGY  = 'DCVStrategy';
export const AUDIO = 'audio';
export const  ANSWER = 'answer';
export const CHROME = 'chrome';
export const CITRIX_VDI_STRATEGY = 'CitrixVDIStrategy';
export const ONE_SEC_IN_MILLIS = 1000;
export const CITRIX_SDK_413 = 'CitrixSDK_413';
export const CITRIX_SDK_310 = 'CitrixSDK_310';
export const CITRIX_413 = 'CITRIX_413';
export const CITRIX = 'CITRIX';
export const AZURE_VDI_STRATEGY = 'AzureVDIStrategy';
export const AZURE = 'AZURE';

// window.name that Streams' PopupManager assigns to the CCP login popup.
// Mirrors connect.MasterTopics.LOGIN_POPUP in AmazonConnectStreams (src/event.js,
// makeNamespacedEnum('connect', ['loginPopup', ...])). Duplicated because RtcJS
// does not depend on Streams; keep in sync if that enum ever changes.
export const LOGIN_POPUP_WINDOW_NAME = 'connect::loginPopup';

