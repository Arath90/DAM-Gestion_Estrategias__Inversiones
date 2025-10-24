sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "main/util/catalog"
], function (Controller, JSONModel, MessageToast, MessageBox, catalog) {
    "use strict";

    var FIELD_CONFIG = [
        { name: "symbol", label: "Simbolo" },
        { name: "sec_type", label: "Tipo" },
        { name: "exchange", label: "Exchange" },
        { name: "currency", label: "Moneda" },
        { name: "multiplier", label: "Multiplicador" },
        { name: "trading_class", label: "Clase" },
        { name: "ib_conid", label: "CONID" },
        { name: "underlying_conid", label: "Subyacente CONID" },
        { name: "last_trade_date", label: "Ultimo trade" },
        { name: "created_at", label: "Creado en origen" }
    ];

    function blankForm() {
        var mData = {};
        FIELD_CONFIG.forEach(function (field) {
            mData[field.name] = "";
        });
        return mData;
    }

    function formatDateForInput(value) {
        if (!value) {
            return "";
        }
        var date = new Date(value);
        if (isNaN(date.getTime())) {
            return "";
        }
        function pad(n) {
            return String(n).padStart(2, "0");
        }
        return (
            date.getFullYear() +
            "-" +
            pad(date.getMonth() + 1) +
            "-" +
            pad(date.getDate()) +
            "T" +
            pad(date.getHours()) +
            ":" +
            pad(date.getMinutes())
        );
    }

    function buildEditableCopy(oInstrument) {
        var mForm = blankForm();
        FIELD_CONFIG.forEach(function (field) {
            var vValue = oInstrument[field.name];
            if (vValue == null) {
                return;
            }
            if (field.name === "last_trade_date" || field.name === "created_at") {
                mForm[field.name] = formatDateForInput(vValue);
            } else {
                mForm[field.name] = String(vValue);
            }
        });
        return mForm;
    }

    function parseNumber(value) {
        if (value == null || value === "") {
            return undefined;
        }
        var num = Number(value);
        return isFinite(num) ? num : undefined;
    }

    function parseDateTime(value) {
        if (!value) {
            return undefined;
        }
        var date = new Date(value);
        return isNaN(date.getTime()) ? undefined : date.toISOString();
    }

    function sanitizePayload(mForm) {
        var mPayload = {};
        Object.keys(mForm).forEach(function (key) {
            var value = mForm[key];
            if (value == null || value === "") {
                return;
            }
            if (key === "ib_conid" || key === "underlying_conid") {
                var num = parseNumber(value);
                if (num != null) {
                    mPayload[key] = num;
                }
                return;
            }
            if (key === "last_trade_date" || key === "created_at") {
                var iso = parseDateTime(value);
                if (iso) {
                    mPayload[key] = iso;
                }
                return;
            }
            mPayload[key] = value;
        });
        return mPayload;
    }

    return Controller.extend("main.controller.Instrumentos", {
        onInit: function () {
            var oModel = new JSONModel({
                listBusy: false,
                status: {
                    text: "",
                    type: "Information"
                },
                showCreate: false,
                createBusy: false,
                createData: blankForm(),
                items: []
            });
            oModel.setSizeLimit(300);
            this.getView().setModel(oModel, "instrumentos");

            this.getOwnerComponent().getRouter().getRoute("instrumentos").attachPatternMatched(this._onRouteMatched, this);
        },

        _isAuthenticated: function () {
            var oAppModel = sap.ui.getCore().getModel("appViewModel");
            return !!(oAppModel && oAppModel.getProperty("/authenticated"));
        },

        _onRouteMatched: function () {
            if (!this._isAuthenticated()) {
                var oModel = this.getView().getModel("instrumentos");
                oModel.setProperty("/items", []);
                oModel.setProperty("/status", {
                    text: "Inicia sesion para consultar instrumentos.",
                    type: "Information"
                });
                return;
            }
            this._loadInstruments();
        },

        _loadInstruments: function () {
            var oModel = this.getView().getModel("instrumentos");
            oModel.setProperty("/listBusy", true);
            oModel.setProperty("/status", { text: "", type: "Information" });

            if (!this._isAuthenticated()) {
                oModel.setProperty("/listBusy", false);
                oModel.setProperty("/status", {
                    text: "Inicia sesion para consultar instrumentos.",
                    type: "Information"
                });
                return;
            }

            catalog
                .listInstruments({ $top: 50 })
                .then(function (aItems) {
                    var aMapped = aItems.map(function (item) {
                        return Object.assign({}, item, {
                            expanded: false,
                            editData: buildEditableCopy(item)
                        });
                    });
                    oModel.setProperty("/items", aMapped);
                    oModel.setProperty("/listBusy", false);
                    if (!aMapped.length) {
                        oModel.setProperty("/status", {
                            text: "Aun no hay instrumentos registrados.",
                            type: "Information"
                        });
                    }
                })
                .catch(function (err) {
                    oModel.setProperty("/listBusy", false);
                    oModel.setProperty("/status", {
                        text: (err && err.message) || "No se pudo cargar la lista.",
                        type: "Error"
                    });
                });
        },

        onToggleCreate: function () {
            var oModel = this.getView().getModel("instrumentos");
            var bVisible = oModel.getProperty("/showCreate");
            oModel.setProperty("/showCreate", !bVisible);
        },

        onResetCreate: function () {
            var oModel = this.getView().getModel("instrumentos");
            oModel.setProperty("/createData", blankForm());
        },

        onCreateInstrument: function () {
            var oModel = this.getView().getModel("instrumentos");
            var mForm = Object.assign({}, oModel.getProperty("/createData"));

            oModel.setProperty("/createBusy", true);
            oModel.setProperty("/status", { text: "", type: "Information" });

            catalog
                .createInstrument(sanitizePayload(mForm))
                .then(function (created) {
                    MessageToast.show("Instrumento creado correctamente.");
                    var aItems = oModel.getProperty("/items") || [];
                    var oNewItem = Object.assign({}, created, {
                        expanded: false,
                        editData: buildEditableCopy(created)
                    });
                    aItems.unshift(oNewItem);
                    oModel.setProperty("/items", aItems);
                    oModel.setProperty("/createBusy", false);
                    oModel.setProperty("/showCreate", false);
                    oModel.setProperty("/createData", blankForm());
                    oModel.setProperty("/status", {
                        text: "Instrumento creado correctamente.",
                        type: "Success"
                    });
                })
                .catch(function (err) {
                    oModel.setProperty("/createBusy", false);
                    oModel.setProperty("/status", {
                        text: (err && err.message) || "No se pudo crear el instrumento.",
                        type: "Error"
                    });
                });
        },

        onPanelExpand: function (oEvent) {
            var oPanel = oEvent.getSource();
            var oCtx = oPanel.getBindingContext("instrumentos");
            if (!oCtx) {
                return;
            }
            oCtx.getModel().setProperty(oCtx.getPath() + "/expanded", oEvent.getParameter("expand"));
        },

        onUpdateInstrument: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext("instrumentos");
            if (!oCtx) {
                return;
            }
            var oModel = oCtx.getModel();
            var mItem = oCtx.getObject();

            oModel.setProperty("/status", { text: "", type: "Information" });
            oModel.setProperty(oCtx.getPath() + "/busy", true);

            var fnCleanup = function () {
                oModel.setProperty(oCtx.getPath() + "/busy", false);
            };

            catalog.updateInstrument(mItem.ID, sanitizePayload(mItem.editData))
                .then(function (updated) {
                    MessageToast.show("Instrumento actualizado.");
                    var oMerged = Object.assign({}, mItem, updated);
                    oMerged.editData = buildEditableCopy(oMerged);
                    oMerged.expanded = true;
                    oModel.setProperty(oCtx.getPath(), oMerged);
                    oModel.setProperty("/status", {
                        text: "Instrumento actualizado.",
                        type: "Success"
                    });
                })
                .catch(function (err) {
                    oModel.setProperty("/status", {
                        text: (err && err.message) || "No se pudo actualizar el instrumento.",
                        type: "Error"
                    });
                })
                .then(fnCleanup, fnCleanup);
        },

        onDeleteInstrument: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext("instrumentos");
            if (!oCtx) {
                return;
            }
            var oModel = oCtx.getModel();
            var mItem = oCtx.getObject();

            MessageBox.confirm("Eliminar este instrumento?", {
                title: "Confirmar",
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) {
                        return;
                    }
                    catalog
                        .deleteInstrument(mItem.ID)
                        .then(function () {
                            MessageToast.show("Instrumento eliminado.");
                            var aItems = oModel.getProperty("/items") || [];
                            oModel.setProperty(
                                "/items",
                                aItems.filter(function (entry) {
                                    return entry.ID !== mItem.ID;
                                })
                            );
                            oModel.setProperty("/status", {
                                text: "Instrumento eliminado.",
                                type: "Success"
                            });
                        })
                        .catch(function (err) {
                            oModel.setProperty("/status", {
                                text: (err && err.message) || "No se pudo eliminar el instrumento.",
                                type: "Error"
                            });
                        });
                }
            });
        }
    });
});
