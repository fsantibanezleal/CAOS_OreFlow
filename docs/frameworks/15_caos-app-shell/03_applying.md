# The CAOS app shell: applying it

Read order: [01 Installation](01_installation.md), [02 Usage](02_usage.md), **you are on 03**.

## Upgrading the pin

1. Read the shell's release notes and the shared defect register: a defect fixed in the new release
   means its override in OreFlow can go, and only then.
2. Change the tag in `frontend/package.json`, run `npm install`, commit `package-lock.json` with it.
3. Run the typecheck, the tests and the full browser matrix (`OF_MATRIX=full node gate.mjs`), and read
   the screenshots: a shell release changes every page at once.
4. Remove each override whose defect the release fixed, together with its comment, and run the gate
   again; the gate that checked the override now checks the shell.

## Finding a new shell defect

A defect in the shell is a defect in every app of the line. When one turns up:

1. **Record it in the shared register** (`conventions/shell-known-defects.md` in the management
   repository): the version, the symptom, the cause, the override and the gate, in that order.
2. **Override it in the product**, after the shell's stylesheet or around its component, with a comment
   that names the register entry.
3. **Write the gate** that fails without the override and passes with it, and check it both ways.
4. **Report it upstream** to the shell's repository, so a release can fix it for everyone.

## What not to do

- Do not rebuild a shell component inside the product because it is "almost right"; override the
  specific behaviour, or fix the shell.
- Do not raise an override's specificity to win: place it after the shell's stylesheet, and let order
  decide.
- Do not leave an override without its reason; the next person to tidy the file deletes it and the
  defect returns silently.
