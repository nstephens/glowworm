#!/bin/bash
# GlowWorm Health Check Script
# This script performs comprehensive health checks on the GlowWorm application

set -euo pipefail

# Configuration
API_URL="http://localhost/api"
HEALTH_URL="http://localhost/health"
SERVICE_NAME="glowworm-api"
DB_NAME="glowworm"
DB_USER="glowworm"
DB_PASSWORD="glowworm_password"

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

# Check systemd service status
check_service_status() {
    log_info "Checking systemd service status"
    
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        log_success "Service $SERVICE_NAME is running"
        return 0
    else
        log_error "Service $SERVICE_NAME is not running"
        return 1
    fi
}

# Check API health endpoint
check_api_health() {
    log_info "Checking API health endpoint"
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/health_response.json "$HEALTH_URL" || echo "000")
    
    if [[ "$response" == "200" ]]; then
        log_success "API health endpoint responding"
        
        # Parse health response
        if command -v jq >/dev/null 2>&1; then
            local status=$(jq -r '.status' /tmp/health_response.json 2>/dev/null || echo "unknown")
            local service=$(jq -r '.service' /tmp/health_response.json 2>/dev/null || echo "unknown")
            local version=$(jq -r '.version' /tmp/health_response.json 2>/dev/null || echo "unknown")
            
            log_info "  Status: $status"
            log_info "  Service: $service"
            log_info "  Version: $version"
        fi
        
        rm -f /tmp/health_response.json
        return 0
    else
        log_error "API health endpoint not responding (HTTP $response)"
        return 1
    fi
}

