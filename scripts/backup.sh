#!/bin/sh
set -e

S3_ENDPOINT="${S3_ENDPOINT:-http://minio:9000}"
S3_ACCESS_KEY="${S3_ACCESS_KEY}"
S3_SECRET_KEY="${S3_SECRET_KEY}"
S3_BUCKET="${S3_BUCKET:-eval-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-eval}"
PGPASSWORD="${PGPASSWORD}"
PGDATABASE="${PGDATABASE:-eval_db}"

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

ensure_bucket() {
    if ! ${MC_BIN} ls minio/${S3_BUCKET} >/dev/null 2>&1; then
        log_info "Creating bucket: ${S3_BUCKET}"
        ${MC_BIN} mb minio/${S3_BUCKET}
        ${MC_BIN} anonymous set download minio/${S3_BUCKET}
    fi

    if ! ${MC_BIN} ls minio/${S3_BUCKET}/wal >/dev/null 2>&1; then
        ${MC_BIN} mb minio/${S3_BUCKET}/wal
    fi

    if ! ${MC_BIN} ls minio/${S3_BUCKET}/base >/dev/null 2>&1; then
        ${MC_BIN} mb minio/${S3_BUCKET}/base
    fi
}

upload_wal() {
    log_info "Checking for WAL files to upload..."

    if [ ! -d /wal_archive ] || [ -z "$(ls -A /wal_archive 2>/dev/null)" ]; then
        log_info "No WAL files to upload"
        return
    fi

    for wal_file in /wal_archive/*; do
        if [ -f "${wal_file}" ]; then
            wal_name=$(basename "${wal_file}")
            log_info "Uploading WAL: ${wal_name}"
            ${MC_BIN} cp "${wal_file}" minio/${S3_BUCKET}/wal/ || log_error "Failed to upload ${wal_name}"
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

    export PGPASSWORD="${PGPASSWORD}"

    if pg_basebackup -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -D "${BACKUP_DIR}/pgdata" -Ft -z -P; then
        log_info "Base backup created successfully"

        log_info "Uploading base backup to MinIO..."
        ${MC_BIN} cp --recursive "${BACKUP_DIR}/pgdata" minio/${S3_BUCKET}/base/${BACKUP_NAME}/

        date '+%Y-%m-%d %H:%M:%S' > "${BACKUP_DIR}/backup_timestamp.txt"
        echo "${BACKUP_NAME}" > "${BACKUP_DIR}/backup_name.txt"
        ${MC_BIN} cp "${BACKUP_DIR}/backup_timestamp.txt" minio/${S3_BUCKET}/base/${BACKUP_NAME}/
        ${MC_BIN} cp "${BACKUP_DIR}/backup_name.txt" minio/${S3_BUCKET}/base/${BACKUP_NAME}/

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

    BACKUPS=$(${MC_BIN} ls minio/${S3_BUCKET}/base/ 2>/dev/null | awk '{print $NF}')

    CUTOFF_DATE=$(date -d "${RETENTION_DAYS} days ago" +%s 2>/dev/null || date -v-${RETENTION_DAYS}d +%s)

    for backup_path in ${BACKUPS}; do
        backup_name=$(basename "${backup_path}")

        if [ -z "${backup_name}" ] || [ "${backup_name}" = "base" ]; then
            continue
        fi

        timestamp_file=$(${MC_BIN} cat minio/${S3_BUCKET}/base/${backup_name}/backup_timestamp.txt 2>/dev/null)

        if [ -n "${timestamp_file}" ]; then
            backup_date=$(date -d "${timestamp_file}" +%s 2>/dev/null || echo 0)

            if [ "${backup_date}" -lt "${CUTOFF_DATE}" ]; then
                log_info "Removing old backup: ${backup_name}"
                ${MC_BIN} rm --recursive minio/${S3_BUCKET}/base/${backup_name}/
            fi
        fi
    done

    log_info "Cleanup completed"
}

switch_wal() {
    log_info "Switching WAL file..."

    export PGPASSWORD="${PGPASSWORD}"

    psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -c "SELECT pg_switch_wal();" 2>/dev/null || \
    psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -c "SELECT pg_switch_xlog();" 2>/dev/null || \
    log_error "Failed to switch WAL"
}

main() {
    check_env
    setup_mc
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
