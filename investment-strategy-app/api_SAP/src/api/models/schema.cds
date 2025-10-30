namespace inv;

// src/api/models/schema.cds
// Cada entidad CAP actua como una fachada hacia el modelo equivalente en MongoDB.
// Se marca @cds.persistence.skip porque la persistencia real la gestiona Mongoose.

/* ===== Core ===== */

@cds.persistence.skip
entity Instruments {
  key ID               : String;      // Exponemos el ObjectId de Mongo como String para facilitar las llamadas OData.
      ib_conid         : Integer;     // Identificador numerico provisto por IBKR.
      symbol           : String;      // Simbolo bursatil (alfanumerico).
      sec_type         : String;      // Tipo de instrumento (STK, FUT, OPT...), expresado como texto corto.
      exchange         : String;      // Bolsa/venue donde cotiza.
      currency         : String;      // Moneda principal de cotizacion.
      multiplier       : String;      // Multiplicador del contrato. Se mantiene como String porque algunos activos lo entregan como texto.
      last_trade_date  : DateTime;    // Fecha y hora del ultimo trade reportado.
      trading_class    : String;      // Clase bursatil o grupo de cotizacion definido por la bolsa.
      underlying_conid : Integer;     // CONID del subyacente, cuando aplica.
      created_at       : DateTime;    // Marca temporal de creacion en la fuente original.

      toCandles        : Composition of many Candles       on toCandles.instrument_ID = $self.ID;       // Relacion virtual a velas historicas.
      toSignals        : Composition of many Signals       on toSignals.instrument_ID = $self.ID;        // Señales generadas sobre el instrumento.
      toOrders         : Composition of many Orders        on toOrders.instrument_id = $self.ID;         // Ordenes que referencian al instrumento.
      toPositions      : Composition of many Positions     on toPositions.instrument_ID = $self.ID;      // Posiciones abiertas en el instrumento.
      toOptionQuotes   : Composition of many OptionQuotes  on toOptionQuotes.instrument_id = $self.ID;   // Cotizaciones de opciones relacionadas.
      toExecutions     : Association to many Executions;   // Ejecuciones asociadas mediante order_id.
}

@cds.persistence.skip
entity MLDatasets {
  key ID               : String;      // Identificador del dataset (ObjectId expuesto como String).
      name             : String;      // Nombre del dataset.
      description      : String;      // Descripcion legible para analistas.
      spec_json        : LargeString; // Especificacion tecnica (JSON stringificado) potencialmente extensa.
      instrument_conid : Integer;     // CONID asociado si el dataset esta ligado a un activo.
      createdAt        : DateTime;    // Timestamps generados por Mongo.
      updatedAt        : DateTime;
}

@cds.persistence.skip
entity Executions {
  key ID         : String;       // Identificador de la ejecucion.
      exec_id    : String;       // ExecId del broker, puede contener prefijos alfabeticos.
      order_id   : String;       // Referencia a la orden (String para mapear contra ObjectId).
      ts         : DateTime;     // Marca temporal exacta de la ejecucion.
      price      : Decimal(18, 4); // Precio de ejecucion con precision de centavos.
      qty        : Decimal(18, 6); // Cantidad ejecutada, permite fracciones.
      commission : Decimal(18, 4); // Comision cobrada.
      pnl        : Decimal(18, 4); // PnL resultante de la ejecucion.
      createdAt  : DateTime;     // Auditoria.
      updatedAt  : DateTime;
}

@cds.persistence.skip
entity DailyPnls {
  key ID         : String;       // Identificador de registro diario.
      account    : String;       // Cuenta a la que corresponde el PnL.
      date       : Date;         // Dia contable (sin hora).
      realized   : Decimal(18, 4); // PnL realizado con precision de centavos.
      unrealized : Decimal(18, 4); // PnL mark-to-market.
      createdAt  : DateTime;     // Auditoria.
      updatedAt  : DateTime;
}

