# Master Rules
- Do NEVER add "Generated with Claude Code" on pull request
- Do NEVER add co-author on the commit you create
- Always use `gh cli` to get information about issues / pull request etc..
- Always work in "klask-rs" directory for the new backend rewrite in Rust and "klask-react" for the new frontend in React
- Always use the workflow describe in command /explore-plan-code-test
- execute in background tasks the frontend and backend

## how to run backend
```
cd klask-rs && cargo run --bin klask-rs
```

## how to run frontend
```
cd klask-react && npm run dev
```

## the database
the database postgreSQl is already running in a docker container, open on the port 5432