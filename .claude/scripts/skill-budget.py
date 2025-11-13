#!/usr/bin/env python3
"""
Skill Loading Budget Manager

Prevents skill loading cascade explosions that exhaust token budget.
Addresses Edge Case 5.1: Skill loading cascade → exponential token usage
Addresses Edge Case 5.3: Expensive skill loaded unnecessarily

Features:
- Tracks skill loading and token consumption
- Enforces maximum skills per session
- Enforces maximum total token budget for skills
- Prioritizes skills by relevance
- Lazy-loads dependencies only when needed
- Provides loading recommendations
"""

import json
import sys
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import re

# Configuration
DEFAULT_MAX_SKILLS = 3
DEFAULT_MAX_SKILL_TOKENS = 2000
DEFAULT_SKILL_DIR = '.claude/skills'

class SkillMetadata:
    """Represents skill metadata from YAML frontmatter."""

    def __init__(self, skill_path: Path):
        self.path = skill_path
        self.name = self._extract_name()
        self.token_budget = self._extract_token_budget()
        self.priority = self._extract_priority()
        self.dependencies = self._extract_dependencies()
        self.triggers = self._extract_triggers()

    def _read_frontmatter(self) -> Dict[str, any]:
        """Extract YAML frontmatter from skill file."""
        with open(self.path / 'skill.md', 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract YAML block
        match = re.search(r'```yaml\n---\n(.*?)\n---\n```', content, re.DOTALL)
        if not match:
            return {}

        yaml_content = match.group(1)

        # Simple YAML parser (for our specific format)
        metadata = {}
        current_key = None
        current_list = None

        for line in yaml_content.split('\n'):
            line = line.strip()
            if not line or line.startswith('#'):
                continue

            if ':' in line and not line.startswith('-'):
                key, value = line.split(':', 1)
                key = key.strip()
                value = value.strip()

                if value:
                    # Try to parse as number
                    try:
                        if '.' in value:
                            metadata[key] = float(value)
                        else:
                            metadata[key] = int(value)
                    except ValueError:
                        metadata[key] = value.strip('"\'')
                else:
                    # List or dict coming
                    current_key = key
                    current_list = []
                    metadata[key] = current_list
            elif line.startswith('-') and current_list is not None:
                value = line[1:].strip().strip('"\'')
                current_list.append(value)

        return metadata

    def _extract_name(self) -> str:
        metadata = self._read_frontmatter()
        return metadata.get('name', self.path.name)

    def _extract_token_budget(self) -> int:
        metadata = self._read_frontmatter()
        return metadata.get('token_budget', 500)

    def _extract_priority(self) -> str:
        metadata = self._read_frontmatter()
        return metadata.get('priority', 'medium')

    def _extract_dependencies(self) -> List[str]:
        metadata = self._read_frontmatter()
        deps = metadata.get('dependencies', [])
        return deps if isinstance(deps, list) else []

    def _extract_triggers(self) -> Dict[str, List[str]]:
        metadata = self._read_frontmatter()
        triggers = metadata.get('triggers', {})
        if isinstance(triggers, dict):
            return triggers
        return {}

class SkillLoadingBudget:
    """Manages skill loading with budget constraints."""

    def __init__(
        self,
        skill_dir: str = DEFAULT_SKILL_DIR,
        max_skills: int = DEFAULT_MAX_SKILLS,
        max_tokens: int = DEFAULT_MAX_SKILL_TOKENS
    ):
        self.skill_dir = Path(skill_dir)
        self.max_skills = max_skills
        self.max_tokens = max_tokens
        self.loaded_skills: List[SkillMetadata] = []
        self.total_tokens_used = 0
        self.available_skills = self._discover_skills()

    def _discover_skills(self) -> Dict[str, SkillMetadata]:
        """Discover all available skills."""
        skills = {}

        if not self.skill_dir.exists():
            return skills

        # Recursively find all skill.md files
        for skill_file in self.skill_dir.rglob('skill.md'):
            skill_path = skill_file.parent
            try:
                skill = SkillMetadata(skill_path)
                skills[skill.name] = skill
            except Exception as e:
                print(f"Warning: Failed to load skill at {skill_path}: {e}", file=sys.stderr)

        return skills

    def can_load_skill(self, skill_name: str) -> Tuple[bool, str]:
        """
        Check if skill can be loaded within budget.

        Returns:
            (can_load, reason)
        """
        if skill_name not in self.available_skills:
            return False, f"Skill '{skill_name}' not found"

        skill = self.available_skills[skill_name]

        # Check if already loaded
        if any(s.name == skill_name for s in self.loaded_skills):
            return True, "Already loaded (no additional cost)"

        # Check skill count limit
        if len(self.loaded_skills) >= self.max_skills:
            return False, f"Maximum skills reached ({self.max_skills})"

        # Check token budget
        if self.total_tokens_used + skill.token_budget > self.max_tokens:
            return False, f"Would exceed token budget ({self.total_tokens_used + skill.token_budget} > {self.max_tokens})"

        return True, "Can load"

    def load_skill(self, skill_name: str, force: bool = False) -> Tuple[bool, str]:
        """
        Load a skill if within budget.

        Args:
            skill_name: Name of skill to load
            force: Override budget constraints

        Returns:
            (success, message)
        """
        if not force:
            can_load, reason = self.can_load_skill(skill_name)
            if not can_load:
                return False, f"Cannot load skill: {reason}"

        if skill_name not in self.available_skills:
            return False, f"Skill '{skill_name}' not found"

        skill = self.available_skills[skill_name]

        # Check if already loaded
        if any(s.name == skill_name for s in self.loaded_skills):
            return True, f"Skill '{skill_name}' already loaded"

        # Load skill
        self.loaded_skills.append(skill)
        self.total_tokens_used += skill.token_budget

        return True, f"Loaded '{skill_name}' ({skill.token_budget} tokens)"

    def load_with_dependencies(self, skill_name: str, lazy: bool = True) -> Tuple[bool, List[str]]:
        """
        Load skill with dependencies.

        Args:
            skill_name: Name of skill to load
            lazy: Only load dependencies if budget allows

        Returns:
            (success, messages)
        """
        messages = []

        if skill_name not in self.available_skills:
            return False, [f"Skill '{skill_name}' not found"]

        skill = self.available_skills[skill_name]

        # Load dependencies first
        for dep in skill.dependencies:
            if lazy:
                can_load, reason = self.can_load_skill(dep)
                if not can_load:
                    messages.append(f"⚠️  Skipping dependency '{dep}': {reason}")
                    continue

            success, msg = self.load_skill(dep, force=not lazy)
            messages.append(f"Dependency: {msg}")

        # Load main skill
        success, msg = self.load_skill(skill_name)
        messages.append(msg)

        return success, messages

    def recommend_skills(self, context: str, max_recommendations: int = 3) -> List[Tuple[str, float]]:
        """
        Recommend skills based on context.

        Args:
            context: User query or file content
            max_recommendations: Maximum skills to recommend

        Returns:
            List of (skill_name, relevance_score) tuples
        """
        context_lower = context.lower()
        scored_skills = []

        for skill_name, skill in self.available_skills.items():
            # Skip already loaded
            if any(s.name == skill_name for s in self.loaded_skills):
                continue

            score = 0.0

            # Check keyword triggers
            if 'keywords' in skill.triggers:
                for keyword in skill.triggers['keywords']:
                    if keyword.lower() in context_lower:
                        score += 1.0

            # Check file triggers
            if 'files' in skill.triggers:
                for pattern in skill.triggers['files']:
                    # Simple glob-like matching
                    pattern_regex = pattern.replace('*', '.*').replace('.', r'\.')
                    if re.search(pattern_regex, context_lower):
                        score += 2.0

            # Priority bonus
            priority_bonus = {
                'high': 0.5,
                'medium': 0.0,
                'low': -0.5
            }
            score += priority_bonus.get(skill.priority.lower(), 0.0)

            # Smaller token budget is better (when tied on relevance)
            score -= (skill.token_budget / 1000.0) * 0.1

            if score > 0:
                scored_skills.append((skill_name, score))

        # Sort by score descending
        scored_skills.sort(key=lambda x: x[1], reverse=True)

        return scored_skills[:max_recommendations]

    def get_status(self) -> str:
        """Get current loading status."""
        lines = [
            "Skill Loading Budget Status",
            "=" * 60,
            f"Loaded Skills: {len(self.loaded_skills)} / {self.max_skills}",
            f"Token Budget: {self.total_tokens_used} / {self.max_tokens} ({(self.total_tokens_used/self.max_tokens)*100:.1f}%)",
            ""
        ]

        if self.loaded_skills:
            lines.append("Currently Loaded:")
            for skill in self.loaded_skills:
                lines.append(f"  - {skill.name:20s} ({skill.token_budget:4d} tokens, priority: {skill.priority})")
        else:
            lines.append("No skills loaded")

        lines.append("")
        lines.append(f"Available Skills: {len(self.available_skills)}")
        lines.append(f"Remaining Budget: {self.max_tokens - self.total_tokens_used} tokens")
        lines.append(f"Can Load: {self.max_skills - len(self.loaded_skills)} more skills")

        return '\n'.join(lines)

    def unload_skill(self, skill_name: str) -> Tuple[bool, str]:
        """Unload a skill to free up budget."""
        for i, skill in enumerate(self.loaded_skills):
            if skill.name == skill_name:
                self.loaded_skills.pop(i)
                self.total_tokens_used -= skill.token_budget
                return True, f"Unloaded '{skill_name}' (freed {skill.token_budget} tokens)"

        return False, f"Skill '{skill_name}' not loaded"

    def reset(self):
        """Reset all loaded skills."""
        count = len(self.loaded_skills)
        tokens = self.total_tokens_used
        self.loaded_skills = []
        self.total_tokens_used = 0
        return f"Reset: Unloaded {count} skills ({tokens} tokens)"

def main():
    """CLI interface."""
    import argparse

    parser = argparse.ArgumentParser(
        description='Skill Loading Budget Manager',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Check if skill can be loaded
  ./skill-budget.py can-load evm-expert

  # Load a skill
  ./skill-budget.py load evm-expert

  # Load with dependencies (lazy)
  ./skill-budget.py load-deps defi-protocols

  # Recommend skills for context
  ./skill-budget.py recommend "I need to deploy a Uniswap integration"

  # Show current status
  ./skill-budget.py status

  # Unload a skill
  ./skill-budget.py unload evm-expert

  # Reset all
  ./skill-budget.py reset
        """
    )

    parser.add_argument('--max-skills', type=int, default=DEFAULT_MAX_SKILLS, help='Max skills allowed')
    parser.add_argument('--max-tokens', type=int, default=DEFAULT_MAX_SKILL_TOKENS, help='Max total tokens for skills')
    parser.add_argument('--skill-dir', default=DEFAULT_SKILL_DIR, help='Skills directory')

    subparsers = parser.add_subparsers(dest='command', help='Command to execute')

    # can-load command
    can_load_parser = subparsers.add_parser('can-load', help='Check if skill can be loaded')
    can_load_parser.add_argument('skill', help='Skill name')

    # load command
    load_parser = subparsers.add_parser('load', help='Load a skill')
    load_parser.add_argument('skill', help='Skill name')
    load_parser.add_argument('--force', action='store_true', help='Override budget constraints')

    # load-deps command
    load_deps_parser = subparsers.add_parser('load-deps', help='Load skill with dependencies')
    load_deps_parser.add_argument('skill', help='Skill name')
    load_deps_parser.add_argument('--eager', action='store_true', help='Load all dependencies (not lazy)')

    # recommend command
    recommend_parser = subparsers.add_parser('recommend', help='Recommend skills for context')
    recommend_parser.add_argument('context', help='Context string (query or filename)')
    recommend_parser.add_argument('--max', type=int, default=3, help='Max recommendations')

    # unload command
    unload_parser = subparsers.add_parser('unload', help='Unload a skill')
    unload_parser.add_argument('skill', help='Skill name')

    # status command
    subparsers.add_parser('status', help='Show current status')

    # reset command
    subparsers.add_parser('reset', help='Reset all loaded skills')

    # list command
    subparsers.add_parser('list', help='List all available skills')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    manager = SkillLoadingBudget(
        skill_dir=args.skill_dir,
        max_skills=args.max_skills,
        max_tokens=args.max_tokens
    )

    if args.command == 'can-load':
        can_load, reason = manager.can_load_skill(args.skill)
        if can_load:
            print(f"✅ {reason}")
            sys.exit(0)
        else:
            print(f"❌ {reason}")
            sys.exit(1)

    elif args.command == 'load':
        success, msg = manager.load_skill(args.skill, force=args.force)
        print(f"{'✅' if success else '❌'} {msg}")
        sys.exit(0 if success else 1)

    elif args.command == 'load-deps':
        success, messages = manager.load_with_dependencies(args.skill, lazy=not args.eager)
        for msg in messages:
            print(msg)
        sys.exit(0 if success else 1)

    elif args.command == 'recommend':
        recommendations = manager.recommend_skills(args.context, args.max)

        if not recommendations:
            print("No skill recommendations for this context")
        else:
            print(f"Recommended skills for: '{args.context[:50]}...'")
            print("=" * 60)
            for skill_name, score in recommendations:
                skill = manager.available_skills[skill_name]
                print(f"{skill_name:20s} (score: {score:.2f}, tokens: {skill.token_budget}, priority: {skill.priority})")

    elif args.command == 'unload':
        success, msg = manager.unload_skill(args.skill)
        print(f"{'✅' if success else '❌'} {msg}")

    elif args.command == 'status':
        print(manager.get_status())

    elif args.command == 'reset':
        msg = manager.reset()
        print(f"✅ {msg}")

    elif args.command == 'list':
        print("Available Skills")
        print("=" * 80)
        for name, skill in sorted(manager.available_skills.items()):
            print(f"{name:25s} {skill.token_budget:4d} tokens  priority: {skill.priority:6s}  deps: {len(skill.dependencies)}")

if __name__ == '__main__':
    main()
