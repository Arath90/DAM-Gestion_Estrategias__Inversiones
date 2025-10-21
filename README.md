# API CRUD Service Documentation

## Overview

This document explains the full architecture and behavior of your **CAP + MongoDB hybrid API**, focused on the `crud.service.js` core and its relation with the rest of the system. It also details why this design supports full RESTful verbs (`GET`, `POST`, `PATCH`, `PUT`, `DELETE`) without needing POST overrides, how it logs operations, and the reasons behind each structural choice.

---

## 1. High-Level Architecture

### Components

* **CAP Runtime (cds.ApplicationService)** — Handles OData routing, HTTP parsing, and verb mapping.
* **CatalogService (service)** — Declares all entities in CDS and binds the implementation controller.
* **catalog-controller.js (controller)** — Registers each entity with the generic CRUD system.
* **crud.service.js (service)** — Implements the generic CRUD logic, error management, and unified logging.
* **respPWA.handler.js (middleware)** — Provides `BITACORA`, `DATA`, and helpers `OK`, `FAIL`, `AddMSG` for consistent structured responses.
* **schema.cds (CDS Model)** — Declares virtual entities (`@cds.persistence.skip`) that map logically to Mongo collections.
* **Mongoose Models (MongoDB)** — Real storage schemas.

### Flow Diagram

```
[HTTP Request]
     ↓
[CAP Router → OData Layer]
     ↓
[CatalogService] → [Controller: catalog-controller.js]
     ↓
[Generic CRUD registration → crud.service.js]
     ↓
[wrapOperation()] → [Handler logic by DB type]
     ↓
[BITACORA + DATA structures (respPWA.handler)]
     ↓
[Response OK / FAIL with proper HTTP status]
```

---

## 2. Core Functionalities

### 2.1 wrapOperation()

This is the **heart** of the system. It wraps every CRUD handler in standardized logic, ensuring all requests:

* Are validated (`ProcessType` required, `ID` checked, etc.)
* Have a consistent **bitácora** (trace) entry.
* Handle errors uniformly with `req.error()` if `STRICT_HTTP_ERRORS=true`.
* Return a unified payload structure (`OK` or `FAIL`).

**Responsibilities:**

1. Extracts and prioritizes metadata from the request:

   * `LoggedUser`: query → header → body → fallback `anonymous`.
   * `ProcessType`: required for operation identification.
   * `dbServer`: normalized to lowercase (supports `MongoDB` / `HANA`).
   * `idParam`: automatically resolved from body, params, or query.
2. Executes handler (the actual CRUD logic for the entity).
3. Handles all outcomes:

   * Success → sets `res.status(code)` and returns `OK(bitacora)`.
   * Error → creates `FAIL(bitacora)` or triggers `req.error()`.

### 2.2 registerCRUD()

This function registers handlers for `READ`, `CREATE`, `UPDATE`, and `DELETE` operations for each entity defined in CDS. It dynamically adapts depending on the **target database**:

#### For MongoDB

* Uses **Mongoose** to query documents.
* Wraps each response with `mapOut()` (renames `_id` → `ID`).
* Provides fallback queries for cases when `findById()` fails (ObjectId stored as string).

#### For HANA

* Uses **cds.run(SELECT/INSERT/UPDATE/DELETE)** for direct SQL execution.
* Integrates `$top` and `$skip` parameters for pagination.

---

## 3. CRUD Endpoints

| Operation          | Method | Example URL                                                                                                         | Description                                         |
| ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **List All**       | GET    | `/odata/v4/catalog/Instruments?ProcessType=GetAll&dbServer=MongoDB&LoggedUser=Arath`                                | Retrieves all instruments with optional pagination. |
| **Get by ID**      | GET    | `/odata/v4/catalog/Instruments('68f1a9348fdef67ade05ed32')?ProcessType=GetById&dbServer=MongoDB&LoggedUser=Arath`   | Fetches one entity by ID.                           |
| **Create**         | POST   | `/odata/v4/catalog/Instruments?ProcessType=AddOne&dbServer=MongoDB&LoggedUser=Arath`                                | Adds a new record.                                  |
| **Update Partial** | PATCH  | `/odata/v4/catalog/Instruments('68f1a6d5843e328fab8cc9de')?ProcessType=UpdateOne&dbServer=MongoDB&LoggedUser=Arath` | Updates specific fields.                            |
| **Replace Full**   | PUT    | `/odata/v4/catalog/Instruments('68f1a6d5843e328fab8cc9de')?ProcessType=UpdateOne&dbServer=MongoDB&LoggedUser=Arath` | Replaces the entire document.                       |
| **Delete**         | DELETE | `/odata/v4/catalog/Instruments('68f1a6d5843e328fab8cc9de')?ProcessType=DeleteOne&dbServer=MongoDB&LoggedUser=Arath` | Removes a record.                                   |

