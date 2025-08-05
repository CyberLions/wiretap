const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

async function initializeTables(connection) {
    try {
        // Create providers table (OpenStack configurations)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS providers (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                auth_url VARCHAR(500) NOT NULL,
                identity_version VARCHAR(10) DEFAULT 'v3',
                username VARCHAR(255) NOT NULL,
                password VARCHAR(500) NOT NULL,
                project_name VARCHAR(255) NOT NULL,
                region_name VARCHAR(100) NOT NULL,
                domain_name VARCHAR(255),
                domain_id VARCHAR(255),
                enabled BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_provider_name (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        // Create workshops table (OpenStack projects)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS workshops (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                provider_id VARCHAR(36) NOT NULL,
                openstack_project_id VARCHAR(255) NOT NULL,
                openstack_project_name VARCHAR(255) NOT NULL,
                enabled BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_workshop_name (name),
                FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        // Create teams table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS teams (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                workshop_id VARCHAR(36) NOT NULL,
                team_number INT NOT NULL,
                enabled BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_team_workshop (workshop_id, team_number),
                FOREIGN KEY (workshop_id) REFERENCES workshops(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        // Create users table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(36) PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                first_name VARCHAR(255),
                last_name VARCHAR(255),
                role ENUM('ADMIN', 'USER') DEFAULT 'USER',
                auth_type ENUM('OPENID', 'PASSWORD') DEFAULT 'OPENID',
                password_hash VARCHAR(255),
                openid_sub VARCHAR(255),
                openid_groups TEXT,
                enabled BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_username (username),
                UNIQUE KEY unique_email (email),
                UNIQUE KEY unique_openid_sub (openid_sub)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        // Create user_teams table (many-to-many relationship)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_teams (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                team_id VARCHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_team (user_id, team_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        // Create instances table (VMs)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS instances (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                openstack_id VARCHAR(255) NOT NULL,
                workshop_id VARCHAR(36) NOT NULL,
                team_id VARCHAR(36),
                user_id VARCHAR(36),
                status VARCHAR(50) DEFAULT 'UNKNOWN',
                power_state VARCHAR(50) DEFAULT 'UNKNOWN',
                ip_addresses TEXT,
                flavor VARCHAR(255),
                image VARCHAR(255),
                locked BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_openstack_id (openstack_id),
                FOREIGN KEY (workshop_id) REFERENCES workshops(id) ON DELETE CASCADE,
                FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        // Create sessions table for VNC connections
        await connection.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                instance_id VARCHAR(36) NOT NULL,
                session_token TEXT NOT NULL,
                console_type ENUM('NOVNC', 'VNC', 'SERIAL', 'SPICE', 'RDP', 'MKS') DEFAULT 'NOVNC',
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        // Create audit_log table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS audit_log (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36),
                action VARCHAR(255) NOT NULL,
                resource_type VARCHAR(100) NOT NULL,
                resource_id VARCHAR(36),
                details TEXT,
                ip_address VARCHAR(45),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        // Create logs table for system activity
        await connection.query(`
            CREATE TABLE IF NOT EXISTS logs (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36),
                type VARCHAR(50) NOT NULL,
                action VARCHAR(255) NOT NULL,
                details TEXT,
                ip_address VARCHAR(45),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        // Create service_accounts table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS service_accounts (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                api_key VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_used TIMESTAMP NULL,
                enabled BOOLEAN DEFAULT true,
                UNIQUE KEY unique_api_key (api_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        console.log('✓ Database tables created successfully');

        // Create default admin user
        await createDefaultAdminUser(connection);
        
        // Create default provider
        await createDefaultProvider(connection);

        // Create sample log data
        await createSampleLogData(connection);

    } catch (error) {
        console.error('Error creating tables:', error);
        throw error;
    }
}

async function createDefaultAdminUser(connection) {
    try {
        const adminExists = await connection.query(
            'SELECT 1 FROM users WHERE username = ?',
            ['admin']
        );

        if (adminExists[0].length === 0) {
            const adminId = uuidv4();
            const passwordHash = await bcrypt.hash('admin123', 10);
            
            await connection.query(`
                INSERT INTO users (id, username, email, first_name, last_name, role, auth_type, password_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [adminId, 'admin', 'admin@wiretap.local', 'Admin', 'User', 'ADMIN', 'PASSWORD', passwordHash]);
            
            console.log('✓ Default admin user created (username: admin, password: admin123)');
        }
    } catch (error) {
        console.error('Error creating default admin user:', error);
    }
}

async function createDefaultProvider(connection) {
    try {
        const providerExists = await connection.query(
            'SELECT 1 FROM providers WHERE name = ?',
            ['Default OpenStack']
        );

        if (providerExists[0].length === 0) {
            const providerId = uuidv4();
            
            await connection.query(`
                INSERT INTO providers (id, name, description, auth_url, identity_version, username, password, project_name, region_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                providerId, 
                'Default OpenStack', 
                'Default OpenStack provider configuration', 
                'http://localhost:5000', 
                'v3',
                'admin', 
                'password', 
                'admin', 
                'RegionOne'
            ]);
            
            console.log('✓ Default OpenStack provider created');
        }
    } catch (error) {
        console.error('Error creating default provider:', error);
    }
}

async function createSampleLogData(connection) {
    try {
        // Check if logs table is empty
        const [rows] = await connection.query('SELECT COUNT(*) as count FROM logs');
        if (rows[0].count > 0) {
            return; // Already has data
        }

        // Get admin user
        const [adminUsers] = await connection.query('SELECT id FROM users WHERE role = "ADMIN" LIMIT 1');
        if (adminUsers.length === 0) {
            return; // No admin user found
        }

        const adminUserId = adminUsers[0].id;
        
        // Create timestamps in MySQL format (YYYY-MM-DD HH:MM:SS)
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
        const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
        const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);
        const twentyFiveMinutesAgo = new Date(now.getTime() - 25 * 60 * 1000);

        const sampleLogs = [
            {
                id: uuidv4(),
                user_id: adminUserId,
                type: 'login',
                action: 'User logged in',
                details: 'Successful login from Chrome browser',
                ip_address: '192.168.1.100',
                timestamp: fiveMinutesAgo.toISOString().slice(0, 19).replace('T', ' ')
            },
            {
                id: uuidv4(),
                user_id: adminUserId,
                type: 'vm_action',
                action: 'Power on VM',
                details: 'Powered on VM: team01-web',
                ip_address: '192.168.1.100',
                timestamp: tenMinutesAgo.toISOString().slice(0, 19).replace('T', ' ')
            },
            {
                id: uuidv4(),
                user_id: adminUserId,
                type: 'admin_action',
                action: 'Create user',
                details: 'Created new user: alice@example.com',
                ip_address: '192.168.1.100',
                timestamp: fifteenMinutesAgo.toISOString().slice(0, 19).replace('T', ' ')
            },
            {
                id: uuidv4(),
                user_id: adminUserId,
                type: 'vm_action',
                action: 'Console access',
                details: 'Accessed console for VM: team02-db',
                ip_address: '192.168.1.100',
                timestamp: twentyMinutesAgo.toISOString().slice(0, 19).replace('T', ' ')
            },
            {
                id: uuidv4(),
                user_id: null,
                type: 'error',
                action: 'VM startup failed',
                details: 'VM team03-app failed to start: insufficient resources',
                ip_address: '192.168.1.1',
                timestamp: twentyFiveMinutesAgo.toISOString().slice(0, 19).replace('T', ' ')
            }
        ];

        for (const log of sampleLogs) {
            await connection.query(
                'INSERT INTO logs (id, user_id, type, action, details, ip_address, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [log.id, log.user_id, log.type, log.action, log.details, log.ip_address, log.timestamp]
            );
        }

        console.log('✓ Sample log data created successfully');
    } catch (error) {
        console.error('Error creating sample log data:', error);
    }
}

module.exports = { initializeTables }; 