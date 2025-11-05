# GlowWorm Production Deployment

This directory contains all the necessary files and scripts for deploying GlowWorm to a production server.

## Directory Structure

```
deployment/
├── systemd/           # Systemd service configuration
├── nginx/             # Nginx configuration
├── scripts/           # Deployment and maintenance scripts
├── backup/            # Database backup and restore scripts
├── monitoring/        # Health checks and monitoring
└── templates/         # Configuration templates
```

## Quick Start

### 1. Automated Deployment

Run the automated deployment script:

```bash
sudo ./deployment/scripts/deploy.sh
```

This script will:
- Create the `glowworm` system user
- Install all system dependencies
- Set up the application directory structure
- Deploy the backend and frontend
- Configure the database
- Set up systemd service
- Configure nginx
- Start all services

### 2. Manual Deployment

If you prefer to deploy manually, follow these steps:

#### Prerequisites

- Ubuntu 20.04+ or Debian 11+
- Root or sudo access
- Internet connection

#### Step 1: Install Dependencies

```bash
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv python3-dev nginx mysql-server git
```

#### Step 2: Create Application User

```bash
sudo useradd --system --shell /bin/bash --home-dir /opt/glowworm --create-home glowworm
```

#### Step 3: Deploy Application

```bash
sudo mkdir -p /opt/glowworm
sudo cp -r backend/* /opt/glowworm/backend/
sudo cp -r frontend/dist/* /opt/glowworm/frontend/
sudo chown -R glowworm:glowworm /opt/glowworm
```

#### Step 4: Setup Python Environment

```bash
sudo -u glowworm python3 -m venv /opt/glowworm/backend/venv
sudo -u glowworm /opt/glowworm/backend/venv/bin/pip install -r /opt/glowworm/backend/requirements.txt
```

#### Step 5: Configure Database

```bash
sudo mysql -e "CREATE DATABASE glowworm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'glowworm'@'localhost' IDENTIFIED BY 'glowworm_password';"
sudo mysql -e "GRANT ALL PRIVILEGES ON glowworm.* TO 'glowworm'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"
```

#### Step 6: Setup Systemd Service

```bash
sudo cp deployment/systemd/glowworm-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable glowworm-api
sudo systemctl start glowworm-api
```

#### Step 7: Configure Nginx

```bash
sudo cp deployment/nginx/glowworm.conf /etc/nginx/sites-available/glowworm
sudo ln -s /etc/nginx/sites-available/glowworm /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## Configuration

### Environment Variables

Copy the environment template and customize it:

```bash
sudo cp deployment/templates/env.production /opt/glowworm/backend/.env
sudo chown glowworm:glowworm /opt/glowworm/backend/.env
sudo chmod 600 /opt/glowworm/backend/.env
```

Edit the `.env` file with your specific configuration:

```bash
sudo nano /opt/glowworm/backend/.env
```

### Database Configuration

Update the database credentials in the `.env` file:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=glowworm
DB_USER=glowworm
DB_PASSWORD=your_secure_password
```

### AI Model Configuration

If you want to use AI features, add your API keys to the `.env` file:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key
```

## Service Management

### Start/Stop/Restart Services

```bash
# GlowWorm API service
sudo systemctl start glowworm-api
sudo systemctl stop glowworm-api
sudo systemctl restart glowworm-api
sudo systemctl status glowworm-api

# Nginx
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl restart nginx
sudo systemctl reload nginx
```

### View Logs

```bash
# Application logs
sudo journalctl -u glowworm-api -f

# Nginx logs
sudo tail -f /var/log/nginx/glowworm_access.log
sudo tail -f /var/log/nginx/glowworm_error.log