### Why PATCH/PUT/DELETE Work without POST Override

* OData v4 fully supports these HTTP verbs natively.
* CAP automatically maps verbs to service handlers based on path (`EntitySet('key')`).
* No need for `X-HTTP-Method-Override`.
* If the client mistakenly calls `/EntitySet?ID=...`, CAP blocks with 405 (by design).

---

## 4. Bitácora (Audit & Logging)

Each transaction produces a structured **bitácora** entry:

```json
{
  "success": true,
  "status": 200,
  "process": "Lectura de CatalogService.Instruments",
  "loggedUser": "Arath",
  "dbServer": "mongo",
  "data": [ ... ],
  "messageUSR": "Operación realizada con éxito.",
  "messageDEV": "OK READ CatalogService.Instruments [db:mongo]"
}
```

**Behavior:**

* Each response, whether OK or FAIL, is appended using `AddMSG()`.
* Ensures consistency across all endpoints.
* Includes user, DB, processType, and status for traceability.

### Error Handling Flow

| Type                   | Example                            | HTTP Code                 | Origin                   |
| ---------------------- | ---------------------------------- | ------------------------- | ------------------------ |
| Missing ProcessType    | `Missing query param: ProcessType` | 400                       | wrapOperation validation |
| Invalid ID             | `ID inválido`                      | 400                       | CRUD validator           |
| Not Found              | `No encontrado`                    | 404                       | CRUD handler             |
| Bad JSON               | `Invalid JSON in request body`     | 400                       | Express middleware       |
| Unsupported Media Type | `415`                              | CAP parser before handler |                          |
| DB Error               | `Mongo or HANA driver message`     | 500                       | catch fallback           |

---

## 5. Helper Functions (Key Internals)

### isValidObjectId(id)

Validates if a string is a valid Mongo ObjectId (24 hex chars).

### mapIn(data)

Cleans client payload by removing `ID` and returning the rest (used for inserts/updates).

### mapOut(doc)

Converts Mongo `_id` to `ID` and strips internal fields (`__v`).

### readQueryBounds(req)

Extracts `$top` and `$skip` for pagination.

### extractId(req)

Finds an `ID` from multiple request sources (body, params, query).

---

## 6. Why This Design is Resilient and Scalable

### ✅ Unified CRUD Logic

One function (`registerCRUD`) handles all entities, reducing boilerplate and maintenance cost.

### ✅ Dual Database Support

Switching between HANA and Mongo is transparent—no duplicated handlers.

### ✅ Strict yet Flexible Validation

`ProcessType`, `LoggedUser`, and `dbServer` are enforced but tolerant to different naming formats (`mongo`, `MongoDB`, `mongodb`).

### ✅ True REST/OData Compliance

You can call CAP-native verbs directly (GET/POST/PATCH/DELETE) without tunneling or overrides.

### ✅ Predictable Error and Status Codes

Each operation sets its own HTTP status properly. `res.status()` ensures the code is reflected at the transport level.

### ✅ Full Traceability via Bitácora

Every transaction is logged in a consistent format. This enables audit trails, debugging, and analytics without needing external middleware.

---

## 7. Relationships Between Components

| Component                 | Role                                       | Communicates With                  |
| ------------------------- | ------------------------------------------ | ---------------------------------- |
| **CAP Service**           | Entry point for OData verbs.               | Controller (handlers)              |
| **catalog-controller.js** | Registers CRUD for each CDS entity.        | crud.service.js                    |
| **crud.service.js**       | Core CRUD and bitácora handling.           | respPWA.handler, Mongoose, cds.run |
| **respPWA.handler.js**    | Builds structured responses.               | CRUD Service                       |
| **schema.cds**            | Logical model definition (no persistence). | CAP runtime                        |
| **Mongoose Models**       | Physical data layer (MongoDB).             | CRUD Service                       |

---

## 8. Potential Optimizations (Future Work)

1. **Field Whitelisting:** Filter user query params to prevent unwanted Mongo filters.
2. **DB Normalization Helper:** Convert all `dbServer` variants to canonical forms automatically.
3. **Custom Error Mapping:** Translate DB-specific errors (duplicate keys, constraint violations) into semantic HTTP codes.
4. **Pre/Post Hooks:** Add standardized `beforeAll` / `afterAll` handlers for logging or caching.
5. **Performance Metrics:** Wrap operations with timing logs or Prometheus-compatible metrics for monitoring.

---

## 9. Summary

This API is a **clean, stateless, and dual-database CRUD architecture** that:

* Fully complies with OData v4.
* Uses native HTTP verbs.
* Centralizes validation, logging, and error handling.
* Maintains clear separation between model (CDS), service (CAP), and data (Mongo).
* Is extensible for future entities and databases.

It achieves production-level stability and predictability while remaining easy to maintain.
