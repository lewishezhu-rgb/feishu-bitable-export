#!/bin/sh
set -eu

SKILL_NAME="feishu-bitable-export"
SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TARGET_ROOT="${AGENT_SKILLS_DIR:-$HOME/.agents/skills}"
TARGET="$TARGET_ROOT/$SKILL_NAME"

if [ -e "$TARGET" ] || [ -L "$TARGET" ]; then
  printf '%s\n' "Refusing to replace existing skill: $TARGET" >&2
  printf '%s\n' "Remove it yourself or choose AGENT_SKILLS_DIR before retrying." >&2
  exit 1
fi

mkdir -p "$TARGET_ROOT"
ln -s "$SOURCE_DIR" "$TARGET"
printf '%s\n' "Installed: $TARGET"
printf '%s\n' "For CodeBuddy, also link or copy this folder to ~/.codebuddy/skills/$SKILL_NAME if needed."
