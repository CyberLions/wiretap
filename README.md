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

### Serial Console (xterm.js)

The console pane offers two renderers, picked from the toolbar and remembered
per instance:

- **noVNC** - the graphical framebuffer, in an iframe. Pasting types the text
  in as simulated keystrokes, 40 characters at a time.
- **xterm.js** - Nova's serial console, a raw byte stream rendered directly, so
  a paste arrives as a single write.

**Terminal size.** A serial line carries no window size. SSH and local
terminals have a side channel for it; a UART does not, so the guest keeps
whatever its getty started with (usually 80x24) however large the browser
window is - vim draws into the top-left corner and long commands wrap at the
wrong column. Nothing on this side can fix that: the size lives in the guest's
termios, so the guest has to set it.

It can work this out for itself. Park the cursor far off-screen and ask where
it actually landed with a Cursor Position Report; xterm.js answers, and the
reply is the real size. Run at login this needs no interaction, and unlike
typing `stty` at the prompt it cannot land in an editor. Bake it into your
images as `/etc/profile.d/serial-resize.sh`:

```sh
case "$(tty 2>/dev/null)" in
  /dev/ttyS*|/dev/ttyAMA*|/dev/hvc*)
    if [ -t 0 ] && [ -n "$BASH_VERSION" ]; then
      __old=$(stty -g)
      stty raw -echo min 0 time 2
      printf '\033[999;999H\033[6n' > /dev/tty
      IFS='[;R' read -r -d R -t 2 _ __rows __cols < /dev/tty
      stty "$__old"
      [ -n "$__rows" ] && [ -n "$__cols" ] && stty rows "$__rows" cols "$__cols"
      unset __old __rows __cols
    fi

    # The serial getty hands out TERM=vt220, which costs vim color and its
    # better redraw path.
    case "$TERM" in
      vt220|vt100|dumb|'') TERM=xterm-256color; export TERM ;;
    esac
    ;;
esac
```

The workshops repo installs this through its `serial_console` Ansible role. On
an image without it, log in and run `stty rows R cols C` by hand at a shell
prompt - never with an editor open, where those bytes are editor commands. If a
session is already wrong, `reset` clears the damage.

**Requirements.** The serial console needs `[serial_console] enabled = true` in
the cloud's `nova.conf`, and instances must have been created after it was
turned on - an older VM has no serial device attached. Wiretap answers 502 for
that case and the UI suggests noVNC. Nova serves one serial session per
instance at a time; a second viewer gets a connection error.

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


