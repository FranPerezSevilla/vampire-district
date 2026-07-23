# itch.io build workflow

The repository includes a manual GitHub Actions workflow that packages any selected branch as one final itch.io-ready HTML game ZIP.

Workflow file:

```text
.github/workflows/build-itch-zip.yml
```

## Generate a build

1. Open the repository on GitHub.
2. Go to **Actions**.
3. Select **Build itch.io ZIP**.
4. Click **Run workflow**.
5. Choose the branch to package using GitHub's branch selector.
6. Optionally change the output name. The default is `vampire-district`.
7. Run the workflow and wait for it to finish.
8. Open the completed run and download the artifact from the **Artifacts** section.

The downloaded file itself is the final itch.io upload:

```text
vampire-district.zip
```

Do not extract and repackage it. Upload that ZIP directly to itch.io as an **HTML** project with **This file will be played in the browser** enabled.

## Package contract

The downloaded ZIP contains `index.html` directly at its root:

```text
vampire-district.zip
├── index.html
├── phaser/
├── assets/
└── ...
```

The workflow fails when `index.html` is not present at the package root.

The following development-only content is excluded:

- `.git`
- `.github`
- `node_modules`
- the temporary `itch-build` directory
- existing ZIP files
- common operating-system metadata files

## Why there is no nested ZIP

GitHub Actions always downloads an artifact as a ZIP archive. The workflow therefore uploads the prepared `itch-build` directory directly instead of first creating another ZIP. The artifact downloaded from GitHub is already the definitive package for itch.io.

## Branch behaviour

The workflow packages the branch selected in GitHub's **Run workflow** interface. This allows test builds to be generated from feature branches without merging them into `main`.

A generated artifact is retained for 14 days.

## Recommended release flow

```text
feature branch
→ run browser/regression checks
→ generate itch.io ZIP from that branch
→ download the final ZIP
→ smoke-test its contents locally
→ upload that same ZIP to the restricted itch.io playtest page
```

Do not rely on the GitHub Pages build through an iframe or redirect for formal playtests. A self-contained ZIP keeps the tested version stable and avoids external hosting, focus and fullscreen issues.
