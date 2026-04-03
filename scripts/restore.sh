#!/bin/sh
# DB Restore Script - PostgreSQL WAL-based Point-in-time Recovery
# Usage: ./restore.sh [backup_name] [target_time]

set -e

S3_ENDPOINT="${S3_ENDPOINT:-http://minio:9000}"
S3_ACCESS_KEY="${S3_ACCESS_KEY}"
S3_SECRET_KEY="${S3_SECRET_KEY}"
S3_BUCKET="${S3_BUCKET:-eval-backups}"
PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-eval}"
RESTORE_DIR="/tmp/restore-$(date +%Y%m%d-%H%M%S)"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log_info() {
    echo "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo "${RED}[ERROR]${NC} $1"
}

check_env() {
    if [ -z "$S3_ACCESS_KEY" ] || [ -z "$S3_SECRET_KEY" ]; then
        log_error "S3_ACCESS_KEY and S3_SECRET_KEY must be set"
        exit 1
    fi
}

setup_mc() {
    if [ -f /mc ]; then
        MC_BIN=/mc
    elif command -v mc >/dev/null 2>&1; then
        MC_BIN=mc
    else
        log_error "mc not found"
        exit 1
    fi

    ${MC_BIN} alias set minio "${S3_ENDPOINT}" "${S3_ACCESS_KEY}" "${S3_SECRET_KEY}" 2>/dev/null || true
}

list_backups() {
    log_info "Available backups:"
    mc ls minio/${S3_BUCKET}/base/
}

restore_backup() {
    BACKUP_NAME="${1}"
    
    if [ -z "${BACKUP_NAME}" ]; then
        log_error "Backup name is required"
        echo "Usage: $0 <backup_name> [target_time]"
        echo ""
        list_backups
        exit 1
    fi
    
    log_info "Restoring backup: ${BACKUP_NAME}"
    
    mkdir -p "${RESTORE_DIR}"
    
    log_info "Downloading backup from MinIO..."
    mc cp --recursive minio/${S3_BUCKET}/base/${BACKUP_NAME}/ "${RESTORE_DIR}/"
    
    if [ ! -d "${RESTORE_DIR}/pgdata" ]; then
        log_error "Invalid backup format"
        rm -rf "${RESTORE_DIR}"
        exit 1
    fi
    
    log_info "Backup downloaded to: ${RESTORE_DIR}"
    log_info ""
    log_info "To complete restore:"
    log_info "1. Stop the postgres container"
    log_info "2. Run: docker exec eval-postgres-1 rm -rf /var/lib/postgresql/data/*"
    log_info "3. Run: docker exec eval-postgres-1 tar -xzf ${RESTORE_DIR}/pgdata/base.tar.gz -C /var/lib/postgresql/data/"
    log_info "4. Create recovery signal: docker exec eval-postgres-1 touch /var/lib/postgresql/data/recovery.signal"
    log_info "5. Start postgres container"
    log_info ""
    log_info "Restore files location: ${RESTORE_DIR}"
}

main() {
    check_env
    setup_mc
    
    case "${1:-list}" in
        list)
            list_backups
            ;;
        restore)
            restore_backup "${2}"
            ;;
        *)
            echo "Usage: $0 [list|restore <backup_name>] [target_time]"
            exit 1
            ;;
    esac
}

main "$@"
