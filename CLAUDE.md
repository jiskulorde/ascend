<!-- CLAUDE.md -->

# Ascend DMC — Claude Code Instructions

## Project Purpose

Ascend DMC is a sales-facing real-estate application for unit selection, pricing, financing, and customer payment computations.

The central product question is:

> How can a salesperson go from having a customer interested in a unit to having a clear, accurate, customer-ready payment proposal as quickly and safely as possible?

Treat this as a business-critical sales application, not merely a frontend calculator.

## Current Working Mode

* Work conservatively.
* Audit and understand before redesigning or refactoring.
* Do not perform a blind rewrite.
* Explain significant architectural changes before implementing them.
* During audit/discovery work, prefer read-only inspection and planning.
* Do not begin a major implementation phase without explicit user approval.

## Git Safety

* The protected/current production branch is `main`.
* Claude-assisted rebuild work is performed from `claude/rebuild` or an explicitly approved feature branch.
* Never commit without explicit user approval.
* Never push without explicit user approval.
* Never merge branches without explicit user approval.
* Never force-push.
* Never rewrite Git history unless explicitly instructed.
* Before destructive Git operations, explain the operation and its consequences.

## Dependencies

* Do not install a new package without explicit approval.
* Do not upgrade dependencies without explicit approval.
* Do not remove dependencies without explicit approval.
* First explain why a dependency is needed, alternatives considered, and its impact.
* Prefer the existing stack unless there is a clear business or technical reason to change it.

## Security and Secrets

* Never expose, print, commit, or copy secrets.
* Never request production credentials merely to understand the application.
* Never commit `.env`, `.env.local`, passwords, tokens, cookies, private keys, service-role keys, or database credentials.
* `.env.example` may contain variable names and empty/fake values only.
* Treat Supabase service-role credentials as highly sensitive.
* Flag suspected credentials or sensitive information immediately.

## Supabase and Production Data

* Do not modify the production Supabase database.
* Do not create, alter, or delete production tables, columns, functions, triggers, policies, storage, or data without explicit approval.
* Database changes must eventually use documented migrations and rollback plans.
* During the initial audit, inspect repository code/configuration only unless additional access is explicitly approved.
* Do not assume current database architecture is correct.

## Financial and Business Logic

Financial calculations are business-critical.

* Do not change financial formulas simply to clean up or modernize code.
* First document the current formula and its source.
* Identify duplicated, hardcoded, configurable, and database-driven business rules.
* Verify unclear business rules with the user before changing them.
* Financial calculations should eventually become deterministic and independently testable.
* Pay special attention to:

  * list price
  * discounts
  * total contract price
  * downpayment
  * reservation fee
  * net downpayment
  * monthly downpayment
  * bank balance
  * bank amortization
  * Rent-to-Own calculations
  * move-in cash
  * security deposit
  * utility deposit
  * turnover fees
  * closing fees

## CRM Scope

The CRM functionality is currently on hold.

* Treat CRM as out of scope for the current rebuild.
* Do not expand or redesign CRM unless explicitly approved.
* If CRM appears in the product, treat it as a future / Coming Soon feature for now.
* Existing CRM-related code should not be deleted merely because the feature is paused.

## Source File Path Convention

For every newly created source or documentation file, and every existing file that is substantially recoded:

* Add the repository-relative file path as a comment near the top of the file.
* Normally make it the first line.

Examples:

`// src/app/computation/page.tsx`

`# integrations/inventory-downloader/dmci_daily_inventory.py`

`/* src/app/globals.css */`

`-- supabase/migrations/example.sql`

`<!-- docs/business-rules.md -->`

Exceptions:

* Do not add comments to formats that do not support comments, such as strict JSON.
* Do not manually alter generated files solely to add a path comment.
* If a file requires a mandatory first line such as a shebang, keep that first and put the path comment immediately after it.
* Never break a file format just to satisfy this convention.

## UI/UX Principles

The application should feel:

* professional
* premium
* clean
* modern
* trustworthy
* fast to scan
* responsive

Prioritize:

1. Selected unit
2. Price
3. Downpayment
4. Monthly payment
5. RTO monthly payment when applicable
6. Cash required to move in
7. Financing
8. Important fees

Known issues to preserve for later review:

* The computation sheet becomes too wide on large screens.
* Bank Financing content can overlap.
* Rows should remain compact but readable.
* Total Downpayment + Rent to Own should be highlighted as a complete result/container.

Do not redesign these areas until the audit and requirements review are complete.

## Code Changes

Before modifying existing architecture:

1. Understand the current implementation.
2. Identify dependencies and affected code.
3. Explain the proposed change.
4. Identify risks.
5. Identify how the change will be tested.
6. Obtain approval when the change is architectural, destructive, financial, database-related, or dependency-related.

Prefer small, reviewable changes over large rewrites.

## Testing and Validation

When implementation work begins:

* Inspect existing package scripts and test infrastructure first.
* Use existing lint, typecheck, test, and build commands where available.
* Do not invent or install new testing infrastructure without approval.
* Financial calculation tests should eventually cover normal and edge cases.
* Do not claim a change works unless it has been appropriately validated.

## External Integrations

The wider system includes external inventory/data workflows in addition to the Next.js repository.

These may include:

* Google Sheets
* Google Apps Script
* automated DMCI inventory retrieval
* manually maintained project/tower/RTO reference data
* Supabase
* Vercel

Do not assume the Next.js repository is the entire system.

Additional integration documentation will be added separately.

## Communication

* Explain important actions in plain language.
* Assume the user is learning Claude Code and software-development workflows.
* For potentially risky actions, explain what the command/action does before asking the user to execute or approve it.
* Ask when an important business requirement is unclear rather than guessing.
* Keep recommendations practical and avoid unnecessary overengineering.
