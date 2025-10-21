namespace inv;

//src/api/models/schema.cds
/* ===== Core ===== */
@cds.persistence.skip //<-- Indica que no se debe crear tabla en la BD para este modelo en mongoDB (no relacional) sirve para definir entidades "virtuales"
//entonces en este caso no se crean tablas en la BD, pero si se pueden usar en el servicio OData sirviendo como puente para los modelos de /mongodb en  .js
entity Instruments {
  key ID               : String;
      ib_conid         : Integer;
      symbol           : String;
      sec_type         : String;
      exchange         : String;
      currency         : String;
      multiplier       : String;
      last_trade_date  : DateTime;
      trading_class    : String;
      underlying_conid : Integer;
      created_at       : DateTime;

      toCandles        : Composition of many Candles on toCandles.instrument_ID = $self.ID;
      toSignals        : Composition of many Signals  on toSignals.instrument_ID = $self.ID;
      toOrders         : Composition of many Orders on toOrders.instrument_id = $self.ID;
      toPositions      : Composition of many Positions on toPositions.instrument_ID = $self.ID;
      toOptionQuotes   : Composition of many OptionQuotes on toOptionQuotes.instrument_id = $self.ID;
      toExecutions     : Association to many Executions;
}


@cds.persistence.skip
entity MLDatasets {
  key ID               : String;
      name             : String;
      description      : String;
      spec_json        : LargeString; // JSON stringificado o texto
      instrument_conid : Integer;
      createdAt        : DateTime;
      updatedAt        : DateTime;
}

@cds.persistence.skip
entity Executions {
  key ID         : String;
      exec_id    : String;
      order_id   : String;
      ts         : DateTime;
      price      : Decimal(18, 4);
      qty        : Decimal(18, 6);
      commission : Decimal(18, 4);
      pnl        : Decimal(18, 4);
      createdAt  : DateTime;
      updatedAt  : DateTime;
}


@cds.persistence.skip
entity DailyPnls {
  key ID         : String;
      account    : String;
      date       : Date;
      realized   : Decimal(18, 4);
      unrealized : Decimal(18, 4);
      createdAt  : DateTime;
      updatedAt  : DateTime;
}


@cds.persistence.skip
entity Orders {
  key ID                : String;
      ib_order_id       : Integer;
      client_oid        : String;
      parent_client_oid : String;
      account           : String;
      instrument_id     : String; // <-- minúsculas como tu modelo
      side              : String;
      order_type        : String;
      qty               : Decimal(18, 6);
      limit_price       : Decimal(18, 4);
      aux_price         : Decimal(18, 4);
      tif               : String;
      status            : String;
      placed_at         : DateTime;
      last_update       : DateTime;
      meta              : LargeString;
      createdAt         : DateTime;
      updatedAt         : DateTime;
}

@cds.persistence.skip
entity RiskLimits {
  key ID                 : String;
      account            : String;
      max_daily_loss     : Decimal(18, 4);
      max_position_value : Decimal(18, 4);
      max_order_size     : Decimal(18, 6);
      max_gamma          : Decimal(18, 6);
      max_vega           : Decimal(18, 6);
      createdAt          : DateTime;
      updatedAt          : DateTime;
}

@cds.persistence.skip
entity Positions {
  key ID            : String;
      account       : String;
      instrument_ID : String;
      qty           : Decimal(18, 6);
      avg_price     : Decimal(18, 4);
      createdAt     : DateTime;
      updatedAt     : DateTime;
}

@cds.persistence.skip
entity Signals {
  key ID            : String;
      strategy_code : String;
      instrument_ID : String;
      ts            : DateTime;
      action        : String; // BUY, SELL, BUY_CALL...
      moneyness     : String; // ITM/ATM/OTM
      confidence    : Decimal(5, 3);
      features_json : LargeString;
      rationale     : String;
      createdAt     : DateTime;
      updatedAt     : DateTime;
}

@cds.persistence.skip
entity Backtests {
  key ID            : String;
      strategy_code : String;
      dataset_ID    : String;
      params_json   : LargeString;
      period_start  : DateTime;
      period_end    : DateTime;
      metrics_json  : LargeString;
      createdAt     : DateTime;
      updatedAt     : DateTime;
}

@cds.persistence.skip
entity Candles {
  key ID            : String;
      instrument_ID : String;
      bar_size      : String;
      ts            : DateTime;
      open          : Decimal(18, 4);
      high          : Decimal(18, 4);
      low           : Decimal(18, 4);
      close         : Decimal(18, 4);
      volume        : Decimal(18, 0);
      wap           : Decimal(18, 4);
      trade_count   : Integer;
      createdAt     : DateTime;
      updatedAt     : DateTime;
}

/* === Tus modelos nuevos === */
@cds.persistence.skip
entity MLModels {
  key ID                : String;
      name              : String;
      algo              : String;
      trainedAt         : DateTime;
      metricsJson       : LargeString;
      featureImportance : LargeString;
      createdAt         : DateTime;
      updatedAt         : DateTime;
}

@cds.persistence.skip
entity NewsArticles {
  key ID            : String;
      provider_code : String;
      article_id    : String;
      symbol        : String;
      conid         : Integer;
      published_at  : DateTime;
      headline      : String;
      body          : LargeString;
      sentiment     : Decimal(3, 2); // -1..1
      topics        : LargeString; // array stringificado si quieres
      createdAt     : DateTime;
      updatedAt     : DateTime;
}

@cds.persistence.skip
entity OptionChainSnapshots {
  key ID            : String;
      underlying_id : String; // ref Instrument
      ts            : DateTime;
      createdAt     : DateTime;
      updatedAt     : DateTime;
}

@cds.persistence.skip
entity OptionChainSnapshotItems {
  key ID          : String;
      snapshot_id : String; // ref snapshot
      option_id   : String; // ref Instrument (contract opción)
      strike      : Decimal(18, 4);
      right       : String; // C/P
      expiration  : Date;
      bid         : Decimal(18, 4);
      ask         : Decimal(18, 4);
      iv          : Decimal(9, 6);
      delta       : Decimal(9, 6);
      gamma       : Decimal(9, 6);
      theta       : Decimal(9, 6);
      vega        : Decimal(9, 6);
      createdAt   : DateTime;
      updatedAt   : DateTime;
}

@cds.persistence.skip
entity OptionQuotes {
  key ID            : String;
      instrument_id : String; // ref Instrument (opción)
      ts            : DateTime;
      bid           : Decimal(18, 4);
      ask           : Decimal(18, 4);
      last          : Decimal(18, 4);
      bid_size      : Decimal(18, 0);
      ask_size      : Decimal(18, 0);
      last_size     : Decimal(18, 0);
      iv            : Decimal(9, 6);
      delta         : Decimal(9, 6);
      gamma         : Decimal(9, 6);
      theta         : Decimal(9, 6);
      vega          : Decimal(9, 6);
      opt_price     : Decimal(18, 4);
      und_price     : Decimal(18, 4);
      createdAt     : DateTime;
      updatedAt     : DateTime;
}

@cds.persistence.skip
entity SecUsers {
  key ID               : String;
      name             : String;
      user             : String;
      email            : String;
      pass             : String;
      createdAt        : DateTime;
      updatedAt        : DateTime;
}