sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("main.controller.NotFound", {
        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            setTimeout(function () {
                oRouter.navTo("inicio", {}, true);
            }, 1200);
        }
    });
});
