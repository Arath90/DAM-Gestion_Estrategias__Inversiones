sap.ui.define([
    "main/util/serviceConfig"
], function (serviceConfig) {
    "use strict";

    function request(sPath, mOptions) {
        var mHeaders = {
            "Content-Type": "application/json"
        };
        serviceConfig.applyAuthHeaders(mHeaders);

        return fetch(serviceConfig.AUTH_BASE + sPath, {
            method: (mOptions && mOptions.method) || "POST",
            headers: mHeaders,
            body: mOptions && mOptions.body ? JSON.stringify(mOptions.body) : undefined
        }).then(function (oResponse) {
            if (!oResponse.ok) {
                return oResponse.json().catch(function () {
                    return {};
                }).then(function (oError) {
                    var sMessage = oError && (oError.message || oError.error) || oResponse.statusText;
                    throw new Error(sMessage || "Error de autenticacion");
                });
            }
            return oResponse.json();
        });
    }

    function login(mCredentials) {
        return request("/api/auth/login", {
            method: "POST",
            body: mCredentials
        }).then(function (oData) {
            if (!oData || !oData.success || !oData.token || !oData.user) {
                throw new Error(oData && oData.message || "No se pudo iniciar sesion.");
            }
            var oSession = {
                token: oData.token,
                expiresAt: oData.expiresAt,
                name: oData.user.name,
                email: oData.user.email,
                user: oData.user.user,
                avatar: oData.user.avatar
            };
            serviceConfig.saveSession(oSession);
            return oSession;
        });
    }

    return {
        login: login
    };
});
