sap.ui.define([
    "main/util/serviceConfig"
], function (serviceConfig) {
    "use strict";

    var BASE_PARAMS = {
        dbServer: "MongoDB"
    };

    function buildQueryString(oParams) {
        var aPairs = [];
        Object.keys(oParams || {}).forEach(function (sKey) {
            var vValue = oParams[sKey];
            if (vValue === undefined || vValue === null || vValue === "") {
                return;
            }
            var sSafeKey = encodeURIComponent(String(sKey));
            var sSafeVal = encodeURIComponent(String(vValue));
            aPairs.push(sSafeKey + "=" + sSafeVal);
        });
        return aPairs.join("&").replace(/\+/g, "%20");
    }

    function buildUrl(sPath, oParams) {
        var sBase = serviceConfig.ODATA_BASE.replace(/\/$/, "");
        var sQuery = buildQueryString(oParams);
        return sBase + sPath + (sQuery ? "?" + sQuery : "");
    }

    function collectDataRes(node) {
        if (!node || typeof node !== "object") {
            return [];
        }
        var aBucket = [];
        if (Array.isArray(node.dataRes)) {
            aBucket = aBucket.concat(node.dataRes);
        } else if (node.dataRes && typeof node.dataRes === "object") {
            aBucket.push(node.dataRes);
        }
        if (Array.isArray(node.data)) {
            node.data.forEach(function (entry) {
                aBucket = aBucket.concat(collectDataRes(entry));
            });
        }
        return aBucket;
    }

    function normalizePayload(oPayload) {
        if (!oPayload) {
            return [];
        }
        if (Array.isArray(oPayload.value)) {
            var aCollected = [];
            oPayload.value.forEach(function (item) {
                aCollected = aCollected.concat(collectDataRes(item));
            });
            return aCollected.length ? aCollected : oPayload.value;
        }
        var aFromData = collectDataRes(oPayload);
        if (aFromData.length) {
            return aFromData;
        }
        if (Array.isArray(oPayload)) {
            return oPayload;
        }
        if (oPayload.data) {
            return normalizePayload(oPayload.data);
        }
        return [oPayload];
    }

    function ensureArray(oInput) {
        if (Array.isArray(oInput)) {
            return oInput;
        }
        if (oInput === null) {
            return [];
        }
        return [oInput];
    }

    function request(sMethod, sPath, mOptions) {
        var oParams = Object.assign({}, BASE_PARAMS, mOptions && mOptions.params);
        serviceConfig.appendLoggedUser(oParams);

        var mHeaders = {
            "Content-Type": "application/json"
        };
        serviceConfig.applyAuthHeaders(mHeaders);

        var mFetchOptions = {
            method: sMethod,
            headers: mHeaders
        };

        if (mOptions && mOptions.body === null) {
            mFetchOptions.body = JSON.stringify(mOptions.body);
        }

        return fetch(buildUrl(sPath, oParams), mFetchOptions).then(function (oResponse) {
            if (!oResponse.ok) {
                return oResponse.text().then(function (text) {
                    throw new Error(text || oResponse.statusText);
                });
            }
            if (oResponse.status === 204) {
                return null;
            }
            return oResponse.json();
        });
    }

    function listInstruments(mOptions) {
        var oParams = Object.assign(
            {
                ProcessType: "READ"
            },
            mOptions || {}
        );
        return request("GET", "/Instruments", { params: oParams }).then(function (oData) {
            return ensureArray(normalizePayload(oData));
        });
    }

    function createInstrument(oPayload) {
        return request("POST", "/Instruments", {
            params: {
                ProcessType: "CREATE"
            },
            body: oPayload
        }).then(function (oData) {
            var aItems = ensureArray(normalizePayload(oData));
            return aItems[0] || oPayload;
        });
    }

    function updateInstrument(sId, oPayload) {
        return request("PATCH", "/Instruments(ID='" + encodeURIComponent(sId) + "')", {
            params: {
                ProcessType: "UPDATE"
            },
            body: oPayload
        }).then(function (oData) {
            var aItems = ensureArray(normalizePayload(oData));
            return aItems[0] || oPayload;
        });
    }

    function deleteInstrument(sId) {
        return request("DELETE", "/Instruments(ID='" + encodeURIComponent(sId) + "')", {
            params: {
                ProcessType: "DELETE"
            }
        });
    }

    return {
        listInstruments: listInstruments,
        createInstrument: createInstrument,
        updateInstrument: updateInstrument,
        deleteInstrument: deleteInstrument
    };
});
