#!/bin/bash
# Atomic Context File Update with File Locking
# Prevents race conditions when multiple agents update context files simultaneously
#
# Usage: ./update-context.sh <file_path> < new_content
# Example: echo "new content" | ./update-context.sh .claude/context/PROJECT_STATE.md

set -euo pipefail

FILE="${1:-}"
BACKUP_DIR=".claude/context/.backups"
LOCK_DIR=".claude/context/.locks"

# Validate input
if [ -z "$FILE" ]; then
  echo "Error: File path required"
  echo "Usage: $0 <file_path> < new_content"
  exit 1
fi

# Create necessary directories
mkdir -p "$BACKUP_DIR" "$LOCK_DIR"

# Acquire exclusive lock with timeout
LOCK_FILE="$LOCK_DIR/$(basename "$FILE").lock"
exec 200>"$LOCK_FILE"

echo "[$(date +%H:%M:%S)] Acquiring lock on $(basename "$FILE")..." >&2

if ! flock -w 30 200; then
  echo "Error: Failed to acquire lock on $FILE after 30 seconds" >&2
  echo "Another agent may be updating this file. Please try again." >&2
  exit 1
fi

echo "[$(date +%H:%M:%S)] Lock acquired" >&2

# Backup existing file (keep last 5 backups)
if [ -f "$FILE" ]; then
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="$BACKUP_DIR/$(basename "$FILE").$TIMESTAMP"

  cp "$FILE" "$BACKUP_FILE"
  echo "[$(date +%H:%M:%S)] Backup created: $(basename "$BACKUP_FILE")" >&2

  # Keep only last 5 backups
  ls -t "$BACKUP_DIR/$(basename "$FILE")."* 2>/dev/null | tail -n +6 | xargs -r rm -f
fi

# Atomic write: write to temp file, then move
TEMP_FILE="$(mktemp "${FILE}.XXXXXX")"

# Read new content from stdin
cat > "$TEMP_FILE"

# Verify content is not empty (safety check)
if [ ! -s "$TEMP_FILE" ]; then
  echo "Error: Refusing to write empty file to $FILE" >&2
  rm -f "$TEMP_FILE"
  flock -u 200
  exit 1
fi

# Atomic move
mv "$TEMP_FILE" "$FILE"
echo "[$(date +%H:%M:%S)] File updated successfully" >&2

# Generate checksum for integrity verification
md5sum "$FILE" > "${FILE}.md5"

# Release lock
flock -u 200
rm -f "$LOCK_FILE"

echo "[$(date +%H:%M:%S)] Lock released" >&2

exit 0