# Application log files
sudo tail -f /opt/glowworm/backend/logs/glowworm.log
```

## Backup and Restore

### Database Backup

Create a backup:

```bash
sudo -u glowworm ./deployment/backup/backup_database.sh
```

List available backups:

```bash
sudo -u glowworm ./deployment/backup/backup_database.sh list
```

### Database Restore

Restore from a specific backup:

```bash
sudo -u glowworm ./deployment/backup/restore_database.sh glowworm_backup_20240101_120000.sql.gz
```

Or select from available backups:

```bash
sudo -u glowworm ./deployment/backup/restore_database.sh
```

## Monitoring

### Health Checks

Run a comprehensive health check:

```bash
sudo -u glowworm ./deployment/monitoring/health_check.sh
```

Check specific components:

```bash
sudo -u glowworm ./deployment/monitoring/health_check.sh service
sudo -u glowworm ./deployment/monitoring/health_check.sh api
sudo -u glowworm ./deployment/monitoring/health_check.sh database
sudo -u glowworm ./deployment/monitoring/health_check.sh nginx
```

### Automated Monitoring

Set up a cron job for regular health checks:

```bash
sudo crontab -e
```

Add this line to run health checks every 5 minutes:

```cron
*/5 * * * * /opt/glowworm/backend/deployment/monitoring/health_check.sh > /dev/null 2>&1
```

### Log Rotation

Set up log rotation:

```bash
sudo cp deployment/monitoring/logrotate.conf /etc/logrotate.d/glowworm
sudo logrotate -d /etc/logrotate.d/glowworm  # Test configuration
```

## Security

### Firewall Configuration

Configure UFW firewall:

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### SSL/TLS Setup

For production, set up SSL certificates:

1. Install Certbot:

```bash
sudo apt-get install certbot python3-certbot-nginx
```

2. Obtain SSL certificate:

```bash
sudo certbot --nginx -d your-domain.com
```

3. Update nginx configuration to use HTTPS (uncomment HTTPS section in `glowworm.conf`)

### Database Security

Change default database password:

```bash
sudo mysql -e "ALTER USER 'glowworm'@'localhost' IDENTIFIED BY 'your_secure_password';"
```

Update the `.env` file with the new password.

## Troubleshooting

### Common Issues

1. **Service won't start**
   - Check logs: `sudo journalctl -u glowworm-api -f`
   - Verify configuration: `sudo systemctl status glowworm-api`
   - Check file permissions: `sudo chown -R glowworm:glowworm /opt/glowworm`

2. **Database connection errors**
   - Verify database is running: `sudo systemctl status mysql`
   - Check credentials in `.env` file
   - Test connection: `mysql -u glowworm -p glowworm`

3. **Nginx errors**
   - Test configuration: `sudo nginx -t`
   - Check error logs: `sudo tail -f /var/log/nginx/error.log`
   - Verify upstream is running: `curl http://localhost:8001/health`

4. **Permission issues**
   - Fix ownership: `sudo chown -R glowworm:glowworm /opt/glowworm`
   - Fix upload directory: `sudo chmod 755 /opt/glowworm/backend/uploads`

### Performance Tuning

1. **Database Optimization**
   - Run the performance optimization scripts
   - Monitor slow queries: `sudo mysql -e "SHOW PROCESSLIST;"`
   - Check database indexes

2. **Nginx Optimization**
   - Adjust worker processes in `/etc/nginx/nginx.conf`
   - Enable gzip compression (already configured)
   - Tune buffer sizes

3. **Application Optimization**
   - Monitor memory usage: `sudo -u glowworm ./deployment/monitoring/health_check.sh`
   - Check log files for errors
   - Monitor disk space

## Updates

### Application Updates

1. Stop the service:
```bash
sudo systemctl stop glowworm-api
```

2. Backup the database:
```bash
sudo -u glowworm ./deployment/backup/backup_database.sh
```

3. Update the application:
```bash
sudo cp -r backend/* /opt/glowworm/backend/
sudo chown -R glowworm:glowworm /opt/glowworm/backend
```

4. Update dependencies:
```bash
sudo -u glowworm /opt/glowworm/backend/venv/bin/pip install -r /opt/glowworm/backend/requirements.txt
```

5. Start the service:
```bash
sudo systemctl start glowworm-api
```

### System Updates

```bash
sudo apt-get update
sudo apt-get upgrade
sudo systemctl restart glowworm-api nginx
```

## Support

For issues and questions:

1. Check the logs first
2. Run health checks
3. Review this documentation
4. Check the main project README
5. Create an issue in the project repository

## File Locations

- Application: `/opt/glowworm/`
- Logs: `/opt/glowworm/backend/logs/`
- Backups: `/opt/glowworm/backups/`
- Configuration: `/opt/glowworm/backend/.env`
- Service: `/etc/systemd/system/glowworm-api.service`
- Nginx: `/etc/nginx/sites-available/glowworm`















