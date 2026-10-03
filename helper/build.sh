#!/bin/sh
set -eu
here="$(cd "$(dirname "$0")" && pwd)"
target="$HOME/.claude/clubhouse-helper"
mkdir -p "$target"
xcrun swiftc -O -swift-version 5 -o "$target/window-tint" "$here/WindowTint.swift"
echo "Built $target/window-tint"
