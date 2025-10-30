
# Investment Strategy App

Este sistema es una plataforma integral para la gestión, monitoreo y análisis de estrategias de inversión financiera. Permite a los usuarios crear, modificar y visualizar instrumentos, posiciones, señales y otros elementos clave del portafolio, integrando datos de mercado y facilitando la toma de decisiones informadas tanto para usuarios individuales como para equipos de inversión.

## Project Structure

```
investment-strategy-app
├── api                  # Backend API
│   ├── src
│   │   ├── models      # MongoDB models
│   │   ├── controllers # Business logic for API endpoints
│   │   ├── routes      # API endpoint definitions
│   │   ├── app.js      # Entry point for the API application
│   │   └── config      # Database configuration
│   ├── package.json     # API dependencies and scripts
│   ├── .babelrc        # Babel configuration
│   └── README.md       # Documentation for the API
├── frontend             # Frontend application
│   ├── src
│   │   ├── components   # React components
│   │   ├── pages        # Page components
│   │   ├── App.jsx      # Main application component
│   │   └── main.jsx     # Entry point for the React application
│   ├── public           # Static assets
│   ├── package.json     # Frontend dependencies and scripts
│   ├── vite.config.js   # Vite configuration
│   └── README.md        # Documentation for the frontend
└── README.md            # Overall project documentation
```

## Features

- **API Backend**: Built with Node.js and Express, providing RESTful endpoints for managing investment strategies.
- **MongoDB Integration**: Utilizes MongoDB for data storage, with models defined for various entities such as instruments, candles, option quotes, and more.
- **Frontend Application**: Developed using React and Vite, offering a responsive user interface for interacting with the investment strategies.

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- MongoDB (local or cloud instance)

### Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd investment-strategy-app
   ```

2. Install dependencies for the API:
   ```
   cd api
   npm install
   ```

3. Install dependencies for the frontend:
   ```
   cd ../frontend
   npm install
   ```

### Running the Application

1. Start the MongoDB server (if running locally).
2. Start the API:
   ```
   cd api
   npm start
   ```

3. Start the frontend:
   ```
   cd ../frontend
   npm run dev
   ```

### API Documentation

Refer to the `api/README.md` file for detailed information on the API endpoints and usage.

### Frontend Documentation

Refer to the `frontend/README.md` file for detailed information on the frontend application and its components.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.