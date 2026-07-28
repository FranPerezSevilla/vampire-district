from pathlib import Path
import shutil
import re

root = Path.cwd()
TEXT_EXTS = {'.js', '.mjs', '.md', '.html', '.yml', '.yaml', '.json', '.svg', '.css'}


def write(rel, content):
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')


def replace(rel, old, new, *, required=False):
    path = root / rel
    text = path.read_text(encoding='utf-8')
    if required and old not in text:
        raise RuntimeError(f'Missing expected text in {rel}: {old[:80]!r}')
    path.write_text(text.replace(old, new), encoding='utf-8')


# Remove the retired canvas prototype, unused raw asset sources, obsolete notes,
# one-off patch tools and their temporary workflows.
for directory in ['css', 'js', 'legacy', 'audio_raw']:
    path = root / directory
    if path.exists():
        shutil.rmtree(path)

for rel in [
    'TODO.md',
    'MILESTONE_10.md',
    'docs/INDEX_M10.md',
    'docs/phaser-migration-roadmap.md',
    'docs/phaser-functional-inventory.md',
    'docs/google-sheets-feedback.md',
    'docs/masquerade-systems-plan.md',
    'docs/playtest-checklist.md',
]:
    path = root / rel
    if path.exists():
        path.unlink()

workflow_dir = root / '.github/workflows'
for path in workflow_dir.glob('*'):
    if path.name not in {'tests.yml', 'build-itch-zip.yml', 'apply-viceblood-cleanup.yml'}:
        path.unlink()

for path in (root / 'tools').iterdir():
    if path.is_file():
        path.unlink()

# Canonical branding and stable content IDs. Compatibility/history files are
# overwritten below after this broad pass.
for path in root.rglob('*'):
    if not path.is_file() or path.suffix.lower() not in TEXT_EXTS:
        continue
    try:
        text = path.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        continue
    original = text
    for old, new in [
        ('VAMPIRE DISTRICT', 'VICEBLOOD'),
        ('BLACKGLASS DIRECTORATE', 'THE FIRST ESTATE'),
        ('RED ASSEMBLY', 'THE GUTTER CROWN'),
        ('Vampire District', 'Viceblood'),
        ('Night Blood District', 'Viceblood'),
        ('Bloodnight District', 'Viceblood'),
        ('bloodnight-', 'viceblood-'),
        ('The Blackglass Directorate', 'The First Estate'),
        ('Blackglass Directorate', 'The First Estate'),
        ('The Red Assembly', 'The Gutter Crown'),
        ('Red Assembly', 'The Gutter Crown'),
        ('The Unaligned Houses', 'The Houses'),
        ('Unaligned Houses', 'The Houses'),
        ('BLACKGLASS_DIRECTORATE', 'FIRST_ESTATE'),
        ('RED_ASSEMBLY', 'GUTTER_CROWN'),
        ('blackglass_directorate', 'first_estate'),
        ('red_assembly', 'gutter_crown'),
        ('directorate_cleaner', 'estate_cleaner'),
        ('directorate_van', 'estate_van'),
        ('Directorate van', 'Estate van'),
        ('Directorate cleaner', 'Estate cleaner'),
    ]:
        text = text.replace(old, new)
    text = re.sub(r'\bDirectorate\b', 'First Estate', text)
    text = re.sub(r'\bAssembly\b', 'Gutter Crown', text)
    text = re.sub(r'\bBlackglass\b', 'First Estate', text)
    if text != original:
        path.write_text(text, encoding='utf-8')

# Remove the original-prototype link from both playable routes.
for rel in ['index.html', 'phaser/index.html']:
    path = root / rel
    text = path.read_text(encoding='utf-8')
    text = re.sub(r'\n\s*<a class="legacy-link"[^\n]+</a>', '', text)
    path.write_text(text, encoding='utf-8')

# Remove styling that existed only for the deleted link.
path = root / 'phaser/styles.css'
text = path.read_text(encoding='utf-8')
text = re.sub(r'\n\.legacy-link \{.*?\n\}\n\n\.legacy-link:hover \{.*?\n\}\n', '\n', text, flags=re.S)
path.write_text(text, encoding='utf-8')

# Root documentation and historical wording.
replace('README.md',
        'The current public build is a **persistent free-roam systems sandbox** running City Topology V2: a `4800 × 3600` world with exactly five times the previous area. The repository keeps its historical `vampire-district` slug for compatibility, but the product name is now Viceblood.',
        'The current public build is a **persistent free-roam systems sandbox** running City Topology V2: a `4800 × 3600` world with exactly five times the previous area.')
replace('README.md', 'one authoritative 114-node / 158-edge road graph', 'one authoritative 107-node / 148-edge road graph')
replace('CHANGELOG.md', 'Initial repo setup for the single-file vampire district prototype.', 'Initial repository setup for the single-file browser prototype.')
replace('CHANGELOG.md', '- Top-down vampire district sandbox.', '- Top-down urban vampire sandbox.')

# Documentation now records the physical cleanup and current system boundaries.
replace('docs/MILESTONE_10_STATUS.md',
'''Several superseded prototype source files remain as unloaded historical implementation files. The playable HTML no longer imports them and source-ownership tests protect that fact. Physical deletion will occur after manual acceptance, followed by one final CI run.''',
'''The superseded canvas prototype, its root `css/` and `js/` trees, and the one-off patch workflows were physically removed after Phaser acceptance. Source-ownership tests protect the active runtime from reintroducing that parallel stack.''')
replace('docs/README.md', '# Vampire District documentation', '# Viceblood documentation')
replace('docs/README.md',
        '- [Damageable props](PROP_SYSTEM.md) — streetlights, darkness, reactions and events.',
        '- [Historical damageable-props experiment](PROP_SYSTEM.md) — retired streetlight/darkness implementation record.')

