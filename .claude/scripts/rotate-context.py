#!/usr/bin/env python3
"""
Context File Rotation System

Prevents context files from exceeding token budgets by archiving old entries.
Addresses Edge Case 1.4: Context file exceeds token budget → lost-in-middle effect

Features:
- Automatic rotation when token limit exceeded
- Age-based archiving (configurable threshold)
- Preserves recent entries for active context
- Maintains archive for historical reference
- Token estimation (rough: 1 token ≈ 4 characters)
"""

import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Tuple, List

# Configuration
DEFAULT_MAX_TOKENS = 5000
DEFAULT_AGE_THRESHOLD_DAYS = 14
TOKEN_TO_CHAR_RATIO = 4  # Rough estimate: 1 token ≈ 4 characters

def estimate_tokens(content: str) -> int:
    """Estimate token count from character count."""
    return len(content) // TOKEN_TO_CHAR_RATIO

def parse_date_from_line(line: str) -> datetime | None:
    """Extract date from various formats in markdown."""
    # Format 1: YYYY-MM-DD
    match = re.search(r'(\d{4}-\d{2}-\d{2})', line)
    if match:
        try:
            return datetime.strptime(match.group(1), '%Y-%m-%d')
        except ValueError:
            pass

    # Format 2: Month DD, YYYY
    match = re.search(r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})', line)
    if match:
        try:
            date_str = f"{match.group(1)} {match.group(2)}, {match.group(3)}"
            return datetime.strptime(date_str, '%B %d, %Y')
        except ValueError:
            pass

    return None

def split_by_age(content: str, cutoff_days: int) -> Tuple[str, str]:
    """
    Split content into current (recent) and archive (old) sections.

    Args:
        content: Full markdown content
        cutoff_days: Number of days to keep in current section

    Returns:
        (current_content, archive_content)
    """
    lines = content.split('\n')
    cutoff_date = datetime.now() - timedelta(days=cutoff_days)

    current_lines = []
    archive_lines = []
    current_section = []
    current_section_date = None

    # Markdown section detection
    in_section = False
    section_level = 0

    for line in lines:
        # Detect section headers
        if line.startswith('#'):
            # Save previous section
            if current_section:
                if current_section_date and current_section_date < cutoff_date:
                    archive_lines.extend(current_section)
                else:
                    current_lines.extend(current_section)

            # Start new section
            current_section = [line]
            current_section_date = parse_date_from_line(line)
            section_level = len(line) - len(line.lstrip('#'))
            in_section = True
        else:
            # Check for dates in content
            if not current_section_date:
                current_section_date = parse_date_from_line(line)

            if in_section:
                current_section.append(line)

    # Handle last section
    if current_section:
        if current_section_date and current_section_date < cutoff_date:
            archive_lines.extend(current_section)
        else:
            current_lines.extend(current_section)

    # Preserve header and important sections
    preserved_sections = []
    for line in lines:
        if line.startswith('#') and any(keyword in line.lower() for keyword in ['overview', 'instructions', 'quick status']):
            # Find this section and always keep it
            idx = lines.index(line)
            section_end = idx + 1
            while section_end < len(lines) and not lines[section_end].startswith('#'):
                section_end += 1
            preserved_sections.extend(lines[idx:section_end])
            break

    current_content = '\n'.join(preserved_sections + current_lines)
    archive_content = '\n'.join(archive_lines)

    return current_content, archive_content

def rotate_context_file(
    file_path: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    age_threshold_days: int = DEFAULT_AGE_THRESHOLD_DAYS,
    dry_run: bool = False
) -> dict:
    """
    Rotate context file if it exceeds token limit.

    Args:
        file_path: Path to context file
        max_tokens: Maximum tokens before rotation
        age_threshold_days: Archive entries older than this
        dry_run: If True, don't actually write files

    Returns:
        dict with status and statistics
    """
    path = Path(file_path)

    if not path.exists():
        return {
            'status': 'error',
            'message': f'File not found: {file_path}'
        }

    # Read content
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Estimate tokens
    current_tokens = estimate_tokens(content)

    if current_tokens <= max_tokens:
        return {
            'status': 'ok',
            'message': 'No rotation needed',
            'current_tokens': current_tokens,
            'max_tokens': max_tokens,
            'percentage': (current_tokens / max_tokens) * 100
        }

    # Split content
    current, archive = split_by_age(content, age_threshold_days)

    current_tokens_after = estimate_tokens(current)
    archive_tokens = estimate_tokens(archive)

    # Prepare archive file path
    archive_path = path.parent / f"{path.stem}.archive{path.suffix}"

    if not dry_run:
        # Write current (rotated) version
        with open(path, 'w', encoding='utf-8') as f:
            f.write(current)

        # Append to archive
        archive_content = f"\n\n---\n\n# Archive Entry - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n{archive}"

        if archive_path.exists():
            with open(archive_path, 'a', encoding='utf-8') as f:
                f.write(archive_content)
        else:
            with open(archive_path, 'w', encoding='utf-8') as f:
                f.write(f"# {path.name} - Archive\n\n")
                f.write("This file contains historical entries that were rotated out of the main context file.\n\n")
                f.write(archive_content)

    return {
        'status': 'rotated',
        'message': f'Rotated {archive_tokens} tokens to archive',
        'before_tokens': current_tokens,
        'after_tokens': current_tokens_after,
        'archived_tokens': archive_tokens,
        'max_tokens': max_tokens,
        'reduction_percentage': ((current_tokens - current_tokens_after) / current_tokens) * 100,
        'archive_path': str(archive_path)
    }

