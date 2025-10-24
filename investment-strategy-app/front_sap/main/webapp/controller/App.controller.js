sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "main/util/serviceConfig"
], function (Controller, JSONModel, MessageToast, serviceConfig) {
    "use strict";

    return Controller.extend("main.controller.App", {
        onInit: function () {
            this._oRouter = this.getOwnerComponent().getRouter();
            this._oEventBus = sap.ui.getCore().getEventBus();

            var oSession = serviceConfig.readSession();
            var bAuthenticated = !!oSession;

            var oViewModel = new JSONModel({
                authenticated: bAuthenticated,
                sideCollapsed: false,
                selectedKey: bAuthenticated ? "inicio" : "",
                user: serviceConfig.buildUserPayload(oSession)
            });
            this.getView().setModel(oViewModel, "vm");
            sap.ui.getCore().setModel(oViewModel, "appViewModel");

            this._oRouter.attachRouteMatched(this._onRouteMatched, this);
            this._oEventBus.subscribe("auth", "loginSuccess", this._onLoginSuccess, this);
        },

        onNavSelect: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            if (!sKey) {
                return;
            }
            var oModel = this.getView().getModel("vm");
            if (oModel.getProperty("/selectedKey") === sKey) {
                return;
            }
            this._oRouter.navTo(sKey);
        },

        onToggleSide: function () {
            var oModel = this.getView().getModel("vm");
            var bCurrent = oModel.getProperty("/sideCollapsed");
            oModel.setProperty("/sideCollapsed", !bCurrent);
        },

        onLogout: function () {
            var oModel = this.getView().getModel("vm");
            var oUser = oModel.getProperty("/user");
            serviceConfig.clearSession();

            if (oUser && oUser.token) {
                fetch(serviceConfig.AUTH_BASE + "/api/auth/logout", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Session-Token": oUser.token
                    }
                }).catch(function (err) {
                    // eslint-disable-next-line no-console
                    console.warn("[app] logout backend error:", err);
                });
            }

            oModel.setProperty("/authenticated", false);
            oModel.setProperty("/user", serviceConfig.buildUserPayload(null));
            oModel.setProperty("/selectedKey", "");

            MessageToast.show("Sesion finalizada.");
            this._oRouter.navTo("login", {}, true);
        },

        _onLoginSuccess: function (sChannel, sEvent, oData) {
            var oSession = oData && oData.session;
            var oModel = this.getView().getModel("vm");
            oModel.setProperty("/authenticated", true);
            oModel.setProperty("/user", serviceConfig.buildUserPayload(oSession));
            oModel.setProperty("/selectedKey", "inicio");
            this._oRouter.navTo("inicio", {}, true);
        },

        _onRouteMatched: function (oEvent) {
            var sRouteName = oEvent.getParameter("name");
            var oModel = this.getView().getModel("vm");
            var bAuthenticated = oModel.getProperty("/authenticated");

            if (!bAuthenticated && sRouteName !== "login" && sRouteName !== "loginAlias") {
                this._oRouter.navTo("login", {}, true);
                return;
            }

            if (bAuthenticated && (sRouteName === "login" || sRouteName === "loginAlias")) {
                this._oRouter.navTo("inicio", {}, true);
                return;
            }

            if (sRouteName === "notFound") {
                this._oRouter.navTo(bAuthenticated ? "inicio" : "login", {}, true);
                return;
            }

            if (bAuthenticated && sRouteName && sRouteName !== oModel.getProperty("/selectedKey")) {
                oModel.setProperty("/selectedKey", sRouteName);
            }
        },

        onExit: function () {
            if (this._oEventBus) {
                this._oEventBus.unsubscribe("auth", "loginSuccess", this._onLoginSuccess, this);
            }
        }
    });
});
