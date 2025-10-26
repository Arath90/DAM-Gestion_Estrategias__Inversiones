sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/Dialog",
    "sap/m/List",
    "sap/m/StandardListItem",
    "sap/m/Button",
    "main/util/market"
], function (Controller, JSONModel, Dialog, List, StandardListItem, Button, marketUtil) {
    "use strict";

    var DEFAULT_SETTINGS = {
        ema20: true,
        ema50: true,
        sma200: false,
        volume: true,
        rsi: true,
        signals: true
    };

    var MARKET_HELP_ITEMS = [
        {
            title: "EMAs y SMA",
            description: "Activa las medias moviles exponenciales (EMA) de 20 y 50 periodos o la media simple de 200 para detectar tendencias."
        },
        {
            title: "Volumen",
            description: "Muestra histogramas de volumen bajo el grafico principal para validar fuerza de las velas."
        },
        {
            title: "RSI",
            description: "Oscilador de fuerza relativa (14 periodos). Valores sobre 70 indican sobrecompra, por debajo de 30 sobreventa."
        },
        {
            title: "Senales",
            description: "Coloca marcadores de compra/venta basados en cruces EMA y niveles del RSI."
        },
        {
            title: "Intervalos",
            description: "Determina el tamaño de cada vela (1h, 2h, 4h, etc.). Intervalos mayores suavizan el ruido."
        }
    ];

    var MAIN_CHART_OPTIONS = {
        layout: {
            background: { color: "#0f172a" },
            textColor: "#e2e8f0",
            fontFamily: "Segoe UI, Roboto, sans-serif"
        },
        rightPriceScale: { borderVisible: true },
        timeScale: { borderVisible: true, timeVisible: true, secondsVisible: false },
        crosshair: { mode: 1 },
        grid: {
            horzLines: { color: "#1e293b" },
            vertLines: { color: "#1e293b" }
        }
    };

    var RSI_CHART_OPTIONS = {
        layout: {
            background: { color: "#101b33" },
            textColor: "#e2e8f0",
            fontFamily: "Segoe UI, Roboto, sans-serif"
        },
        rightPriceScale: {
            borderVisible: false,
            scaleMargins: { top: 0.1, bottom: 0.1 }
        },
        timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
        crosshair: { mode: 1 },
        grid: {
            horzLines: { color: "#1e293b" },
            vertLines: { color: "#1e293b" }
        }
    };

    return Controller.extend("main.controller.Mercado", {
        onInit: function () {
            var sDefaultSymbol = marketUtil.DEFAULT_SYMBOLS.length ? marketUtil.DEFAULT_SYMBOLS[0].value : "I:NDX";
            var sDefaultInterval = marketUtil.INTERVALS.length ? marketUtil.INTERVALS[0].value : "1hour";

            var oModel = new JSONModel({
                presets: marketUtil.DEFAULT_SYMBOLS,
                intervals: marketUtil.INTERVALS,
                presetKey: sDefaultSymbol,
                symbol: sDefaultSymbol,
                interval: sDefaultInterval,
                customTicker: "",
                settings: Object.assign({}, DEFAULT_SETTINGS),
                loading: false,
                error: "",
                candles: [],
                indicators: {
                    ema20: [],
                    ema50: [],
                    sma200: [],
                    rsi14: [],
                    signals: []
                },
                summary: {
                    intervalLabel: this._getIntervalLabel(sDefaultInterval),
                    candleCount: 0,
                    volumeLabel: "-"
                }
            });

            oModel.setSizeLimit(1000);
            this.getView().setModel(oModel, "market");

            this._oMarketModel = oModel;
            this._oChart = null;
            this._oRsiChart = null;
            this._oSeries = {
                candle: null,
                volume: null,
                ema20: null,
                ema50: null,
                sma200: null,
                rsi: null
            };

            this.getOwnerComponent().getRouter().getRoute("mercado").attachPatternMatched(this._onRouteMatched, this);
        },

        onAfterRendering: function () {
            this._ensureCharts();
        },

        onPresetChange: function (oEvent) {
            var oItem = oEvent.getParameter("selectedItem");
            var sKey = oItem ? oItem.getKey() : "";
            if (!sKey) {
                return;
            }
            this._oMarketModel.setProperty("/presetKey", sKey);
            this._oMarketModel.setProperty("/symbol", sKey);
            this._oMarketModel.setProperty("/customTicker", "");
            this.onRefresh();
        },

        onCustomTickerChange: function (oEvent) {
            var sValue = (oEvent.getParameter("value") || "").toUpperCase();
            this._oMarketModel.setProperty("/customTicker", sValue);
        },

        onLoadCustomTicker: function () {
            var sTicker = (this._oMarketModel.getProperty("/customTicker") || "").trim().toUpperCase();
            if (!sTicker) {
                return;
            }
            this._oMarketModel.setProperty("/symbol", sTicker);
            this._oMarketModel.setProperty("/presetKey", "");
            this.onRefresh();
        },

        onIntervalChange: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            var sInterval = oItem ? oItem.getKey() : this._oMarketModel.getProperty("/interval");
            this._oMarketModel.setProperty("/interval", sInterval);
            this._oMarketModel.setProperty("/summary/intervalLabel", this._getIntervalLabel(sInterval));
            this.onRefresh();
        },

        onToggleSetting: function (oEvent) {
            var bSelected = oEvent.getParameter("selected");
            var sKey = this._extractSettingKey(oEvent.getSource());
            if (!sKey) {
                return;
            }
            this._oMarketModel.setProperty("/settings/" + sKey, bSelected);
            if (sKey === "rsi") {
                if (bSelected) {
                    this._ensureRsiChart();
                } else {
                    this._destroyRsiChart();
                }
            }
            this._applyChartData();
        },

        onRefresh: function () {
            if (!this._isAuthenticated()) {
                this._oMarketModel.setProperty("/error", "Inicia sesion para consultar el mercado.");
                return;
            }
            this._ensureCharts();
            this._loadMarketData();
        },

        onOpenMarketHelp: function () {
            if (!this._oHelpDialog) {
                var oList = new List({
                    inset: false,
                    items: MARKET_HELP_ITEMS.map(function (item) {
                        return new StandardListItem({
                            title: item.title,
                            description: item.description,
                            icon: "sap-icon://hint",
                            type: "Inactive"
                        });
                    })
                });

                this._oHelpDialog = new Dialog({
                    title: "Glosario de mercado",
                    resizable: true,
                    draggable: true,
                    contentWidth: "420px",
                    contentHeight: "60vh",
                    content: [oList],
                    endButton: new Button({
                        text: "Cerrar",
                        press: function () {
                            this._oHelpDialog.close();
                        }.bind(this)
                    })
                });
                this._oHelpDialog.addStyleClass("marketGlossaryDialog");
                this.getView().addDependent(this._oHelpDialog);
            }
            this._oHelpDialog.open();
        },

        onExit: function () {
            this._destroyCharts();
            if (this._oHelpDialog) {
                this._oHelpDialog.destroy();
                this._oHelpDialog = null;
            }
            if (this._fnResizeMain) {
                window.removeEventListener("resize", this._fnResizeMain);
                this._fnResizeMain = null;
            }
            if (this._fnResizeRsi) {
                window.removeEventListener("resize", this._fnResizeRsi);
                this._fnResizeRsi = null;
            }
        },

        _onRouteMatched: function () {
            if (!this._isAuthenticated()) {
                this._oMarketModel.setProperty("/error", "Inicia sesion para consultar el mercado.");
                this._oMarketModel.setProperty("/loading", false);
                return;
            }
            this._ensureCharts();
            if (!this._oMarketModel.getProperty("/candles").length) {
                this._loadMarketData();
            } else {
                this._applyChartData();
            }
        },

        _isAuthenticated: function () {
            var oAppModel = sap.ui.getCore().getModel("appViewModel");
            return !!(oAppModel && oAppModel.getProperty("/authenticated"));
        },

        _loadMarketData: function () {
            var oModel = this._oMarketModel;
            var sSymbol = oModel.getProperty("/symbol");
            var sInterval = oModel.getProperty("/interval");

            if (!sSymbol) {
                return;
            }

            oModel.setProperty("/loading", true);
            oModel.setProperty("/error", "");

            marketUtil.fetchCandles({
                symbol: sSymbol,
                interval: sInterval,
                limit: 360
            })
                .then(function (result) {
                    var aCandles = result.candles || [];
                    var oIndicators = marketUtil.buildIndicators(aCandles);
                    oModel.setProperty("/candles", aCandles);
                    oModel.setProperty("/indicators", oIndicators);
                    oModel.setProperty("/summary", {
                        intervalLabel: this._getIntervalLabel(sInterval),
                        candleCount: aCandles.length,
                        volumeLabel: marketUtil.buildVolumeLabel(aCandles)
                    });
                    oModel.setProperty("/loading", false);
                    this._applyChartData();
                }.bind(this))
                .catch(function (err) {
                    var sMessage = err && err.message ? err.message : "No se pudieron obtener datos de mercado.";
                    oModel.setProperty("/candles", []);
                    oModel.setProperty("/indicators", {
                        ema20: [],
                        ema50: [],
                        sma200: [],
                        rsi14: [],
                        signals: []
                    });
                    oModel.setProperty("/summary", {
                        intervalLabel: this._getIntervalLabel(sInterval),
                        candleCount: 0,
                        volumeLabel: "-"
                    });
                    oModel.setProperty("/loading", false);
                    oModel.setProperty("/error", sMessage);
                    this._applyChartData();
                }.bind(this));
        },

        _ensureCharts: function () {
            if (!window.LightweightCharts) {
                return;
            }
            var oHtml = this.byId("marketChartCanvas");
            if (oHtml && !this._oChart) {
                var oDom = oHtml.getDomRef();
                if (oDom) {
                    this._oChart = window.LightweightCharts.createChart(oDom, MAIN_CHART_OPTIONS);
                    this._oSeries.candle = this._oChart.addCandlestickSeries({
                        upColor: "#47d16c",
                        downColor: "#ff6b6b",
                        borderUpColor: "#47d16c",
                        borderDownColor: "#ff6b6b",
                        wickUpColor: "#47d16c",
                        wickDownColor: "#ff6b6b"
                    });
                    this._oSeries.volume = this._oChart.addHistogramSeries({
                        priceScaleId: "",
                        priceFormat: { type: "volume" },
                        scaleMargins: { top: 0.8, bottom: 0 }
                    });
                    this._oSeries.ema20 = this._oChart.addLineSeries({ color: "#22d3ee", lineWidth: 2 });
                    this._oSeries.ema50 = this._oChart.addLineSeries({ color: "#facc15", lineWidth: 2 });
                    this._oSeries.sma200 = this._oChart.addLineSeries({ color: "#c084fc", lineWidth: 2 });

                    this._fnResizeMain = this._fnResizeMain || this._resizeMainChart.bind(this);
                    this._fnResizeMain();
                    window.addEventListener("resize", this._fnResizeMain);
                }
            }
            if (this._oMarketModel.getProperty("/settings/rsi")) {
                this._ensureRsiChart();
            }
        },

        _ensureRsiChart: function () {
            if (!window.LightweightCharts) {
                return;
            }
            var oHtml = this.byId("marketRsiCanvas");
            if (!oHtml) {
                return;
            }
            var oDom = oHtml.getDomRef();
            if (!oDom) {
                return;
            }
            if (!this._oRsiChart) {
                this._oRsiChart = window.LightweightCharts.createChart(oDom, RSI_CHART_OPTIONS);
                this._oSeries.rsi = this._oRsiChart.addLineSeries({ color: "#94a3b8", lineWidth: 2 });
                this._oSeries.rsi.createPriceLine({ price: 70, color: "#ef4444", lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
                this._oSeries.rsi.createPriceLine({ price: 30, color: "#22c55e", lineWidth: 1, lineStyle: 2, axisLabelVisible: false });

                this._fnResizeRsi = this._fnResizeRsi || this._resizeRsiChart.bind(this);
                this._fnResizeRsi();
                window.addEventListener("resize", this._fnResizeRsi);
            }
        },

        _applyChartData: function () {
            if (!this._oSeries.candle) {
                return;
            }
            var aCandles = this._oMarketModel.getProperty("/candles") || [];
            var oIndicators = this._oMarketModel.getProperty("/indicators") || {};
            var oSettings = this._oMarketModel.getProperty("/settings") || {};

            if (!Array.isArray(aCandles) || aCandles.length === 0) {
                this._resetSeries();
                return;
            }

            this._oSeries.candle.setData(aCandles);

            if (oSettings.volume && this._oSeries.volume) {
                var aVolume = aCandles.map(function (candle) {
                    return {
                        time: candle.time,
                        value: candle.volume || 0,
                        color: candle.close >= candle.open ? "#47d16c88" : "#ff6b6b88"
                    };
                });
                this._oSeries.volume.setData(aVolume);
            } else if (this._oSeries.volume) {
                this._oSeries.volume.setData([]);
            }

            this._oSeries.ema20 && this._oSeries.ema20.setData(oSettings.ema20 ? oIndicators.ema20 || [] : []);
            this._oSeries.ema50 && this._oSeries.ema50.setData(oSettings.ema50 ? oIndicators.ema50 || [] : []);
            this._oSeries.sma200 && this._oSeries.sma200.setData(oSettings.sma200 ? oIndicators.sma200 || [] : []);
            this._oSeries.candle.setMarkers(oSettings.signals ? oIndicators.signals || [] : []);

            if (oSettings.rsi) {
                this._ensureRsiChart();
                this._oSeries.rsi && this._oSeries.rsi.setData(oIndicators.rsi14 || []);
            } else if (this._oSeries.rsi) {
                this._oSeries.rsi.setData([]);
            }
        },

        _resetSeries: function () {
            if (this._oSeries.candle) {
                this._oSeries.candle.setData([]);
                this._oSeries.candle.setMarkers([]);
            }
            if (this._oSeries.volume) {
                this._oSeries.volume.setData([]);
            }
            if (this._oSeries.ema20) {
                this._oSeries.ema20.setData([]);
            }
            if (this._oSeries.ema50) {
                this._oSeries.ema50.setData([]);
            }
            if (this._oSeries.sma200) {
                this._oSeries.sma200.setData([]);
            }
            if (this._oSeries.rsi) {
                this._oSeries.rsi.setData([]);
            }
        },

        _destroyCharts: function () {
            if (this._oChart) {
                this._oChart.remove();
                this._oChart = null;
            }
            if (this._fnResizeMain) {
                window.removeEventListener("resize", this._fnResizeMain);
                this._fnResizeMain = null;
            }
            this._destroyRsiChart();
            this._oSeries = {
                candle: null,
                volume: null,
                ema20: null,
                ema50: null,
                sma200: null,
                rsi: null
            };
        },

        _destroyRsiChart: function () {
            if (this._oRsiChart) {
                this._oRsiChart.remove();
                this._oRsiChart = null;
            }
            if (this._oSeries.rsi) {
                this._oSeries.rsi = null;
            }
            if (this._fnResizeRsi) {
                window.removeEventListener("resize", this._fnResizeRsi);
                this._fnResizeRsi = null;
            }
        },

        _resizeMainChart: function () {
            if (!this._oChart) {
                return;
            }
            var oHtml = this.byId("marketChartCanvas");
            if (!oHtml) {
                return;
            }
            var oDom = oHtml.getDomRef();
            if (oDom) {
                var iWidth = oDom.getBoundingClientRect().width;
                this._oChart.applyOptions({ width: Math.max(iWidth, 320) });
            }
        },

        _resizeRsiChart: function () {
            if (!this._oRsiChart) {
                return;
            }
            var oHtml = this.byId("marketRsiCanvas");
            if (!oHtml) {
                return;
            }
            var oDom = oHtml.getDomRef();
            if (oDom) {
                var iWidth = oDom.getBoundingClientRect().width;
                this._oRsiChart.applyOptions({ width: Math.max(iWidth, 320) });
            }
        },

        _extractSettingKey: function (oControl) {
            var aData = oControl.getCustomData();
            if (!Array.isArray(aData) || !aData.length) {
                return null;
            }
            var oEntry = aData.find(function (item) {
                return item.getKey && item.getKey() === "settingKey";
            });
            return oEntry ? oEntry.getValue() : null;
        },

        _getIntervalLabel: function (sInterval) {
            var oMatch = marketUtil.INTERVALS.find(function (entry) {
                return entry.value === sInterval;
            });
            return (oMatch && oMatch.label) || sInterval;
        }
    });
});
