#!/bin/bash
# Context File Helper Functions
# Source this file to use convenient wrapper functions

# Safe update function - use instead of direct echo/cat
safe_update_context() {
  local file="$1"
  local content="$2"

  echo "$content" | bash .claude/scripts/update-context.sh "$file"
}

# Append to context file safely
safe_append_context() {
  local file="$1"
  local new_content="$2"

  # Read existing, append new, write atomically
  local existing=""
  if [ -f "$file" ]; then
    existing=$(cat "$file")
  fi

  echo "${existing}${new_content}" | bash .claude/scripts/update-context.sh "$file"
}

# Update specific section in markdown file
safe_update_section() {
  local file="$1"
  local section_header="$2"
  local new_section_content="$3"

  if [ ! -f "$file" ]; then
    echo "Error: File $file does not exist" >&2
    return 1
  fi

  # Use Python for safer section replacement
  python3 - <<EOF
import sys
import re

with open('$file', 'r') as f:
    content = f.read()

# Find section and replace
pattern = r'(## $section_header.*?)(?=\n## |\Z)'
replacement = '## $section_header\n$new_section_content\n'

if re.search(pattern, content, re.DOTALL):
    updated = re.sub(pattern, replacement, content, flags=re.DOTALL)
else:
    # Section not found, append
    updated = content + '\n\n## $section_header\n$new_section_content\n'

sys.stdout.write(updated)
EOF
  | bash .claude/scripts/update-context.sh "$file"
}

# Verify file integrity
verify_context_integrity() {
  local file="$1"

  if [ ! -f "${file}.md5" ]; then
    echo "No checksum found for $file" >&2
    return 1
  fi

  if md5sum -c "${file}.md5" 2>/dev/null; then
    echo "✅ $file integrity verified"
    return 0
  else
    echo "❌ $file integrity check FAILED - possible corruption" >&2
    return 1
  fi
}

# Recover from backup
recover_from_backup() {
  local file="$1"
  local backup_dir=".claude/context/.backups"

  echo "Available backups for $(basename "$file"):"
  ls -lht "$backup_dir/$(basename "$file")."* 2>/dev/null | head -5

  local latest=$(ls -t "$backup_dir/$(basename "$file")."* 2>/dev/null | head -1)

  if [ -z "$latest" ]; then
    echo "No backups found" >&2
    return 1
  fi

  read -p "Restore from $latest? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    cp "$latest" "$file"
    echo "✅ Restored from backup"
    return 0
  else
    echo "Restore cancelled"
    return 1
  fi
}

# Export functions
export -f safe_update_context
export -f safe_append_context
export -f safe_update_section
export -f verify_context_integrity
export -f recover_from_backup
