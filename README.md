# Land Registry on Hyperledger Fabric

This project is a blockchain-based land registry prototype built with Hyperledger Fabric, a Node.js backend, and a React/Vite frontend. It demonstrates how land certificate data can be issued, approved, sold, canceled, and audited on a permissioned blockchain network.

## Project Overview

The application simulates a land registry workflow where:
- a developer/admin can issue land clusters and certificates to the ledger,
- different actors such as developer, buyer, notary, and bank can interact with the same ledger through role-based access,
- certificate transactions can be initiated, approved, or canceled,
- each asset maintains an audit trail/history for traceability.

This version reflects the final update of the project, including:
- cluster-based certificate issuance,
- sale initiation and approval flow,
- cancellation flow with reason tracking,
- audit history retrieval,
- interactive map-style frontend for browsing land zones and units.

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, Lucide icons
- Backend: Express.js, CORS, Morgan, dotenv
- Blockchain: Hyperledger Fabric Gateway SDK
- Network: Hyperledger Fabric test network

## Project Structure

```text
backend/
  src/
    fabric.js      # Fabric gateway and identity setup
    server.js      # Express API endpoints
frontend/
  src/
    App.jsx        # Main UI and map-based workflow
    lib/api.js     # Frontend API client
```

## Main Features

### 1. Certificate issuance
The developer actor can publish a new cluster and create certificates for the land units.

### 2. Role-based access
The UI supports multiple actors:
- dev / developer
- pembeli / buyer
- notaris / notary
- bank

Each actor uses different Fabric identities from the test network.

### 3. Sale workflow
A buyer can initiate a transaction for a certificate, while the relevant actors can approve or cancel the request.

### 4. Audit trail
Each certificate can show its transaction history for transparency and traceability.

### 5. Interactive dashboard
The frontend presents the land registry as a map-based interface with zone selection and unit detail panels.

## Prerequisites

Before running the project, make sure you have:
- Node.js and npm installed
- Docker and Docker Compose available
- A running Hyperledger Fabric test network
- The Fabric certificates and keys available in the test-network folders

## Environment Configuration

The backend expects a configuration file at [backend/.env](backend/.env) with the Fabric channel, chaincode, peer endpoints, and MSP/cert paths.

The default setup points to the Fabric test network under the included Fabric samples directory.

## Running the Project

### 1. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Start the backend

```bash
cd backend
npm run dev
```

The API will run at:
- http://localhost:3001

### 3. Start the frontend

```bash
cd frontend
npm run dev
```

The UI will run at:
- http://localhost:5173

## Backend API Summary

The backend exposes these main endpoints:

### Health
- GET /health

### Identity
- GET /api/me/id?actor=dev
- GET /api/me/id?actor=pembeli
- GET /api/me/id?actor=notaris
- GET /api/me/id?actor=bank

### Certificates
- POST /api/certificates
- GET /api/certificates/:id
- GET /api/sertifikat/all

### Sale lifecycle
- POST /api/sales/initiate
- POST /api/sales/approve
- POST /api/sales/cancel

### History and actions
- GET /api/sertifikat/:id/history
- GET /api/assets
- GET /api/actions

## Notes

This project is intended as a thesis/final-project prototype. It focuses on demonstrating blockchain-based land registry concepts and workflow logic rather than full enterprise-grade production deployment.

## License

This project is for academic and demonstration purposes.