@cds.persistence.skip
entity Orders {
  key ID                : String;       // Identificador de la orden.
      ib_order_id       : Integer;      // OrderId numerico provisto por IBKR.
      client_oid        : String;       // Client Order Id (UUID o string personalizado).
      parent_client_oid : String;       // Identificador de la orden padre cuando existe jerarquia.
      account           : String;       // Cuenta que origina la orden.
      instrument_id     : String;       // ObjectId del instrumento representado como String.
      side              : String;       // BUY / SELL.
      order_type        : String;       // Tipo de orden (MKT, LMT, STP...).
      qty               : Decimal(18, 6); // Cantidad solicitada permitiendo fracciones.
      limit_price       : Decimal(18, 4); // Precio limite cuando aplica.
      aux_price         : Decimal(18, 4); // Precio auxiliar (stop, trigger, etc.).
      tif               : String;       // Time in force (DAY, GTC...).
      status            : String;       // Estado actual de la orden.
      placed_at         : DateTime;     // Momento en que se coloca.
      last_update       : DateTime;     // Ultimo cambio reportado por el broker.
      meta              : LargeString;  // Metadata libre (JSON stringificado).
      createdAt         : DateTime;     // Auditoria.
      updatedAt         : DateTime;
}

@cds.persistence.skip
entity RiskLimits {
  key ID                 : String;       // Identificador del conjunto de limites.
      account            : String;       // Cuenta a la que se aplican.
      max_daily_loss     : Decimal(18, 4); // Perdida diaria maxima permitida.
      max_position_value : Decimal(18, 4); // Valor nocional maximo de posiciones abiertas.
      max_order_size     : Decimal(18, 6); // Tamaño maximo por orden.
      max_gamma          : Decimal(18, 6); // Limite de sensibilidad (gamma) con alta precision.
      max_vega           : Decimal(18, 6); // Limite de vega.
      createdAt          : DateTime;     // Auditoria.
      updatedAt          : DateTime;
}

@cds.persistence.skip
entity Positions {
  key ID            : String;       // Identificador de la posicion.
      account       : String;       // Cuenta que mantiene la posicion.
      instrument_ID : String;       // Enlace al instrumento (ObjectId como String).
      qty           : Decimal(18, 6); // Cantidad total, permite fracciones.
      avg_price     : Decimal(18, 4); // Precio promedio de entrada.
      createdAt     : DateTime;     // Auditoria.
      updatedAt     : DateTime;
}

@cds.persistence.skip
entity Signals {
  key ID            : String;       // Identificador de la señal.
      strategy_code : String;       // Codigo de la estrategia que la emitio.
      instrument_ID : String;       // Instrumento objetivo (ObjectId como String).
      ts            : DateTime;     // Hora exacta de emision.
      action        : String;       // Accion recomendada (BUY, SELL, BUY_CALL...).
      moneyness     : String;       // ITM/ATM/OTM.
      confidence    : Decimal(5, 3); // Confianza normalizada (0-1).
      features_json : LargeString;  // JSON con caracteristicas utilizadas.
      rationale     : String;       // Explicacion legible para el usuario.
      createdAt     : DateTime;     // Auditoria.
      updatedAt     : DateTime;
}

@cds.persistence.skip
entity Backtests {
  key ID            : String;       // Identificador del run de backtest.
      strategy_code : String;       // Estrategia evaluada.
      dataset_ID    : String;       // Dataset utilizado (String para mapear ObjectId).
      params_json   : LargeString;  // Parametros del backtest (JSON stringificado).
      period_start  : DateTime;     // Fecha/hora de inicio.
      period_end    : DateTime;     // Fecha/hora de fin.
      metrics_json  : LargeString;  // Resultados (JSON).
      createdAt     : DateTime;     // Auditoria.
      updatedAt     : DateTime;
}

@cds.persistence.skip
entity Candles {
  key ID            : String;       // Identificador logico de la vela (generado en runtime).
      instrument_ID : String;       // Instrumento relacionado (ObjectId como String).
      bar_size      : String;       // Resolucion (1min, 1h...).
      ts            : DateTime;     // Timestamp de apertura.
      open          : Decimal(18, 4); // Precio de apertura.
      high          : Decimal(18, 4); // Maximo.
      low           : Decimal(18, 4); // Minimo.
      close         : Decimal(18, 4); // Cierre.
      volume        : Decimal(18, 0); // Volumen negociado (entero) si el proveedor lo expone.
      wap           : Decimal(18, 4); // Weighted average price cuando aplica.
      trade_count   : Integer;      // Numero de operaciones (puede venir vacio segun el proveedor).
      createdAt     : DateTime;     // Mantener campos legacy para compatibilidad; normalmente iran vacios.
      updatedAt     : DateTime;
}

/* ===== Modelos complementarios ===== */