def check_all_context_files(
    context_dir: str = '.claude/context',
    max_tokens: int = DEFAULT_MAX_TOKENS
) -> List[dict]:
    """
    Check all context files and report which need rotation.

    Returns:
        List of dicts with file status
    """
    context_path = Path(context_dir)

    if not context_path.exists():
        return [{'status': 'error', 'message': f'Directory not found: {context_dir}'}]

    results = []

    for file_path in context_path.glob('*.md'):
        if 'archive' in file_path.name.lower():
            continue  # Skip archive files

        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        tokens = estimate_tokens(content)
        percentage = (tokens / max_tokens) * 100

        needs_rotation = tokens > max_tokens
        warning = tokens > (max_tokens * 0.8)  # Warn at 80%

        results.append({
            'file': file_path.name,
            'path': str(file_path),
            'tokens': tokens,
            'max_tokens': max_tokens,
            'percentage': percentage,
            'needs_rotation': needs_rotation,
            'warning': warning and not needs_rotation,
            'status': 'needs_rotation' if needs_rotation else ('warning' if warning else 'ok')
        })

    return results

def main():
    """CLI interface for context rotation."""
    import argparse

    parser = argparse.ArgumentParser(
        description='Rotate context files to prevent token budget overflow',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Check all context files
  ./rotate-context.py check

  # Rotate specific file
  ./rotate-context.py rotate .claude/context/PROJECT_STATE.md

  # Dry run (preview what would be rotated)
  ./rotate-context.py rotate .claude/context/PROJECT_STATE.md --dry-run

  # Custom token limit
  ./rotate-context.py rotate .claude/context/PROJECT_STATE.md --max-tokens 3000

  # Custom age threshold
  ./rotate-context.py rotate .claude/context/PROJECT_STATE.md --days 7
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Command to execute')

    # Check command
    check_parser = subparsers.add_parser('check', help='Check all context files')
    check_parser.add_argument('--context-dir', default='.claude/context', help='Context directory')
    check_parser.add_argument('--max-tokens', type=int, default=DEFAULT_MAX_TOKENS, help='Max tokens threshold')

    # Rotate command
    rotate_parser = subparsers.add_parser('rotate', help='Rotate a context file')
    rotate_parser.add_argument('file', help='Path to context file')
    rotate_parser.add_argument('--max-tokens', type=int, default=DEFAULT_MAX_TOKENS, help='Max tokens before rotation')
    rotate_parser.add_argument('--days', type=int, default=DEFAULT_AGE_THRESHOLD_DAYS, help='Archive entries older than N days')
    rotate_parser.add_argument('--dry-run', action='store_true', help='Preview without writing')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == 'check':
        results = check_all_context_files(args.context_dir, args.max_tokens)

        print("Context File Status Report")
        print("=" * 70)

        for result in results:
            if result.get('status') == 'error':
                print(f"❌ {result['message']}")
                continue

            file = result['file']
            tokens = result['tokens']
            percentage = result['percentage']
            status = result['status']

            if status == 'needs_rotation':
                icon = '🔴'
            elif status == 'warning':
                icon = '🟡'
            else:
                icon = '✅'

            print(f"{icon} {file:30s} {tokens:6d} tokens ({percentage:5.1f}%)")

        # Summary
        needs_rotation = [r for r in results if r.get('needs_rotation')]
        warnings = [r for r in results if r.get('warning')]

        print("\n" + "=" * 70)
        print(f"Files needing rotation: {len(needs_rotation)}")
        print(f"Files with warnings: {len(warnings)}")

        if needs_rotation:
            print("\n🔴 Action required: Rotate these files:")
            for r in needs_rotation:
                print(f"   ./rotate-context.py rotate {r['path']}")

    elif args.command == 'rotate':
        result = rotate_context_file(
            args.file,
            max_tokens=args.max_tokens,
            age_threshold_days=args.days,
            dry_run=args.dry_run
        )

        if result['status'] == 'error':
            print(f"❌ Error: {result['message']}")
            sys.exit(1)
        elif result['status'] == 'ok':
            print(f"✅ {result['message']}")
            print(f"   Current: {result['current_tokens']} tokens ({result['percentage']:.1f}%)")
        elif result['status'] == 'rotated':
            if args.dry_run:
                print(f"🔍 DRY RUN - No files modified")
            print(f"✅ {result['message']}")
            print(f"   Before:  {result['before_tokens']} tokens")
            print(f"   After:   {result['after_tokens']} tokens")
            print(f"   Archived: {result['archived_tokens']} tokens")
            print(f"   Reduction: {result['reduction_percentage']:.1f}%")
            print(f"   Archive: {result['archive_path']}")

if __name__ == '__main__':
    main()
