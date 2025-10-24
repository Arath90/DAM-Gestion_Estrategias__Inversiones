sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "main/util/auth",
    "main/util/serviceConfig"
], function (Controller, JSONModel, MessageToast, auth, serviceConfig) {
    "use strict";

    function isEmailValid(sEmail) {
        return /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(sEmail);
    }

    return Controller.extend("main.controller.Login", {
        onInit: function () {
            var oModel = new JSONModel({
                email: "",
                password: "",
                busy: false,
                error: ""
            });
            this.getView().setModel(oModel, "login");
        },

        onFieldChange: function () {
            var oModel = this.getView().getModel("login");
            if (oModel.getProperty("/error")) {
                oModel.setProperty("/error", "");
            }
        },

        onSubmit: function () {
            this.onLogin();
        },

        onLogin: function () {
            var oModel = this.getView().getModel("login");
            if (oModel.getProperty("/busy")) {
                return;
            }

            var sEmail = (oModel.getProperty("/email") || "").trim();
            var sPassword = oModel.getProperty("/password") || "";

            if (!sEmail || !sPassword) {
                oModel.setProperty("/error", "Todos los campos son obligatorios.");
                return;
            }
            if (!isEmailValid(sEmail)) {
                oModel.setProperty("/error", "El correo no es valido.");
                return;
            }
            if (sPassword.length < 5) {
                oModel.setProperty("/error", "La contrasena debe tener al menos 5 caracteres.");
                return;
            }

            oModel.setProperty("/busy", true);
            oModel.setProperty("/error", "");

            var fnCleanup = function () {
                oModel.setProperty("/busy", false);
            };

            auth.login({ email: sEmail, password: sPassword })
                .then(function (oSession) {
                    MessageToast.show("Sesion iniciada correctamente.");
                    sap.ui.getCore().getEventBus().publish("auth", "loginSuccess", {
                        session: oSession
                    });
                    var oAppModel = sap.ui.getCore().getModel("appViewModel");
                    if (oAppModel) {
                        oAppModel.setProperty("/authenticated", true);
                        oAppModel.setProperty("/user", serviceConfig.buildUserPayload(oSession));
                        oAppModel.setProperty("/selectedKey", "inicio");
                    }
                    oModel.setProperty("/email", "");
                    oModel.setProperty("/password", "");
                    fnCleanup();
                })
                .catch(function (err) {
                    var sMessage = err && err.message ? err.message : "Credenciales invalidas.";
                    oModel.setProperty("/error", sMessage);
                    fnCleanup();
                });
        }
    });
});