@cds.persistence.skip
entity MLModels {
  key ID                : String;      // Identificador del modelo de ML.
      name              : String;      // Nombre descriptivo.
      algo              : String;      // Algoritmo utilizado.
      trainedAt         : DateTime;    // Fecha de entrenamiento.
      metricsJson       : LargeString; // Metricas de evaluacion en formato JSON.
      featureImportance : LargeString; // Importancia de features (JSON).
      createdAt         : DateTime;    // Auditoria.
      updatedAt         : DateTime;
}

@cds.persistence.skip
entity NewsArticles {
  key ID            : String;      // Identificador de la noticia.
      provider_code : String;      // Proveedor (DowJones, etc.).
      article_id    : String;      // ID propio del proveedor.
      symbol        : String;      // Simbolo asociado.
      conid         : Integer;     // CONID relacionado si aplica.
      published_at  : DateTime;    // Fecha y hora de publicacion.
      headline      : String;      // Titular.
      body          : LargeString; // Contenido completo (puede ser extenso).
      sentiment     : Decimal(3, 2); // Puntaje de sentimiento (-1 a 1).
      topics        : LargeString; // Lista de temas como JSON stringificado.
      createdAt     : DateTime;   // Auditoria.
      updatedAt     : DateTime;
}

@cds.persistence.skip
entity OptionChainSnapshots {
  key ID            : String;      // Identificador del snapshot.
      underlying_id : String;      // Instrumento subyacente (String).
      ts            : DateTime;    // Momento en que se tomo la fotografia.
      createdAt     : DateTime;    // Auditoria.
      updatedAt     : DateTime;
}

@cds.persistence.skip
entity OptionChainSnapshotItems {
  key ID          : String;       // Identificador del registro dentro del snapshot.
      snapshot_id : String;       // Referencia al snapshot.
      option_id   : String;       // Instrumento opcion referenciado.
      strike      : Decimal(18, 4); // Strike price.
      right       : String;       // Derecho (Call/Put).
      expiration  : Date;         // Fecha de expiracion.
      bid         : Decimal(18, 4); // Precio bid.
      ask         : Decimal(18, 4); // Precio ask.
      iv          : Decimal(9, 6); // Volatilidad implicita.
      delta       : Decimal(9, 6); // Sensibilidades (greeks) con alta precision.
      gamma       : Decimal(9, 6);
      theta       : Decimal(9, 6);
      vega        : Decimal(9, 6);
      createdAt   : DateTime;     // Auditoria.
      updatedAt   : DateTime;
}

@cds.persistence.skip
entity OptionQuotes {
  key ID            : String;       // Identificador del quote.
      instrument_id : String;       // Referencia a la opcion (String).
      ts            : DateTime;     // Timestamp de la cotizacion.
      bid           : Decimal(18, 4); // Precio bid.
      ask           : Decimal(18, 4); // Precio ask.
      last          : Decimal(18, 4); // Ultimo precio negociado.
      bid_size      : Decimal(18, 0); // Cantidad en bid (entero).
      ask_size      : Decimal(18, 0); // Cantidad en ask.
      last_size     : Decimal(18, 0); // Tamaño del ultimo trade.
      iv            : Decimal(9, 6); // Volatilidad implicita.
      delta         : Decimal(9, 6); // Greeks en alta precision.
      gamma         : Decimal(9, 6);
      theta         : Decimal(9, 6);
      vega          : Decimal(9, 6);
      opt_price     : Decimal(18, 4); // Precio teorico de la opcion.
      und_price     : Decimal(18, 4); // Precio del subyacente.
      createdAt     : DateTime;     // Auditoria.
      updatedAt     : DateTime;
}

@cds.persistence.skip
entity SecUsers {
  key ID        : String;    // Identificador del usuario.
      name      : String;    // Nombre completo.
      user      : String;    // Username para autenticacion.
      email     : String;    // Correo electronico.
      pass      : String;    // Hash de contraseña almacenado como texto.
      createdAt : DateTime;  // Auditoria.
      updatedAt : DateTime;
}

entity Strategies @cds.persistence.skip {
  key ID               : String;
      strategy_code    : String;
      dataset_id       : String;
      period_start     : DateTime;
      period_end       : DateTime;
      name             : String;
      type             : String;
      status           : String;
      owner            : String;
      frequency        : String;
      capitalAllocated : Decimal(15,2);
      tags             : array of String;
      description      : LargeString;
      params_json      : LargeString;
      metrics_json     : LargeString;
      createdAt        : DateTime;
      updatedAt        : DateTime;
}