# Check database connectivity
check_database() {
    log_info "Checking database connectivity"
    
    if mysql --user="$DB_USER" --password="$DB_PASSWORD" -e "SELECT 1;" "$DB_NAME" >/dev/null 2>&1; then
        log_success "Database connection successful"
        
        # Check table count
        local table_count=$(mysql --user="$DB_USER" --password="$DB_PASSWORD" -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';" -s -N 2>/dev/null || echo "0")
        log_info "  Tables found: $table_count"
        
        return 0
    else
        log_error "Database connection failed"
        return 1
    fi
}

# Check disk space
check_disk_space() {
    log_info "Checking disk space"
    
    local app_dir="/opt/glowworm"
    local usage=$(df "$app_dir" | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [[ $usage -lt 80 ]]; then
        log_success "Disk space OK ($usage% used)"
        return 0
    elif [[ $usage -lt 90 ]]; then
        log_warning "Disk space getting low ($usage% used)"
        return 0
    else
        log_error "Disk space critical ($usage% used)"
        return 1
    fi
}

# Check memory usage
check_memory() {
    log_info "Checking memory usage"
    
    local memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    
    if [[ $memory_usage -lt 80 ]]; then
        log_success "Memory usage OK ($memory_usage% used)"
        return 0
    elif [[ $memory_usage -lt 90 ]]; then
        log_warning "Memory usage getting high ($memory_usage% used)"
        return 0
    else
        log_error "Memory usage critical ($memory_usage% used)"
        return 1
    fi
}

# Check nginx status
check_nginx() {
    log_info "Checking nginx status"
    
    if systemctl is-active --quiet nginx; then
        log_success "Nginx is running"
        
        # Test nginx configuration
        if nginx -t >/dev/null 2>&1; then
            log_success "Nginx configuration is valid"
            return 0
        else
            log_error "Nginx configuration is invalid"
            return 1
        fi
    else
        log_error "Nginx is not running"
        return 1
    fi
}

# Check log files
check_logs() {
    log_info "Checking log files"
    
    local log_dir="/opt/glowworm/backend/logs"
    local error_count=0
    
    if [[ -d "$log_dir" ]]; then
        # Check for recent errors in application logs
        if find "$log_dir" -name "*.log" -mtime -1 -exec grep -l "ERROR\|CRITICAL\|FATAL" {} \; 2>/dev/null | grep -q .; then
            log_warning "Recent errors found in application logs"
            error_count=$((error_count + 1))
        else
            log_success "No recent errors in application logs"
        fi
        
        # Check nginx error logs
        if [[ -f "/var/log/nginx/glowworm_error.log" ]]; then
            local nginx_errors=$(grep -c "$(date +%Y/%m/%d)" /var/log/nginx/glowworm_error.log 2>/dev/null || echo "0")
            if [[ $nginx_errors -gt 0 ]]; then
                log_warning "Nginx errors found today: $nginx_errors"
                error_count=$((error_count + 1))
            else
                log_success "No nginx errors today"
            fi
        fi
    else
        log_warning "Log directory not found: $log_dir"
    fi
    
    return $error_count
}

# Check backup status
check_backups() {
    log_info "Checking backup status"
    
    local backup_dir="/opt/glowworm/backups"
    
    if [[ -d "$backup_dir" ]]; then
        local latest_backup=$(find "$backup_dir" -name "glowworm_backup_*.sql.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
        
        if [[ -n "$latest_backup" ]]; then
            local backup_age=$(($(date +%s) - $(stat -c %Y "$latest_backup")))
            local backup_age_hours=$((backup_age / 3600))
            
            if [[ $backup_age_hours -lt 25 ]]; then
                log_success "Recent backup found (${backup_age_hours}h old): $(basename "$latest_backup")"
                return 0
            else
                log_warning "Backup is old (${backup_age_hours}h old): $(basename "$latest_backup")"
                return 1
            fi
        else
            log_error "No backups found"
            return 1
        fi
    else
        log_error "Backup directory not found: $backup_dir"
        return 1
    fi
}

# Generate health report
generate_report() {
    local overall_status="HEALTHY"
    local issues=()
    
    log_info "Generating health report"
    
    # Run all checks
    check_service_status || { overall_status="UNHEALTHY"; issues+=("Service not running"); }
    check_api_health || { overall_status="UNHEALTHY"; issues+=("API not responding"); }
    check_database || { overall_status="UNHEALTHY"; issues+=("Database connection failed"); }
    check_nginx || { overall_status="UNHEALTHY"; issues+=("Nginx issues"); }
    check_disk_space || { overall_status="WARNING"; issues+=("Disk space critical"); }
    check_memory || { overall_status="WARNING"; issues+=("Memory usage critical"); }
    check_logs || { overall_status="WARNING"; issues+=("Log errors found"); }
    check_backups || { overall_status="WARNING"; issues+=("Backup issues"); }
    
    # Print summary
    echo
    log_info "=== HEALTH CHECK SUMMARY ==="
    
    case "$overall_status" in
        "HEALTHY")
            log_success "Overall Status: $overall_status"
            ;;
        "WARNING")
            log_warning "Overall Status: $overall_status"
            ;;
        "UNHEALTHY")
            log_error "Overall Status: $overall_status"
            ;;
    esac
    
    if [[ ${#issues[@]} -gt 0 ]]; then
        echo
        log_info "Issues found:"
        for issue in "${issues[@]}"; do
            log_warning "  - $issue"
        done
    fi
    
    echo
    log_info "Check completed at: $(date)"
    
    # Return appropriate exit code
    case "$overall_status" in
        "HEALTHY") return 0 ;;
        "WARNING") return 1 ;;
        "UNHEALTHY") return 2 ;;
    esac
}

# Main function
main() {
    case "${1:-report}" in
        "report")
            generate_report
            ;;
        "service")
            check_service_status
            ;;
        "api")
            check_api_health
            ;;
        "database")
            check_database
            ;;
        "nginx")
            check_nginx
            ;;
        "logs")
            check_logs
            ;;
        "backups")
            check_backups
            ;;
        *)
            echo "Usage: $0 [report|service|api|database|nginx|logs|backups]"
            echo "  report   - Generate full health report (default)"
            echo "  service  - Check systemd service status"
            echo "  api      - Check API health endpoint"
            echo "  database - Check database connectivity"
            echo "  nginx    - Check nginx status"
            echo "  logs     - Check log files"
            echo "  backups  - Check backup status"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"

















