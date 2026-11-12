#!/bin/sh
# The checks of .github/workflows/ci.yml, run on this machine. The git hooks in .githooks/ call it:
# `rust` before each commit, `wasm` and `python` before each push.
#
#   scripts/check.sh            every check
#   scripts/check.sh rust       fmt, clippy and the Rust tests, every line and function run
#   scripts/check.sh wasm       the wasm tests, the site, the npm package as users get it, and the editor
#                               and the VS Code, browser and Google extensions on it (every line and function run)
#   scripts/check.sh python     the Python module with pytest
#
# Needs: rustup with the wasm32-unknown-unknown target and the llvm-tools-preview component, cargo-llvm-cov,
# wasm-bindgen-cli at the version in Cargo.lock, Node 22 (24 for the editor), pnpm and Python 3.12.
set -e
cd "$(dirname "$0")/.."

name=mathra

check_rust() {
  cargo fmt --all --check
  cargo clippy --workspace --exclude "$name-python" --all-targets -- -D warnings
  # the tests, measured, with Latin Modern on so its font settings run too: every line and function of the
  # workspace (the Python bindings aside) must run
  cargo llvm-cov --workspace --exclude "$name-python" --features "$name/latin-modern" --fail-under-lines 100 --fail-under-functions 100
  # the command line without the png feature refuses .png (the workspace build turns the feature on)
  cargo clippy -p "$name-cli" --no-default-features --all-targets -- -D warnings
  cargo test -p "$name-cli" --no-default-features
}

check_wasm() {
  CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUNNER=wasm-bindgen-test-runner \
    cargo test -p "$name-wasm" --target wasm32-unknown-unknown
  site/build.sh
  npm/build.sh && npm/test/run.sh
  (
    cd editor
    pnpm install --frozen-lockfile --silent
    pnpm build
    node --no-warnings scripts/coverage.mjs --fail-under 100
  )
  (
    cd vscode
    pnpm install --frozen-lockfile --silent
    pnpm typecheck
    pnpm coverage
    pnpm package
  )
  (
    cd browser
    pnpm install --frozen-lockfile --silent
    pnpm typecheck
    pnpm coverage
    pnpm build
  )
  (
    cd gworkspace
    pnpm install --frozen-lockfile --silent
    pnpm build
    pnpm coverage
  )
}

check_python() {
  (
    cd crates/python
    [ -d .venv ] || python3 -m venv .venv
    . .venv/bin/activate
    pip install --quiet maturin pytest
    maturin develop --quiet
    python -m pytest --quiet tests
  )
}

[ $# -eq 0 ] && set -- rust wasm python
for check in "$@"; do
  case "$check" in
    rust | wasm | python) echo "== $check"; "check_$check" ;;
    *) echo "unknown check: $check (rust, wasm or python)" >&2; exit 2 ;;
  esac
done
