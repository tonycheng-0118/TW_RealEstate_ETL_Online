## ADDED Requirements

### Requirement: CI workflow triggers on push and PR
The system SHALL run a CI workflow on every push to any branch and every pull request. The workflow MUST execute on GitHub Actions using `ubuntu-latest`.

#### Scenario: Push triggers CI
- **WHEN** a developer pushes code to any branch
- **THEN** the CI workflow starts automatically and runs all checks (lint, typecheck, build, test)

#### Scenario: PR triggers CI
- **WHEN** a pull request is opened or updated
- **THEN** the CI workflow starts automatically and the PR status reflects pass/fail

### Requirement: ESLint check
The CI MUST run ESLint via `npm run lint`. A lint failure SHALL cause the workflow to fail.

#### Scenario: Lint passes
- **WHEN** all source files pass ESLint rules
- **THEN** the lint step succeeds and CI proceeds to the next step

#### Scenario: Lint fails
- **WHEN** a source file violates an ESLint rule
- **THEN** the lint step fails and the CI workflow stops with exit code 1

### Requirement: TypeScript type check
The CI MUST run `tsc --noEmit` via `npm run typecheck`. A type error SHALL cause the workflow to fail.

#### Scenario: Type check passes
- **WHEN** all TypeScript files have no type errors
- **THEN** the typecheck step succeeds and CI proceeds

#### Scenario: Type check fails
- **WHEN** a TypeScript file contains a type error
- **THEN** the typecheck step fails and the CI workflow stops

### Requirement: Next.js build
The CI MUST run `npm run build` to verify the production build succeeds.

#### Scenario: Build succeeds
- **WHEN** all pages and API routes compile without errors
- **THEN** the build step succeeds and CI proceeds to tests

#### Scenario: Build fails
- **WHEN** the build encounters a compilation error
- **THEN** the build step fails and the CI workflow stops

### Requirement: Unit tests
The CI MUST run unit tests via `npm run test`. Test failures SHALL cause the workflow to fail. Tests MUST cover the following modules:

- `sql-guard.ts`: SQL whitelist validation (SELECT-only, dangerous keywords, semicolons, comments)
- `rate-limit.ts`: Rate limiting logic (allow within limit, reject over limit, window reset)
- `qwen.ts`: `extractSql()` (strip code blocks) and `stripThinking()` (strip think tags)

#### Scenario: All tests pass
- **WHEN** all unit tests pass
- **THEN** the test step succeeds and the CI workflow completes successfully

#### Scenario: A test fails
- **WHEN** one or more unit tests fail
- **THEN** the test step fails, the CI workflow stops, and the failure details are shown in the log

### Requirement: Fail-fast execution
The CI steps MUST execute in order: lint → typecheck → build → test. If any step fails, subsequent steps SHALL NOT run.

#### Scenario: Early step fails
- **WHEN** the lint step fails
- **THEN** typecheck, build, and test steps are skipped