path = root / 'docs/ROADMAP.md'
text = path.read_text(encoding='utf-8')
text = text.replace('''## Milestone 6 — Damageable streetlights and world props

**Status: ✅ Complete**

- combat-language prop destruction;
- broken lights remove illumination and persist;
- sight/hearing reactions and prop events.''', '''## Milestone 6 — Historical light and prop experiment

**Status: ◈ Streetlight/darkness mechanics retired**

The original destructible-light experiment informed combat-language props and perception reactions. Streetlight rendering, lamp damage and darkness-based visibility are no longer production systems.''')
text = text.replace('Milestone 15 replaces the all-owned prototype', 'Milestone 16 replaces the all-owned prototype')
text = text.replace('- destructible streetlights/dumpsters;', '- vehicle interaction with bounded street furniture;')
text = text.replace('- post-layout streetlights clear of roads, crossings and buildings;', '- street furniture anchored clear of roads, crossings and buildings;')
text = text.replace('- lamps sit on valid sidewalk/frontage anchors;', '- street furniture sits on valid sidewalk/frontage anchors;')
text = text.replace('- separate Unaligned House/contact records;', '- separate independent House/contact records;')
path.write_text(text, encoding='utf-8')

path = root / 'docs/ORIGINAL_SETTING_FACTIONS_RETAINERS_ECONOMY.md'
text = path.read_text(encoding='utf-8')
text = text.replace('### The First Estate\n\n**Systemic role:** secretive ruling establishment.\n\nThe First Estate is not a royal court or religious sect. It is an old administrative machine that treats secrecy as infrastructure. Its members hold property, hospitals, private security, municipal contracts, press influence and compromised police contacts.', '''### The First Estate

**Systemic role:** old institutional elite.

The First Estate is not a royal court, corporation or religious sect. It is a network of inherited property, civic influence and carefully maintained obligations. Its members hold hospitals, private security, municipal contracts, press influence and compromised police contacts.''')
text = text.replace('- Directors control portfolios rather than hereditary titles;', '- Stewards control portfolios rather than fantasy court titles;')
text = text.replace('''- black glass, smoked chrome and muted violet;
- tailored coats and practical security uniforms;
- unmarked sedans;
- clean modernist interiors hiding old basements;
- geometric insignia based on a fractured black pane.''', '''- bone white, smoked silver, deep burgundy and old stone;
- tailored coats and practical security uniforms;
- understated official sedans;
- restored civic interiors hiding older service spaces;
- a narrow shield-and-key seal used on documents, doors and discreet vehicle marks.''')
text = text.replace('- symbols based on several hands forming one broken circle.', '- crude crown marks assembled from three broken strokes, easy to paint on walls and vehicles.')
text = text.replace('The Houses are a category used by the First Estate, not a single faction.', 'The Houses is a presentation label, not a single faction.')
text = text.replace('The Houses are a presentation category, not a single faction. It includes old bloodlines, smugglers, information brokers, mercenaries, isolated sires, criminal families and individual vampires who refuse permanent allegiance.', 'The Houses is a presentation label, not a single faction. The label covers old bloodlines, smugglers, information brokers, mercenaries, isolated sires, criminal families and individual vampires who refuse permanent allegiance.')
text = text.replace('Their shared identifier is absence of First Estate or Gutter Crown markings, not one universal uniform.', 'Their shared identifier is the absence of First Estate or Gutter Crown markings, not one universal uniform.')
text = text.replace('- The Houses are simulated separately, not as one monolithic faction.', '- Every House is simulated separately, not as one monolithic faction.')
path.write_text(text, encoding='utf-8')

# Campaign docs explain the one-time storage-key migration rather than claiming
# that the old key remains authoritative.
path = root / 'docs/CAMPAIGN_FOUNDATION.md'
text = path.read_text(encoding='utf-8')
for old_block in [
    """Storage key remains:\n\n```text\nvampire-district-campaign-v1\n```\n\nKeeping the key allows version-one saves to migrate in place. The stored schema version is `2`.""",
    """Storage key remains:\n\n```text\nviceblood-campaign-v1\n```\n\nKeeping the key allows version-one saves to migrate in place. The stored schema version is `2`."""
]:
    text = text.replace(old_block, """Current storage key:\n\n```text\nviceblood-campaign-v1\n```\n\nThe historical `vampire-district-campaign-v1` key is read only as a one-time compatibility alias. A valid old save is rewritten to the Viceblood key and the retired key is removed. The stored schema version remains `2`.""")
path.write_text(text, encoding='utf-8')

# The itch package contains only the current app and exact pinned Phaser file.
write('.github/workflows/build-itch-zip.yml', '''name: Build itch.io ZIP

on:
  workflow_dispatch:
    inputs:
      zip_name:
        description: ZIP file name (without .zip)
        required: true
        default: viceblood
        type: string

jobs:
  build-zip:
    name: Package selected branch
    runs-on: ubuntu-latest

    steps:
      - name: Checkout selected branch
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install pinned Phaser
        run: npm install --ignore-scripts --no-audit --no-fund --no-package-lock

      - name: Validate output name
        shell: bash
        env:
          ZIP_NAME: ${{ inputs.zip_name }}
        run: |
          set -euo pipefail

          if [[ ! "$ZIP_NAME" =~ ^[A-Za-z0-9._-]+$ ]]; then
            echo 'Error: zip_name may only contain letters, numbers, dots, underscores and hyphens.'
            exit 1
          fi

      - name: Prepare itch.io build
        shell: bash
