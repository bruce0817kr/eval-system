#!/bin/bash
set -e

S3_ENDPOINT="${S3_ENDPOINT:-http://localhost:9000}"
S3_ACCESS_KEY="${S3_ACCESS_KEY}"
S3_SECRET_KEY="${S3_SECRET_KEY}"
S3_BUCKET="${S3_BUCKET:-eval-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5433}"
PGUSER="${PGUSER:-eval}"
PGPASSWORD="${PGPASSWORD}"
PGDATABASE="${PGDATABASE:-eval_db}"
WAL_ARCHIVE_DIR="${WAL_ARCHIVE_DIR:-./wal_archive}"

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

setup_rclone() {
    if ! command -v rclone >/dev/null 2>&1; then
        log_info "Installing rclone..."
        if command -v brew >/dev/null 2>&1; then
            brew install rclone
        elif command -v apt-get >/dev/null 2>&1; then
            curl -sLO https://github.com/rclone/rclone/releases/download/v1.66.0/rclone-v1.66.0-linux-amd64.zip
            unzip -o rclone-v1.66.0-linux-amd64.zip
            sudo cp rclone-v1.66.0-linux-amd64/rclone /usr/local/bin/
            rm -rf rclone-v1.66.0-linux-amd64 rclone-v1.66.0-linux-amd64.zip
        fi
    fi

    if ! command -v rclone >/dev/null 2>&1; then
        log_error "rclone not found"
        exit 1
    fi

    rclone config create minio s3 endpoint ${S3_ENDPOINT} access_key_id ${S3_ACCESS_KEY} secret_access_key ${S3_SECRET_KEY} region us-east-1 2>/dev/null || true
}

ensure_bucket() {
    log_info "Ensuring bucket exists: ${S3_BUCKET}"
    rclone mkdir minio:${S3_BUCKET} 2>/dev/null || true
    rclone mkdir minio:${S3_BUCKET}/wal 2>/dev/null || true
    rclone mkdir minio:${S3_BUCKET}/base 2>/dev/null || true
}

upload_wal() {
    log_info "Checking for WAL files to upload..."

    if [ ! -d "${WAL_ARCHIVE_DIR}" ] || [ -z "$(ls -A "${WAL_ARCHIVE_DIR}" 2>/dev/null)" ]; then
        log_info "No WAL files to upload"
        return
    fi

    for wal_file in "${WAL_ARCHIVE_DIR}"/*; do
        if [ -f "${wal_file}" ]; then
            wal_name=$(basename "${wal_file}")
            log_info "Uploading WAL: ${wal_name}"
            rclone copyto "${wal_file}" minio:${S3_BUCKET}/wal/${wal_name} || log_error "Failed to upload ${wal_name}"
            rm -f "${wal_file}"
        fi
    done

    log_info "WAL upload completed"
}

create_base_backup() {
    BACKUP_NAME="base-$(date +%Y%m%d-%H%M%S)"
    BACKUP_DIR="/tmp/backup-${BACKUP_NAME}"

    log_info "Creating base backup: ${BACKUP_NAME}"

    mkdir -p "${BACKUP_DIR}/pgdata"

    PGPASSWORD="${PGPASSWORD}" pg_basebackup -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -D "${BACKUP_DIR}/pgdata" -Ft -z -P

    if [ $? -eq 0 ]; then
        log_info "Base backup created successfully"

        log_info "Uploading base backup to MinIO..."
        rclone copyto "${BACKUP_DIR}/pgdata" minio:${S3_BUCKET}/base/${BACKUP_NAME}/ --recursive

        date '+%Y-%m-%d %H:%M:%S' > "${BACKUP_DIR}/backup_timestamp.txt"
        echo "${BACKUP_NAME}" > "${BACKUP_DIR}/backup_name.txt"
        rclone copyto "${BACKUP_DIR}/backup_timestamp.txt" minio:${S3_BUCKET}/base/${BACKUP_NAME}/
        rclone copyto "${BACKUP_DIR}/backup_name.txt" minio:${S3_BUCKET}/base/${BACKUP_NAME}/

        rm -rf "${BACKUP_DIR}"

        log_info "Base backup uploaded: ${BACKUP_NAME}"
    else
        log_error "Base backup failed"
        rm -rf "${BACKUP_DIR}"
        exit 1
    fi
}

cleanup_old_backups() {
    log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."

    BACKUPS=$(rclone lsd minio:${S3_BUCKET}/base/ 2>/dev/null | awk '{print $NF}')

    CUTOFF_DATE=$(date -d "${RETENTION_DAYS} days ago" +%s 2>/dev/null || date -v-${RETENTION_DAYS}d +%s)

    for backup_name in ${BACKUPS}; do
        if [ -z "${backup_name}" ] || [ "${backup_name}" = "base" ]; then
            continue
        fi

        timestamp_file=$(rclone cat minio:${S3_BUCKET}/base/${backup_name}/backup_timestamp.txt 2>/dev/null)

        if [ -n "${timestamp_file}" ]; then
            backup_date=$(date -d "${timestamp_file}" +%s 2>/dev/null || echo 0)

            if [ "${backup_date}" -lt "${CUTOFF_DATE}" ]; then
                log_info "Removing old backup: ${backup_name}"
                rclone purge minio:${S3_BUCKET}/base/${backup_name}/ 2>/dev/null || true
            fi
        fi
    done

    log_info "Cleanup completed"
}

main() {
    check_env
    setup_rclone
    ensure_bucket

    case "${1:-wal}" in
        base)
            create_base_backup
            ;;
        wal)
            upload_wal
            ;;
        cleanup)
            cleanup_old_backups
            ;;
        full)
            create_base_backup
            upload_wal
            cleanup_old_backups
            ;;
        *)
            echo "Usage: $0 [base|wal|cleanup|full]"
            echo "  base    - Create base backup"
            echo "  wal     - Upload WAL files (default)"
            echo "  cleanup - Remove old backups"
            echo "  full    - Full backup: base + WAL upload + cleanup"
            exit 1
            ;;
    esac
}

main "$@"
