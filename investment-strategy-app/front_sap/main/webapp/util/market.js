sap.ui.define([
    "main/util/serviceConfig"
], function (serviceConfig) {
    "use strict";

    var DEFAULT_SYMBOLS = [
        { label: "NASDAQ 100", value: "I:NDX" },
        { label: "S&P 500", value: "I:SPX" },
        { label: "EUR/USD", value: "C:EURUSD" },
        { label: "BTC/USD", value: "X:BTCUSD" },
        { label: "ETH/USD", value: "X:ETHUSD" },
        { label: "AAPL", value: "AAPL" },
        { label: "MSFT", value: "MSFT" }
    ];

    var INTERVALS = [
        { label: "1h", value: "1hour" },
        { label: "2h", value: "2hour" },
        { label: "4h", value: "4hour" },
        { label: "6h", value: "6hour" },
        { label: "8h", value: "8hour" },
        { label: "12h", value: "12hour" }
    ];

    function buildBaseUrl(sPath) {
        var sBase = serviceConfig.AUTH_BASE || "";
        var sNormalizedBase = sBase ? sBase.replace(/\/$/, "") : "";
        var sNormalizedPath = String(sPath || "").replace(/^\//, "");
        if (!sNormalizedPath) {
            return sNormalizedBase;
        }
        return (sNormalizedBase ? sNormalizedBase + "/" : "/") + sNormalizedPath;
    }

    function serializeParams(oParams) {
        var aPairs = [];
        Object.keys(oParams || {}).forEach(function (sKey) {
            var vValue = oParams[sKey];
            if (vValue === undefined || vValue === null || vValue === "") {
                return;
            }
            aPairs.push(encodeURIComponent(sKey) + "=" + encodeURIComponent(String(vValue)));
        });
        return aPairs.join("&").replace(/\+/g, "%20");
    }

    function normalizeCandles(oPayload) {
        if (!oPayload) {
            return [];
        }
        var aRows = [];
        if (Array.isArray(oPayload.data)) {
            aRows = oPayload.data;
        } else if (Array.isArray(oPayload)) {
            aRows = oPayload;
        } else if (Array.isArray(oPayload.value)) {
            aRows = oPayload.value;
        }
        return aRows
            .map(function (row) {
                var ts = row.ts || row.time || row.datetime || row.date || row.timestamp || row.t;
                var time = Math.floor(new Date(ts).getTime() / 1000);
                var open = Number(row.open != null ? row.open : row.o);
                var high = Number(row.high != null ? row.high : row.h);
                var low = Number(row.low != null ? row.low : row.l);
                var close = Number(row.close != null ? row.close : row.c);
                var volume = Number(row.volume != null ? row.volume : row.v != null ? row.v : row.Volume != null ? row.Volume : 0);
                return {
                    time: time,
                    open: open,
                    high: high,
                    low: low,
                    close: close,
                    volume: volume
                };
            })
            .filter(function (row) {
                return Number.isFinite(row.time) &&
                    Number.isFinite(row.open) &&
                    Number.isFinite(row.high) &&
                    Number.isFinite(row.low) &&
                    Number.isFinite(row.close);
            })
            .sort(function (a, b) {
                return a.time - b.time;
            });
    }

    function requestCandles(mOptions) {
        if (!mOptions || !mOptions.symbol) {
            return Promise.reject(new Error("symbol requerido"));
        }

        var oParams = {
            symbol: mOptions.symbol,
            interval: mOptions.interval || "1hour",
            limit: mOptions.limit || 120,
            offset: mOptions.offset || 0
        };
        serviceConfig.appendLoggedUser(oParams);

        var sQuery = serializeParams(oParams);
        var sUrl = buildBaseUrl("api/candles/prev") + (sQuery ? "?" + sQuery : "");

        var mHeaders = {
            "Content-Type": "application/json"
        };
        serviceConfig.applyAuthHeaders(mHeaders);

        return fetch(sUrl, {
            method: "GET",
            headers: mHeaders
        }).then(function (oResponse) {
            if (!oResponse.ok) {
                return oResponse.text().then(function (text) {
                    var oError = new Error(oResponse.statusText || "No se pudieron obtener las velas.");
                    oError.status = oResponse.status;
                    oError.responseText = text;
                    if (text) {
                        try {
                            oError.payload = JSON.parse(text);
                            if (oError.payload && oError.payload.message) {
                                oError.message = oError.payload.message;
                            }
                        } catch (err) {
                            // sin parse JSON
                        }
                    }
                    throw oError;
                });
            }
            return oResponse.json();
        }).then(function (data) {
            return {
                symbol: data && data.symbol || oParams.symbol,
                interval: data && data.interval || oParams.interval,
                candles: normalizeCandles(data && data.data ? data : data)
            };
        });
    }

    function calcEMA(aCandles, iPeriod) {
        if (!Array.isArray(aCandles) || !iPeriod) {
            return [];
        }
        var k = 2 / (iPeriod + 1);
        var ema = [];
        var prev;
        aCandles.forEach(function (entry, index) {
            if (!Number.isFinite(entry.close)) {
                return;
            }
            if (index === 0) {
                prev = entry.close;
            } else {
                prev = entry.close * k + prev * (1 - k);
            }
            ema.push({
                time: entry.time,
                value: prev
            });
        });
        return ema;
    }

    function calcSMA(aCandles, iPeriod) {
        if (!Array.isArray(aCandles) || !iPeriod) {
            return [];
        }
        var result = [];
        var sum = 0;
        for (var i = 0; i < aCandles.length; i++) {
            sum += aCandles[i].close;
            if (i >= iPeriod) {
                sum -= aCandles[i - iPeriod].close;
            }
            if (i >= iPeriod - 1) {
                result.push({
                    time: aCandles[i].time,
                    value: sum / iPeriod
                });
            }
        }
        return result;
    }

    function calcRSI(aCandles, iPeriod) {
        if (!Array.isArray(aCandles) || aCandles.length <= iPeriod) {
            return [];
        }
        var rsi = [];
        var gains = 0;
        var losses = 0;

        for (var i = 1; i <= iPeriod; i++) {
            var diff = aCandles[i].close - aCandles[i - 1].close;
            if (diff >= 0) {
                gains += diff;
            } else {
                losses -= diff;
            }
        }

        gains /= iPeriod;
        losses /= iPeriod;

        var rs = losses === 0 ? 100 : gains / losses;
        rsi.push({
            time: aCandles[iPeriod].time,
            value: 100 - 100 / (1 + rs)
        });

        for (i = iPeriod + 1; i < aCandles.length; i++) {
            diff = aCandles[i].close - aCandles[i - 1].close;
            var gain = 0;
            var loss = 0;
            if (diff >= 0) {
                gain = diff;
            } else {
                loss = -diff;
            }
            gains = (gains * (iPeriod - 1) + gain) / iPeriod;
            losses = (losses * (iPeriod - 1) + loss) / iPeriod;
            var rsStep = losses === 0 ? 100 : gains / (losses || 1e-9);
            rsi.push({
                time: aCandles[i].time,
                value: 100 - 100 / (1 + rsStep)
            });
        }
        return rsi;
    }

    function calcSignals(aCandles, mOptions) {
        var options = mOptions || {};
        var emaShort = options.emaShort || [];
        var emaLong = options.emaLong || [];
        var rsi = options.rsi || [];

        var signals = [];
        if (!Array.isArray(aCandles) || aCandles.length === 0) {
            return signals;
        }

        var emaShortMap = new Map(emaShort.map(function (p) {
            return [p.time, p.value];
        }));
        var emaLongMap = new Map(emaLong.map(function (p) {
            return [p.time, p.value];
        }));
        var rsiMap = new Map(rsi.map(function (p) {
            return [p.time, p.value];
        }));

        var prevDiff;
        aCandles.forEach(function (candle) {
            var shortVal = emaShortMap.get(candle.time);
            var longVal = emaLongMap.get(candle.time);
            var rsiVal = rsiMap.get(candle.time);
            if (!Number.isFinite(shortVal) || !Number.isFinite(longVal)) {
                return;
            }
            var diff = shortVal - longVal;
            if (prevDiff !== undefined) {
                var crossedUp = prevDiff < 0 && diff >= 0;
                var crossedDown = prevDiff > 0 && diff <= 0;
                var rsiBuy = Number.isFinite(rsiVal) && rsiVal < 30;
                var rsiSell = Number.isFinite(rsiVal) && rsiVal > 70;

                if (crossedUp || rsiBuy) {
                    signals.push({
                        time: candle.time,
                        position: "belowBar",
                        color: "#20c997",
                        shape: "arrowUp",
                        text: "Compra"
                    });
                } else if (crossedDown || rsiSell) {
                    signals.push({
                        time: candle.time,
                        position: "aboveBar",
                        color: "#ff6b6b",
                        shape: "arrowDown",
                        text: "Venta"
                    });
                }
            }
            prevDiff = diff;
        });
        return signals;
    }

    function buildIndicators(aCandles) {
        if (!Array.isArray(aCandles) || aCandles.length === 0) {
            return {
                ema20: [],
                ema50: [],
                sma200: [],
                rsi14: [],
                signals: []
            };
        }
        var ema20 = calcEMA(aCandles, 20);
        var ema50 = calcEMA(aCandles, 50);
        var sma200 = calcSMA(aCandles, 200);
        var rsi14 = calcRSI(aCandles, 14);
        var signals = calcSignals(aCandles, {
            emaShort: ema20,
            emaLong: ema50,
            rsi: rsi14
        });
        return {
            ema20: ema20,
            ema50: ema50,
            sma200: sma200,
            rsi14: rsi14,
            signals: signals
        };
    }

    function buildVolumeLabel(aCandles) {
        if (!Array.isArray(aCandles) || aCandles.length === 0) {
            return "-";
        }
        var latest = aCandles[aCandles.length - 1];
        var volume = Number(latest.volume || 0);
        if (!Number.isFinite(volume)) {
            return "-";
        }
        return volume.toLocaleString("en-US") + " u.";
    }

    return {
        DEFAULT_SYMBOLS: DEFAULT_SYMBOLS,
        INTERVALS: INTERVALS,
        fetchCandles: requestCandles,
        buildIndicators: buildIndicators,
        buildVolumeLabel: buildVolumeLabel
    };
});
