# Express EJS 🚀

## Introduction
A robust Express.js 5 + EJS 3 boilerplate with secure defaults, structured middleware, dynamic router loading, file uploads, and production-ready logging. The stack uses modern ESM (type: module) and path aliases defined in package.json.

## Features

### Template Engine
- EJS 3.1.10 integration
- Layout-friendly partials
- Dynamic page rendering

### File Upload System
- Multer-based uploads with pluggable storage
- Local storage out of the box (public/uploads)
- Cloud providers prepared (commented placeholders until SDKs installed):
  - AWS S3, Azure Blob Storage, Google Cloud Storage, Naver Cloud Platform
- Automatic MIME type validation, file size limits, custom paths

### Security & Sessions
- Helmet security headers
- CORS enabled
- Rate limiting + Slowdown (express-rate-limit, express-slow-down)
- Session management via express-session + session-file-store
- Compression (gzip)

### Authentication & Access Control
- Passport.js (Local strategy) with login-attempt throttling
- Gatekeeper middleware: in production, restricts access to non-public routes unless authenticated

### Advanced Logging
- Winston with daily rotation (winston-daily-rotate-file)
- Morgan HTTP access logging (custom tokens: real-ip, user-id)
- Per-environment logs under logs/

## Project Structure
```
express-ejs/
├── bin/
│   └── www                    # Application entry point
├── ecosystem.config.cjs       # PM2 process configuration (dev/prod)
├── middleware/                # Middleware
│   ├── accessLogger.js        # Access logging via morgan → winston
│   ├── gatekeeper.js          # Auth gate for protected routes (prod)
│   ├── passport.js            # Passport local strategy + session wiring
│   ├── responseHandler.js     # res.success / res.error helpers
│   └── routerLoader.js        # Dynamic router auto-mounting
├── models/                    # Database models
├── public/                    # Static files served by Express
│   └── uploads/               # Uploaded files (local storage)
├── routes/                    # Route modules (auto-loaded)
├── sessions/                  # Session storage (FileStore)
├── utils/                     # Reusable utilities
│   ├── authorizer.js          # Role/permission guards
│   ├── db.js                  # MySQL pool + transaction helpers
│   ├── logger.js              # Winston logger factory
│   ├── throttler.js           # Rate/slow-down combinator
│   ├── uploader.js            # Multer + storage dispatcher (local/cloud)
│   └── validator.js           # express-validator integration
├── views/                     # EJS templates
├── app.js                     # Main Express app (middleware pipeline)
├── package.json               # ESM + path aliases (imports)
└── .env(.example)             # Environment configuration
```

## Prerequisites
- Node.js >= 18.x
- npm >= 9.x
- PM2 (optional) for process management

## Installation
```shell
# Clone repository
git clone git@github.com:jiwonio/express-ejs.git
cd express-ejs

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
# On Windows (PowerShell): Copy-Item .env.example .env
```

## Running the Application

- NPM script (local):
```shell
npm start
```
The server reads PORT from the environment (defaults to 3000). See bin/www.

- PM2 (development):
```shell
pm2 start ecosystem.config.cjs --only express-ejs/development
```

- PM2 (production):
```shell
pm2 start ecosystem.config.cjs --only express-ejs/production
```
The PM2 config sets PORT=3009 by default and uses wait_ready so the process signals readiness after listening.

## Configuration
Configure the following in your .env (see .env.example for a starting point):
```
# Storage Configuration (local, s3, azure, gcp, ncp)
STORAGE_TYPE=local

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-northeast-2
AWS_S3_BUCKET=your_bucket_name

# Azure Blob Storage Configuration
AZURE_STORAGE_CONNECTION_STRING=your_connection_string
AZURE_STORAGE_CONTAINER=your_container_name

# GCP Storage Configuration
GCP_BUCKET=your_bucket_name
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json

# NCP Storage Configuration
NCP_ACCESS_KEY=your_access_key
NCP_SECRET_KEY=your_secret_key
NCP_BUCKET=your_bucket_name

# Session Configuration
SESSION_SECRET=your_session_secret
TRUST_PROXY=false

# CORS Configuration
CORS_ORIGINS=*
CORS_CREDENTIALS=false

# Access Control
PUBLIC_PATHS=/,/examples,/login,/auth/login,/auth/logout,/auth/register,/stylesheets/,/fonts/,/images/,/javascripts/
ALLOWED_IPS=*

# Database Configuration
# DB_PASSWORD may be empty for local development, but production should use a dedicated password.
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_DATABASE=your_database
```

## File Upload Usage
utils/uploader.js exports a default uploader object with presets (profile, product, sample, default). Each preset provides .single(field) and .array(field, maxCount) that return arrays of middleware (multer + storage writer).

```javascript
import express from 'express';
import uploader from '#utils/uploader';

const router = express.Router();

// Single file upload (profile avatar)
router.post(
  '/upload',
  ...uploader.profile.single('avatar'),
  (req, res) => {
    return res.json({ url: req.file?.location }); // location is set by storage layer
  }
);

// Multiple files upload (product photos)
router.post(
  '/upload-multiple',
  ...uploader.product.array('photos', 5),
  (req, res) => {
    const urls = (req.files || []).map(f => f.location);
    return res.json({ urls });
  }
);

export default router;
```

Notes:
- Local storage works out of the box and saves files under public/uploads (returned URLs are web-accessible).
- Cloud providers are prepared but commented in utils/uploader.js. To use them, install the SDKs and enable the storage in getStorage():
  - AWS S3: @aws-sdk/client-s3 @aws-sdk/lib-storage
  - GCP: @google-cloud/storage
  - Azure: @azure/storage-blob
  - NCP: aws-sdk

## Middleware Pipeline (app.js)
Order of middleware (simplified):
1. compression
2. helmet, cors
3. parsers (json, urlencoded, cookies)
4. session (FileStore)
5. passport initialization + session
6. gatekeeper (protect routes in production)
7. accessLogger (morgan → winston)
8. responseHandler (res.success / res.error)
9. throttler (slowDown + rateLimit)
10. static files (public/)
11. dynamic router loading (routes/**/*)
12. 404 and centralized error handler

## Logging
- All logs are written under logs/ with daily rotation
- Access logs via morgan, application/error logs via winston
- Cluster-aware prefixes (master/worker) in log lines

## Contributing
Contributions are always welcome! Feel free to submit a Pull Request.

## License
This project is licensed under The Unlicense (see LICENSE).

## Dependencies
The main runtime dependencies (from package.json):
```json
{
  "bcrypt": "^6.0.0",
  "compression": "^1.8.0",
  "cookie-parser": "~1.4.4",
  "cors": "^2.8.5",
  "dotenv": "^16.5.0",
  "ejs": "3.1.10",
  "express": "5.1.0",
  "express-rate-limit": "^7.5.0",
  "express-session": "^1.19.0",
  "express-slow-down": "^2.1.0",
  "express-validator": "^7.3.2",
  "helmet": "^8.1.0",
  "http-errors": "~1.6.3",
  "morgan": "^1.12.0",
  "multer": "^2.3.0",
  "mysql2": "^3.24.4",
  "passport": "^0.7.0",
  "passport-local": "^1.0.0",
  "session-file-store": "^1.5.0",
  "winston": "^3.17.0",
  "winston-daily-rotate-file": "^5.0.0"
}
```
