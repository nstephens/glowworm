#!/bin/bash
# GlowWorm Database Backup Script
# This script creates automated backups of the GlowWorm database

set -euo pipefail

# Configuration
DB_NAME="glowworm"
DB_USER="glowworm"
DB_PASSWORD="glowworm_password"
BACKUP_DIR="/opt/glowworm/backups"
RETENTION_DAYS=30
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/glowworm_backup_$TIMESTAMP.sql"
BACKUP_FILE_COMPRESSED="$BACKUP_FILE.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory
create_backup_directory() {
    log_info "Creating backup directory: $BACKUP_DIR"
    
    sudo mkdir -p "$BACKUP_DIR"
    sudo chown glowworm:glowworm "$BACKUP_DIR"
    sudo chmod 755 "$BACKUP_DIR"
    
    log_success "Backup directory created"
}

# Create database backup
create_backup() {
    log_info "Creating database backup: $BACKUP_FILE"
    
    # Create the backup
    mysqldump \
        --single-transaction \
        --routines \
        --triggers \
        --events \
        --hex-blob \
        --complete-insert \
        --extended-insert \
        --lock-tables=false \
        --user="$DB_USER" \
        --password="$DB_PASSWORD" \
        "$DB_NAME" > "$BACKUP_FILE"
    
    # Compress the backup
    gzip "$BACKUP_FILE"
    
    # Set proper permissions
    sudo chown glowworm:glowworm "$BACKUP_FILE_COMPRESSED"
    sudo chmod 644 "$BACKUP_FILE_COMPRESSED"
    
    log_success "Database backup created: $BACKUP_FILE_COMPRESSED"
}

# Clean old backups
clean_old_backups() {
    log_info "Cleaning backups older than $RETENTION_DAYS days"
    
    find "$BACKUP_DIR" -name "glowworm_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
    
    log_success "Old backups cleaned"
}

# Verify backup
verify_backup() {
    log_info "Verifying backup integrity"
    
    if [[ -f "$BACKUP_FILE_COMPRESSED" ]]; then
        # Test decompression
        if gunzip -t "$BACKUP_FILE_COMPRESSED" 2>/dev/null; then
            log_success "Backup verification successful"
        else
            log_error "Backup verification failed - file is corrupted"
            exit 1
        fi
    else
        log_error "Backup file not found: $BACKUP_FILE_COMPRESSED"
        exit 1
    fi
}

# Create backup metadata
create_metadata() {
    log_info "Creating backup metadata"
    
    cat > "$BACKUP_DIR/glowworm_backup_$TIMESTAMP.meta" << EOF
{
    "timestamp": "$TIMESTAMP",
    "date": "$(date -Iseconds)",
    "database": "$DB_NAME",
    "backup_file": "$(basename "$BACKUP_FILE_COMPRESSED")",
    "backup_size": "$(stat -c%s "$BACKUP_FILE_COMPRESSED")",
    "mysql_version": "$(mysql --version | cut -d' ' -f3)",
    "hostname": "$(hostname)"
}
EOF
    
    sudo chown glowworm:glowworm "$BACKUP_DIR/glowworm_backup_$TIMESTAMP.meta"
    sudo chmod 644 "$BACKUP_DIR/glowworm_backup_$TIMESTAMP.meta"
    
    log_success "Backup metadata created"
}

# List available backups
list_backups() {
    log_info "Available backups:"
    
    if [[ -d "$BACKUP_DIR" ]]; then
        ls -la "$BACKUP_DIR"/glowworm_backup_*.sql.gz 2>/dev/null || log_warning "No backups found"
    else
        log_warning "Backup directory does not exist"
    fi
}

# Main backup function
main() {
    log_info "Starting GlowWorm database backup"
    
    create_backup_directory
    create_backup
    verify_backup
    create_metadata
    clean_old_backups
    
    log_success "Database backup completed successfully!"
    log_info "Backup file: $BACKUP_FILE_COMPRESSED"
    log_info "Backup size: $(du -h "$BACKUP_FILE_COMPRESSED" | cut -f1)"
    
    echo
    list_backups
}

# Handle command line arguments
case "${1:-backup}" in
    "backup")
        main
        ;;
    "list")
        list_backups
        ;;
    "clean")
        clean_old_backups
        ;;
    *)
        echo "Usage: $0 [backup|list|clean]"
        echo "  backup - Create a new backup (default)"
        echo "  list   - List available backups"
        echo "  clean  - Clean old backups"
        exit 1
        ;;
esac

















