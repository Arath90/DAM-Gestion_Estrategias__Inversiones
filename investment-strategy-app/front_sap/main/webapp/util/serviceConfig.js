sap.ui.define([], function () {
    "use strict";

    var SESSION_KEY = "auth_user";

    function getEnvValue(sKey) {
        if (window.__env && window.__env[sKey]) {
            return window.__env[sKey];
        }
        if (window.sap && window.sap.env && window.sap.env[sKey]) {
            return window.sap.env[sKey];
        }
        return null;
    }

    var ODATA_BASE = getEnvValue("VITE_API_URL") || "/odata/v4/catalog";
    var AUTH_BASE = ODATA_BASE.replace(/\/odata\/v4\/catalog\/?$/i, "");

    function readSession() {
        try {
            return JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null");
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn("[serviceConfig] auth_user invalido:", err);
            return null;
        }
    }

    function saveSession(oSession) {
        if (!oSession) {
            clearSession();
            return;
        }
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(oSession));
    }

    function clearSession() {
        window.localStorage.removeItem(SESSION_KEY);
    }

    function buildUserPayload(oSession) {
        if (!oSession) {
            return {
                displayName: "Invitado",
                initials: "?",
                avatar: "",
                token: ""
            };
        }
        var sDisplay = oSession.name || oSession.email || "Usuario";
        var aParts = sDisplay.split(/\s+/);
        var sInitials = aParts
            .filter(function (part) {
                return !!part;
            })
            .map(function (part) {
                return part.charAt(0);
            })
            .join("")
            .slice(0, 2)
            .toUpperCase();
        return {
            displayName: sDisplay,
            initials: sInitials || "U",
            avatar: oSession.avatar || "",
            token: oSession.token || "",
            email: oSession.email || ""
        };
    }

    function applyAuthHeaders(oHeaders) {
        var oSession = readSession();
        if (oSession && oSession.token) {
            oHeaders["X-Session-Token"] = oSession.token;
        }
        return oHeaders;
    }

    function appendLoggedUser(oParams) {
        if (!oParams) {
            return;
        }
        var oSession = readSession();
        if (oSession && oSession.email && oParams.LoggedUser == null) {
            oParams.LoggedUser = oSession.email;
        }
    }

    return {
        SESSION_KEY: SESSION_KEY,
        ODATA_BASE: ODATA_BASE,
        AUTH_BASE: AUTH_BASE,
        readSession: readSession,
        saveSession: saveSession,
        clearSession: clearSession,
        buildUserPayload: buildUserPayload,
        applyAuthHeaders: applyAuthHeaders,
        appendLoggedUser: appendLoggedUser
    };
});
