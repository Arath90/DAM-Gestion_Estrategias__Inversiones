sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/List",
    "sap/m/StandardListItem",
    "sap/m/Button",
    "main/util/catalog"
], function (Controller, JSONModel, MessageToast, MessageBox, Dialog, List, StandardListItem, Button, catalog) {
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

    var GLOSSARY_ITEMS = [
        {
            key: "symbol",
            title: "Simbolo",
            description: "Ticker o symbol tal como se negocia el instrumento en el mercado."
        },
        {
            key: "sec_type",
            title: "Tipo",
            description: "Tipo de contrato, por ejemplo STK (accion), FUT (futuro), OPT (opcion) o CASH (divisa)."
        },
        {
            key: "exchange",
            title: "Exchange",
            description: "Bolsa o venue donde cotiza el instrumento (NYSE, NASDAQ, CME, IDEALPRO, etc.)."
        },
        {
            key: "currency",
            title: "Moneda",
            description: "Divisa de cotizacion expresada con codigo ISO (USD, MXN, EUR, etc.)."
        },
        {
            key: "multiplier",
            title: "Multiplicador",
            description: "Factor multiplicador aplicado al contrato para calcular valor nocional."
        },
        {
            key: "trading_class",
            title: "Clase",
            description: "Trading class o familia asignada por el broker para agrupar contratos relacionados."
        },
        {
            key: "ib_conid",
            title: "CONID",
            description: "Identificador unico del instrumento en Interactive Brokers u otra fuente."
        },
        {
            key: "underlying_conid",
            title: "Subyacente CONID",
            description: "CONID del instrumento subyacente asociado a contratos derivados."
        },
        {
            key: "last_trade_date",
            title: "Ultimo trade (ISO)",
            description: "Fecha y hora del ultimo trade disponible en formato ISO 8601 (YYYY-MM-DDTHH:mm)."
        },
        {
            key: "created_at",
            title: "Creado en origen (ISO)",
            description: "Fecha de creacion provista por el sistema de origen en formato ISO 8601."
        }
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

    function extractErrorInfo(oError, sFallback) {
        var sMessage = sFallback || "Ocurrió un error inesperado.";
        var sDetails = "";
        if (oError) {
            if (oError.message) {
                sMessage = oError.message;
            }
            if (Array.isArray(oError.detailMessages) && oError.detailMessages.length) {
                sDetails = oError.detailMessages.join("\n");
            } else if (oError.details) {
                sDetails = oError.details;
            } else if (oError.responseText && oError.responseText !== sMessage) {
                sDetails = oError.responseText;
            }
            if (!sDetails && oError.payload && oError.payload.error && oError.payload.error.target) {
                sDetails = oError.payload.error.target;
            }
        }
        if (sDetails === sMessage) {
            sDetails = "";
        }
        return {
            message: sMessage,
            details: sDetails
        };
    }

    function showErrorDialog(oController, oError, sFallback) {
        var oInfo = extractErrorInfo(oError, sFallback);
        MessageBox.error(oInfo.message, {
            details: oInfo.details || undefined,
            emphasizedAction: MessageBox.Action.CLOSE,
            dependentOn: oController.getView()
        });
        return oInfo;
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

        onOpenGlossary: function () {
            if (!this._oGlossaryDialog) {
                var oList = new List({
                    inset: false,
                    items: GLOSSARY_ITEMS.map(function (item) {
                        return new StandardListItem({
                            title: item.title,
                            description: item.description,
                            icon: "sap-icon://hint",
                            type: "Inactive"
                        });
                    })
                });
                oList.addStyleClass("instrumentGlossaryList");

                this._oGlossaryDialog = new Dialog({
                    title: "Glosario de campos",
                    resizable: true,
                    draggable: true,
                    contentWidth: "420px",
                    contentHeight: "60vh",
                    content: [oList],
                    endButton: new Button({
                        text: "Cerrar",
                        press: function () {
                            this._oGlossaryDialog.close();
                        }.bind(this)
                    })
                });
                this.getView().addDependent(this._oGlossaryDialog);
            }

            this._oGlossaryDialog.open();
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
                    var oInfo = extractErrorInfo(err, "No se pudo cargar la lista.");
                    oModel.setProperty("/status", {
                        text: oInfo.message,
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
                    var oInfo = showErrorDialog(this, err, "No se pudo crear el instrumento.");
                    oModel.setProperty("/status", {
                        text: oInfo.message,
                        type: "Error"
                    });
                }.bind(this));
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
                    var oInfo = showErrorDialog(this, err, "No se pudo actualizar el instrumento.");
                    oModel.setProperty("/status", {
                        text: oInfo.message,
                        type: "Error"
                    });
                }.bind(this))
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
                            var oInfo = showErrorDialog(this, err, "No se pudo eliminar el instrumento.");
                            oModel.setProperty("/status", {
                                text: oInfo.message,
                                type: "Error"
                            });
                        }.bind(this));
                }.bind(this)
            });
        },

        onExit: function () {
            if (this._oEventBus) {
                this._oEventBus.unsubscribe("auth", "loginSuccess", this._onLoginSuccess, this);
            }
            if (this._oGlossaryDialog) {
                this._oGlossaryDialog.destroy();
                this._oGlossaryDialog = null;
            }
        }
    });
});
