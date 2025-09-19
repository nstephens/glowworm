#!/bin/bash
# GlowWorm Database Restore Script
# This script restores the GlowWorm database from a backup

set -euo pipefail

# Configuration
DB_NAME="glowworm"
DB_USER="glowworm"
DB_PASSWORD="glowworm_password"
BACKUP_DIR="/opt/glowworm/backups"

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

# List available backups
list_backups() {
    log_info "Available backups:"
    
    if [[ -d "$BACKUP_DIR" ]]; then
        local backups=($(ls -1t "$BACKUP_DIR"/glowworm_backup_*.sql.gz 2>/dev/null))
        
        if [[ ${#backups[@]} -eq 0 ]]; then
            log_warning "No backups found in $BACKUP_DIR"
            return 1
        fi
        
        for i in "${!backups[@]}"; do
            local backup_file="${backups[$i]}"
            local backup_name=$(basename "$backup_file")
            local backup_date=$(stat -c %y "$backup_file" | cut -d' ' -f1,2 | cut -d'.' -f1)
            local backup_size=$(du -h "$backup_file" | cut -f1)
            
            echo "  $((i+1)). $backup_name ($backup_date, $backup_size)"
        done
        
        return 0
    else
        log_error "Backup directory does not exist: $BACKUP_DIR"
        return 1
    fi
}

# Select backup file
select_backup() {
    local backup_file="$1"
    
    if [[ -z "$backup_file" ]]; then
        log_info "No backup file specified. Listing available backups..."
        
        if ! list_backups; then
            exit 1
        fi
        
        echo
        read -p "Enter backup number to restore (or 'q' to quit): " selection
        
        if [[ "$selection" == "q" || "$selection" == "Q" ]]; then
            log_info "Restore cancelled"
            exit 0
        fi
        
        local backups=($(ls -1t "$BACKUP_DIR"/glowworm_backup_*.sql.gz 2>/dev/null))
        local index=$((selection - 1))
        
        if [[ $index -ge 0 && $index -lt ${#backups[@]} ]]; then
            backup_file="${backups[$index]}"
        else
            log_error "Invalid selection"
            exit 1
        fi
    fi
    
    # Resolve full path
    if [[ ! "$backup_file" =~ ^/ ]]; then
        backup_file="$BACKUP_DIR/$backup_file"
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    echo "$backup_file"
}

# Create pre-restore backup
create_pre_restore_backup() {
    log_info "Creating pre-restore backup of current database"
    
    local pre_restore_backup="$BACKUP_DIR/pre_restore_$(date +"%Y%m%d_%H%M%S").sql.gz"
    
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
        "$DB_NAME" | gzip > "$pre_restore_backup"
    
    sudo chown glowworm:glowworm "$pre_restore_backup"
    sudo chmod 644 "$pre_restore_backup"
    
    log_success "Pre-restore backup created: $pre_restore_backup"
    echo "$pre_restore_backup"
}

# Restore database
restore_database() {
    local backup_file="$1"
    local pre_restore_backup="$2"
    
    log_info "Restoring database from: $backup_file"
    
    # Confirm restore
    echo
    log_warning "This will replace the current database with the backup!"
    log_warning "A pre-restore backup has been created: $pre_restore_backup"
    echo
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [[ "$confirm" != "yes" ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    # Stop the application service
    log_info "Stopping GlowWorm service"
    sudo systemctl stop glowworm-api
    
    # Drop and recreate database
    log_info "Dropping and recreating database"
    mysql -u root -p -e "DROP DATABASE IF EXISTS $DB_NAME;"
    mysql -u root -p -e "CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    mysql -u root -p -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
    mysql -u root -p -e "FLUSH PRIVILEGES;"
    
    # Restore from backup
    log_info "Restoring database from backup"
    
    if [[ "$backup_file" == *.gz ]]; then
        gunzip -c "$backup_file" | mysql --user="$DB_USER" --password="$DB_PASSWORD" "$DB_NAME"
    else
        mysql --user="$DB_USER" --password="$DB_PASSWORD" "$DB_NAME" < "$backup_file"
    fi
    
    # Start the application service
    log_info "Starting GlowWorm service"
    sudo systemctl start glowworm-api
    
    # Wait for service to start
    sleep 5
    
    if sudo systemctl is-active --quiet glowworm-api; then
        log_success "Service started successfully"
    else
        log_error "Failed to start service"
        sudo systemctl status glowworm-api
        exit 1
    fi
    
    log_success "Database restore completed successfully!"
}

# Verify restore
verify_restore() {
    log_info "Verifying database restore"
    
    # Check if database exists and has tables
    local table_count=$(mysql --user="$DB_USER" --password="$DB_PASSWORD" -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';" -s -N)
    
    if [[ "$table_count" -gt 0 ]]; then
        log_success "Database restore verified - $table_count tables found"
    else
        log_error "Database restore verification failed - no tables found"
        exit 1
    fi
}

# Main restore function
main() {
    local backup_file="$1"
    
    log_info "Starting GlowWorm database restore"
    
    # Select backup file
    backup_file=$(select_backup "$backup_file")
    
    # Create pre-restore backup
    local pre_restore_backup=$(create_pre_restore_backup)
    
    # Restore database
    restore_database "$backup_file" "$pre_restore_backup"
    
    # Verify restore
    verify_restore
    
    log_success "Database restore completed successfully!"
    log_info "Restored from: $backup_file"
    log_info "Pre-restore backup: $pre_restore_backup"
}

# Handle command line arguments
case "${1:-}" in
    "list")
        list_backups
        ;;
    "")
        main ""
        ;;
    *)
        if [[ -f "$1" || -f "$BACKUP_DIR/$1" ]]; then
            main "$1"
        else
            log_error "Backup file not found: $1"
            echo "Usage: $0 [backup_file]"
            echo "       $0 list"
            exit 1
        fi
        ;;
esac





