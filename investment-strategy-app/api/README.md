# Investment Strategy API

This API serves as the backend for the Investment Strategy application. It is built using Node.js, Express, and MongoDB, providing endpoints to manage various aspects of investment strategies, including instruments, market data, signals, orders, and more.

## Project Structure

- **src/**: Contains the source code for the API.
  - **models/**: Defines the MongoDB models for the application.
  - **controllers/**: Contains the business logic for handling API requests.
  - **routes/**: Defines the API endpoints and links them to the appropriate controllers.
  - **config/**: Contains configuration files, including database connection settings.
  - **app.js**: The entry point for the API application.

## Getting Started

### Prerequisites

- Node.js
- MongoDB

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   ```

2. Navigate to the API directory:
   ```
   cd investment-strategy-app/api
   ```

3. Install the dependencies:
   ```
   npm install
   ```

### Running the API

To start the API server, run:
```
npm start
```

The server will be running on `http://localhost:3000` by default.

### API Endpoints

The API provides various endpoints to interact with the investment strategy data. Refer to the `routes` directory for detailed endpoint definitions.

### Contributing

Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

### License

This project is licensed under the MIT License. See the LICENSE file for details.