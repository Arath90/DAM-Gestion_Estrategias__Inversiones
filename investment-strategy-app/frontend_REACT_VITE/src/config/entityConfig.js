// Este archivo centraliza la configuración de cada entidad para generar vistas dinámicas.
// Define los campos a mostrar en tablas y formularios.

export const ENTITY_CONFIG = {
    Instruments: { 
        fields: ['ib_conid', 'symbol', 'sec_type', 'exchange', 'currency', 'last_trade_date', 'trading_class'],
        api: 'InstrumentsAPI'
    },
    MLDatasets: { 
        fields: ['name', 'description', 'instrument_conid', 'createdAt'],
        api: 'MLDatasetsAPI' 
    },
    Executions: { 
        fields: ['exec_id', 'order_id', 'ts', 'price', 'qty', 'commission', 'pnl'],
        api: 'ExecutionsAPI' 
    },
    DailyPnls: { 
        fields: ['account', 'date', 'realized', 'unrealized'],
        api: 'DailyPnlsAPI' 
    },
    Orders: { 
        fields: ['client_oid', 'account', 'instrument_id', 'side', 'order_type', 'qty', 'status', 'placed_at'],
        api: 'OrdersAPI' 
    },
    RiskLimits: { 
        fields: ['account', 'max_daily_loss', 'max_position_value', 'max_order_size'],
        api: 'RiskLimitsAPI' 
    },
    Positions: { 
        fields: ['account', 'instrument_ID', 'qty', 'avg_price'],
        api: 'PositionsAPI' 
    },
    Signals: { 
        fields: ['strategy_code', 'instrument_ID', 'ts', 'action', 'confidence'],
        api: 'SignalsAPI' 
    },
    Backtests: { 
        fields: ['strategy_code', 'dataset_ID', 'period_start', 'period_end'],
        api: 'BacktestsAPI' 
    },
    Candles: { 
        fields: ['instrument_ID', 'bar_size', 'ts', 'open', 'high', 'low', 'close'],
        api: 'CandlesAPI' 
    },
    MLModels: { 
        fields: ['name', 'algo', 'trainedAt'],
        api: 'MLModelsAPI' 
    },
    NewsArticles: { 
        fields: ['provider_code', 'symbol', 'published_at', 'headline', 'sentiment'],
        api: 'NewsArticlesAPI' 
    },
    OptionQuotes: { 
        fields: ['instrument_id', 'ts', 'bid', 'ask', 'last', 'iv', 'delta'],
        api: 'OptionQuotesAPI' 
    },
};