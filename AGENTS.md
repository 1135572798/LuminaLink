# LuminaLink Agent Instructions

## Project Positioning

LuminaLink is an open-source desktop manager for local AI assistant assets:

- Codex skills
- Codex plugins
- project-level Agent instructions
- reusable project documentation
- Chinese translation cache for English-first plugin and skill descriptions

The app must work on a fresh computer after installation. It must not depend on
hard-coded paths from one developer machine.

## Communication

- Prefer Chinese when communicating with the project owner.
- Keep user-facing docs practical and easy to scan.
- Do not put raw passwords, tokens, cookies, private keys, or API keys into this
  file, chat, committed docs, or memory.

## Portability Rules

- Do not hard-code user-specific absolute paths in application source code.
- Use environment-derived paths where possible:
  - `%USERPROFILE%`
  - `%APPDATA%`
  - `%LOCALAPPDATA%`
  - user-selected project roots
- Store machine-specific app config outside the repo, for example:
  `%APPDATA%\LuminaLink\config.json`
- Store caches and generated indexes outside the repo, for example:
  `%LOCALAPPDATA%\LuminaLink\`
- Keep repository defaults in versioned template files, not in personal local
  config files.

## Recommended Config Model

The repository may include safe default templates such as:

- `config/default-scans.json`
- `config/provider.schema.json`
- `docs/portable-setup.md`

User-specific files should be generated locally and ignored by Git, such as:

- `.luminalink/local.config.json`
- `.luminalink/secrets.local.json`
- local SQLite databases
- translation cache databases

## Agent File Compatibility

Use `AGENTS.md` as the canonical file name for Codex compatibility.
The application may scan additional common names for compatibility:

- `AGENTS.md`
- `AGENT.md`
- `Agent.md`
- `CLAUDE.md`
- `.cursorrules`

When multiple files exist, prefer `AGENTS.md` and show the others as related
agent instruction files.

## First MVP Scope

The first usable version should be read-only by default:

1. Scan known local skill/plugin/agent paths.
2. Parse asset metadata and descriptions.
3. Store an index in local SQLite.
4. Translate English descriptions into Chinese without modifying original files.
5. Display Chinese by default with an original-text toggle.
6. Allow opening source folders and documentation files.

Editing, installing, updating, enabling, or disabling plugins should be added
after the read-only asset index is stable.

## Agent Operation Runbook

For user-facing operations, such as asking Codex to help scan assets, translate
plugins, add scan roots, find installed skills, or export migration data, use:

`AGENT_RUNBOOK.md`

Keep `AGENTS.md` focused on project development rules. Keep
`AGENT_RUNBOOK.md` focused on how agents should operate the client safely for a
user.

## Documentation Rule

When implementing durable project behavior for a specific user or workstation,
keep that user's private reference notes outside the public repository.

Public repository docs should describe portable behavior: how to run the app,
where local config is stored, how migration works, and any important caveats.
