# Phase 8D Admin Governance Console Design

## Goal

Turn the admin workbench from a placeholder into a real governance entrypoint, while closing the remaining persistent-runtime gap for Prompt templates and Skill packages.

## Scope

- Persist `prompt_templates` and `skill_packages` in PostgreSQL.
- Expose template governance and Prompt/Skill Registry HTTP routes from `apps/api`.
- Make `apps/web` `admin-console` load real governance data.
- Keep the phase narrow: do not expand into model registry UI, manuscript runtime, or full prompt/skill editing workflows yet.

## Design

### API

- Add a new migration for `prompt_templates` and `skill_packages`.
- Implement a PostgreSQL repository for Prompt/Skill Registry records.
- Wire persistent governance runtime to use the PostgreSQL-backed registry instead of the in-memory adapter.
- Extend the HTTP server runtime contract with:
  - `templateApi`
  - `promptSkillRegistryApi`
- Add HTTP routes for:
  - template family create/list/update
  - module template draft create/list-by-family/publish
  - prompt template create/list/publish
  - skill package create/list/publish

### Web

- Keep browser clients thin and route-focused.
- Add an admin governance controller that loads:
  - template families
  - module templates for the selected family
  - prompt templates
  - skill packages
- Add a minimal admin console page that supports:
  - creating template families
  - creating module template drafts
  - publishing draft module templates
  - inspecting prompt templates and skill packages
- Route both `admin-console` and `template-governance` to the shared governance page for now.

## Boundaries

- Prompt template and skill package creation is exposed through the API in this phase, but the web page is initially read-focused for those two registries.
- Knowledge/template/learning linkage rules stay unchanged.
- No mini program changes in this phase.

## Verification

- Database schema tests for new tables and indexes.
- PostgreSQL repository tests for Prompt/Skill persistence.
- HTTP tests for demo admin routes and persistent restart behavior.
- Web controller tests for the admin governance loading contract and selection behavior.
