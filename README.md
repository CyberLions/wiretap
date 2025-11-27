# Wiretap

**OpenStack VM Management Platform**

Wiretap is a comprehensive web-based platform for managing OpenStack virtual machine instances, designed for educational workshops, competitions, and team-based environments. It provides a user-friendly interface for provisioning, monitoring, and controlling VM instances with advanced features like scheduled lockouts, team management, and console access.

## 🚀 Features

### Core Functionality
- **VM Instance Management**: Create, update, delete, and monitor OpenStack VM instances
- **Power Controls**: Start, stop, restart instances with soft/hard reboot options
- **Real-time Status Sync**: Automatic synchronization with OpenStack every 30 seconds
- **Console Access**: VNC/NoVNC console access for direct VM interaction
- **Multi-Provider Support**: Manage instances across multiple OpenStack providers

### Workshop & Team Management
- **Workshop Organization**: Organize instances by workshops with custom configurations
- **Team Management**: Assign users to teams with role-based access control
- **Scheduled Lockouts**: Automatically lock/unlock instances based on time windows
- **Competition Mode**: Support for competitive environments with access restrictions

### User Management
- **Role-Based Access Control**: Admin, Service Account, and regular user roles
- **OpenID Connect Integration**: SSO authentication support
- **JWT Authentication**: Secure token-based authentication
- **Bulk User Operations**: Generate and manage multiple users efficiently
- **Pending Team Assignments**: Manage team membership requests

### Administrative Features
- **Provider Management**: Configure and test OpenStack provider connections
- **Instance Lockout Controls**: Manual lock/unlock capabilities for instances
- **System Statistics**: Dashboard with usage statistics and metrics
- **Audit Logging**: Comprehensive logging system with automatic cleanup
- **Service Account Management**: Create and manage service accounts for automation

### Developer Features
- **RESTful API**: Well-documented REST API with Swagger/OpenAPI documentation
- **WebSocket Support**: Real-time communication capabilities
- **Scheduled Tasks**: Automated background tasks for maintenance
- **Database Abstraction**: MySQL-based data persistence

## 🏗️ Architecture

### Backend
- **Framework**: Express.js (Node.js)
- **Database**: MySQL
- **Authentication**: JWT + OpenID Connect
- **API Documentation**: Swagger/OpenAPI
- **Scheduled Tasks**: Automated instance sync, session cleanup, log maintenance

### Frontend
- **Framework**: Vue.js 3
- **Build Tool**: Vite
- **UI Library**: Headless UI + Heroicons
- **Styling**: Tailwind CSS
- **State Management**: Pinia

## 📋 Prerequisites

- Node.js (v16 or higher)
- MySQL (v5.7 or higher)
- OpenStack environment with API access
- npm or yarn package manager

## 🔧 Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd wiretap
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:
```env
# Database Configuration
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=wiretap
DB_PORT=3306

# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

# OpenID Connect (Optional)
OPENID_ISSUER=https://your-oidc-provider.com
OPENID_CLIENT_ID=your_client_id
OPENID_CLIENT_SECRET=your_client_secret
OPENID_REDIRECT_URI=http://localhost:3000/api/auth/openid/callback

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory:
```env
VITE_API_URL=http://localhost:3000
```

### 4. Database Initialization
The database tables will be automatically created on first run. Ensure your MySQL server is running and the database exists.

## 🚀 Running the Application

### Development Mode

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### Production Mode

**Backend:**
```bash
cd backend
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview
```

The backend API will be available at `http://localhost:3000` and the frontend at `http://localhost:5173` (development) or your configured production URL.

## 📚 API Documentation

Once the backend is running, access the Swagger API documentation at:
```
http://localhost:3000/api-docs
```

## 🔐 Authentication

Wiretap supports multiple authentication methods:

1. **Username/Password**: Traditional login with JWT tokens
2. **OpenID Connect**: SSO authentication via OIDC providers
3. **Service Accounts**: Token-based authentication for automation

### Default Admin Account
On first run, you may need to create an admin user. Check the authentication routes for user creation endpoints.

## 🎯 Usage

### Creating a Provider
1. Navigate to Providers section (Admin only)
2. Add OpenStack provider credentials
3. Test the connection
4. Ingest existing instances if needed

### Setting Up a Workshop
1. Create a new workshop
2. Associate it with a provider
3. Configure OpenStack project name
4. Set lockout schedules if needed

### Managing Instances
1. View all instances in the dashboard
2. Filter by workshop, team, or status
3. Use power controls to manage VM state
4. Access console for direct VM interaction
5. Sync instances to update status from OpenStack

### Team Management
1. Create teams and assign users
2. Associate instances with teams
3. Manage pending team assignments
4. Control access based on team membership

## 🔄 Scheduled Tasks

The application runs several automated tasks:

- **Instance Status Sync**: Every 30 seconds - Updates instance status from OpenStack
- **Session Cleanup**: Every hour - Removes expired console sessions
- **Log Cleanup**: Daily at 2 AM - Removes logs older than 7 days
- **Lockout Scheduler**: Monitors and enforces scheduled lockout windows

## 🛠️ Development

### Project Structure
```
wiretap/
├── backend/
│   ├── index.js              # Application entry point
│   ├── routes/               # API route handlers
│   ├── managers/             # Business logic managers
│   ├── middleware/           # Express middleware
│   ├── utils/                # Utility functions
│   └── swaggerConfig/        # API documentation config
├── frontend/
│   ├── src/
│   │   ├── components/       # Vue components
│   │   ├── views/            # Page views
│   │   ├── stores/           # Pinia stores
│   │   └── router/           # Vue Router config
│   └── public/               # Static assets
└── README.md
```

### Code Style
- Backend: Follow Express.js best practices
- Frontend: ESLint + Prettier configured
- Run `npm run lint` and `npm run format` before committing

## 🧪 Testing

API endpoints are documented with Swagger. Use the Swagger UI to test endpoints interactively.

## 📝 License

ISC

## 🤝 Contributing

Contributions are welcome! Please ensure your code follows the project's style guidelines and includes appropriate tests.

## 📧 Support

For issues, questions, or contributions, please open an issue on the repository.

---

**Built with ❤️ for OpenStack VM management**

