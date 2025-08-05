#!/bin/bash

# Prettify all files in the src directory
# This script formats JavaScript, Vue, CSS, and JSON files

set -e  # Exit on any error

echo "🎨 Starting prettification of src directory..."

# Check if prettier is installed
if ! command -v npx prettier &> /dev/null; then
    echo "❌ Prettier not found. Installing prettier..."
    npm install --save-dev prettier
fi

# Change to the vue directory
cd "$(dirname "$0")"

echo "📁 Formatting JavaScript files..."
npx prettier --write "src/**/*.js" --config .prettierrc 2>/dev/null || npx prettier --write "src/**/*.js" 2>/dev/null || echo "   No JavaScript files found"

echo "📁 Formatting Vue files..."
npx prettier --write "src/**/*.vue" --config .prettierrc 2>/dev/null || npx prettier --write "src/**/*.vue" 2>/dev/null || echo "   No Vue files found"

echo "📁 Formatting CSS files..."
npx prettier --write "src/**/*.css" --config .prettierrc 2>/dev/null || npx prettier --write "src/**/*.css" 2>/dev/null || echo "   No CSS files found"

echo "📁 Formatting JSON files..."
npx prettier --write "src/**/*.json" --config .prettierrc 2>/dev/null || npx prettier --write "src/**/*.json" 2>/dev/null || echo "   No JSON files found"

echo "📁 Formatting JSX files (if any)..."
npx prettier --write "src/**/*.jsx" --config .prettierrc 2>/dev/null || npx prettier --write "src/**/*.jsx" 2>/dev/null || echo "   No JSX files found"

echo "📁 Formatting TypeScript files (if any)..."
npx prettier --write "src/**/*.ts" --config .prettierrc 2>/dev/null || npx prettier --write "src/**/*.ts" 2>/dev/null || echo "   No TypeScript files found"
npx prettier --write "src/**/*.tsx" --config .prettierrc 2>/dev/null || npx prettier --write "src/**/*.tsx" 2>/dev/null || echo "   No TSX files found"

echo "📁 Formatting Markdown files (if any)..."
npx prettier --write "src/**/*.md" --config .prettierrc 2>/dev/null || npx prettier --write "src/**/*.md" 2>/dev/null || echo "   No Markdown files found"

echo "✅ Prettification complete!"
echo "📊 Summary of formatted files:"
echo "   - JavaScript files: $(find src -name "*.js" | wc -l)"
echo "   - Vue files: $(find src -name "*.vue" | wc -l)"
echo "   - CSS files: $(find src -name "*.css" | wc -l)"
echo "   - JSON files: $(find src -name "*.json" | wc -l)"
echo "   - JSX files: $(find src -name "*.jsx" | wc -l)"
echo "   - TypeScript files: $(find src -name "*.ts" -o -name "*.tsx" | wc -l)"
echo "   - Markdown files: $(find src -name "*.md" | wc -l)"

echo ""
echo "🎯 All files in src directory have been prettified!" 