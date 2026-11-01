"""External storage and measured-entrypoint regression tests; no network or fitting."""
from __future__ import annotations

import hashlib
import importlib
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(autouse=True)
def no_default_roots(monkeypatch):
    monkeypatch.delenv("CAOS_DATA_ROOT", raising=False)
    monkeypatch.delenv("CAOS_MODELS_ROOT", raising=False)


def test_unset_roots_fail_before_network(monkeypatch):
    import run_geomet
    import run_iron_plant

    for lane, function in ((run_geomet, "source_bytes"), (run_iron_plant, "source_archive")):
        # Existing cached checkout data must not hide absent external-root configuration.
        monkeypatch.setattr(lane, "urlopen", lambda *a, **k: pytest.fail("unexpected download"))
        with pytest.raises(ValueError, match="CAOS_DATA_ROOT"):
            getattr(lane, function)()


def test_external_roots_resolve_at_call_time_and_accept_spaces(tmp_path, monkeypatch):
    from pipeline.io.storage import checkpoint_path, raw_directory

    for name in ("first root", "second root"):
        monkeypatch.setenv("CAOS_DATA_ROOT", str(tmp_path / name))
        monkeypatch.setenv("CAOS_MODELS_ROOT", str(tmp_path / name))
        assert raw_directory() == tmp_path / name / "oreflow" / "raw"
        assert checkpoint_path("geomet_lct.joblib") == tmp_path / name / "oreflow" / "geomet_lct.joblib"
    assert not (tmp_path / "first root").exists()


@pytest.mark.parametrize("relative", [".", "data/raw", "models", "new directory"])
def test_checkout_roots_and_checkpoints_are_rejected(relative):
    from pipeline.io.storage import checkpoint_path, raw_directory

    with pytest.raises(ValueError, match="outside"):
        raw_directory(ROOT / relative)
    with pytest.raises(ValueError, match="outside"):
        checkpoint_path("geomet_lct.joblib", path=ROOT / relative / "file.joblib")


def test_explicit_sources_are_read_only_and_hash_checked(tmp_path, monkeypatch):
    import run_geomet
    import run_iron_plant

    source = tmp_path / "explicit source.csv"
    source.write_bytes(b"verified input")
    monkeypatch.setattr(run_geomet, "SOURCE_MD5", hashlib.md5(source.read_bytes()).hexdigest())
    monkeypatch.setattr(run_geomet, "urlopen", lambda *a, **k: pytest.fail("unexpected download"))
    assert run_geomet.source_bytes(source) == b"verified input"
    before = source.stat().st_mtime_ns
    monkeypatch.setattr(run_iron_plant, "SOURCE_SHA256", hashlib.sha256(source.read_bytes()).hexdigest())
    assert run_iron_plant.source_archive(source)[0] == source
    assert source.stat().st_mtime_ns == before
    source.write_bytes(b"drift")
    with pytest.raises(ValueError, match="checksum drift"):
        run_geomet.source_bytes(source)
    with pytest.raises(ValueError, match="checksum drift"):
        run_iron_plant.source_archive(source)
    missing = tmp_path / "missing source.csv"
    with pytest.raises(FileNotFoundError):
        run_geomet.source_bytes(missing)
    assert not missing.exists()


def test_particle_import_has_no_training_side_effects(monkeypatch):
    from pipeline.stages import particle_experiment, preprocess

    monkeypatch.setattr(preprocess, "run", lambda *a, **k: pytest.fail("preprocess during import"))
    monkeypatch.setattr(particle_experiment, "run", lambda *a, **k: pytest.fail("training during import"))
    importlib.import_module("run_particles")

@pytest.mark.parametrize('lane_name,reader,filename,pin,algorithm', [
    ('run_geomet', 'source_bytes', 'geomet-flotation.csv', 'SOURCE_MD5', 'md5'),
    ('run_iron_plant', 'source_archive', 'iron-flotation-kaggle-v1.zip', 'SOURCE_SHA256', 'sha256'),
])
def test_cache_downloads_only_to_external_root_and_refuses_drift(tmp_path, monkeypatch, lane_name, reader, filename, pin, algorithm):
    import io

    lane = importlib.import_module(lane_name)
    content = b'pinned test payload'
    monkeypatch.setattr(lane, pin, hashlib.new(algorithm, content).hexdigest())
    calls = []

    def download(*args, **kwargs):
        calls.append(args)
        return io.BytesIO(content)

    monkeypatch.setattr(lane, 'urlopen', download)
    monkeypatch.setenv('CAOS_DATA_ROOT', str(tmp_path / 'data root with spaces'))
    path = tmp_path / 'data root with spaces' / 'oreflow' / 'raw' / filename
    getattr(lane, reader)()
    assert path.read_bytes() == content
    getattr(lane, reader)()
    assert len(calls) == 1
    path.write_bytes(b'changed locally')
    with pytest.raises(ValueError, match='checksum drift'):
        getattr(lane, reader)()
    assert path.read_bytes() == b'changed locally'
    assert len(calls) == 1
    path.unlink()
    monkeypatch.setattr(lane, 'urlopen', lambda *a, **k: io.BytesIO(b'bad download'))
    with pytest.raises(ValueError, match='checksum drift'):
        getattr(lane, reader)()
    assert not path.exists()


def test_fetcher_verifies_before_creating_files_and_never_overwrites(tmp_path, monkeypatch):
    import fetch

    content = b'measured fixture'
    monkeypatch.setattr(fetch, 'SOURCES', {'hzdr': [('input.bin', 'https://unused.invalid', 'sha256', hashlib.sha256(content).hexdigest())]})
    monkeypatch.setattr(fetch, '_download', lambda *a: b'drift')
    with pytest.raises(ValueError, match='checksum drift'):
        fetch.fetch('hzdr', tmp_path)
    assert not (tmp_path / 'oreflow').exists()
    monkeypatch.setattr(fetch, '_download', lambda *a: content)
    path, = fetch.fetch('hzdr', tmp_path)
    assert path.read_bytes() == content
    monkeypatch.setattr(fetch, '_download', lambda *a: pytest.fail('cached input redownloaded'))
    assert fetch.fetch('hzdr', tmp_path) == [path]
    path.write_bytes(b'drift')
    with pytest.raises(ValueError, match='checksum drift'):
        fetch.fetch('hzdr', tmp_path)
    assert path.read_bytes() == b'drift'


def test_checkpoint_config_precedes_any_fit_or_source_download(tmp_path, monkeypatch):
    import run_geomet

    monkeypatch.setattr(run_geomet, 'source_bytes', lambda *a, **k: pytest.fail('source before root validation'))
    with pytest.raises(ValueError, match='CAOS_MODELS_ROOT'):
        run_geomet.fit_checkpoint()
    with pytest.raises(ValueError, match='outside'):
        run_geomet.fit_checkpoint(checkpoint_path=ROOT / 'models' / 'forbidden.joblib')


def test_particle_lane_routes_weights_externally_and_only_exports_onnx(tmp_path, monkeypatch):
    import run_particles

    source = tmp_path / run_particles.HZDR_FILE
    source.write_bytes(b'HZDR test fixture')
    monkeypatch.setattr(run_particles, 'HZDR_SHA256', hashlib.sha256(source.read_bytes()).hexdigest())
    monkeypatch.setattr(run_particles.preprocess, 'run', lambda *a, **k: {})
    calls = []

    def train(raw_file, output, model_dir):
        calls.append((raw_file, output, model_dir))
        model_dir.mkdir(parents=True)
        (model_dir / 'particle_mlp.pt').write_bytes(b'private weights')
        (model_dir / 'particle_mlp.onnx').write_bytes(b'browser export')
        return {'protocol': {}}

    monkeypatch.setattr(run_particles, 'run', train)
    with pytest.raises(ValueError, match='CAOS_MODELS_ROOT'):
        run_particles.build(source, tmp_path / 'derived')
    assert calls == []
    exported = tmp_path / 'browser' / 'particle_mlp.onnx'
    models_root = tmp_path / 'model root with spaces'
    run_particles.build(source, tmp_path / 'derived', models_root, onnx_output=exported)
    assert calls[0][2] == models_root / 'oreflow'
    assert exported.read_bytes() == b'browser export'
    assert not (exported.parent / 'particle_mlp.pt').exists()
    assert source.read_bytes() == b'HZDR test fixture'


@pytest.mark.parametrize('shell', ['powershell', 'bash'])
def test_dev_wrapper_provisions_then_launches_and_propagates_failures(tmp_path, shell):
    import os
    import shutil
    import subprocess

    sandbox = tmp_path / 'checkout with spaces'
    scripts = sandbox / 'scripts'
    frontend = sandbox / 'frontend'
    commands = tmp_path / 'fake npm with spaces'
    scripts.mkdir(parents=True)
    frontend.mkdir()
    commands.mkdir()
    (frontend / 'package-lock.json').write_text('{}', encoding='utf-8')
    log = tmp_path / 'npm calls.txt'
    env = {**os.environ, 'PATH': str(commands) + os.pathsep + os.environ['PATH'], 'DEV_CALL_LOG': str(log)}
    if shell == 'powershell':
        executable = shutil.which('pwsh')
        if executable is None:
            pytest.skip('PowerShell unavailable')
        suffix = '.ps1'
        # Native shim records argv, simulates dependency provisioning and never starts a server.
        (commands / 'npm.cmd').write_text(
            '@echo off\n'
            'echo %*>>"%DEV_CALL_LOG%"\n'
            'if "%FAKE_NPM_FAIL%"=="%1" exit /b 23\n'
            'if "%1"=="ci" (\n'
            '  if not exist "node_modules\\.bin" mkdir "node_modules\\.bin"\n'
            '  type nul > "node_modules\\.bin\\vite.cmd"\n'
            '  type nul > "node_modules\\.package-lock.json"\n'
            ')\nexit /b 0\n', encoding='utf-8')
        command = [executable, '-NoProfile', '-File', str(scripts / 'dev.ps1')]
    else:
        executable = shutil.which('bash')
        if os.name == 'nt':
            executable = str(Path(os.environ.get('ProgramFiles', 'C:/Program Files')) / 'Git' / 'bin' / 'bash.exe')
        if not executable or not Path(executable).is_file():
            pytest.skip('Bash unavailable')
        suffix = '.sh'
        stub = commands / 'npm'
        stub.write_text(
            '#!/usr/bin/env bash\nset -eu\nprintf "%s\\n" "$*" >> "$DEV_CALL_LOG"\n'
            'if [ "${FAKE_NPM_FAIL:-}" = "$1" ]; then exit 23; fi\n'
            'if [ "$1" = ci ]; then mkdir -p node_modules/.bin; touch node_modules/.bin/vite node_modules/.package-lock.json; fi\n',
            encoding='utf-8', newline='\n')
        stub.chmod(0o755)
        command = [executable, str(scripts / 'dev.sh')]
    shutil.copyfile(ROOT / 'scripts' / f'dev{suffix}', scripts / f'dev{suffix}')

    def launch(extra_env=None):
        return subprocess.run(command + ['--host', '127.0.0.1'], cwd=tmp_path, env={**env, **(extra_env or {})},
                              capture_output=True, text=True, timeout=40)

    stamp = frontend / 'node_modules' / '.oreflow-package-lock.sha256'

    def fingerprint():
        return hashlib.sha256((frontend / 'package-lock.json').read_bytes()).hexdigest()

    first = launch()
    assert first.returncode == 0, first.stdout + first.stderr
    assert log.read_text().splitlines() == ['ci --no-audit --no-fund', 'run dev -- --host 127.0.0.1']
    assert stamp.read_text().strip() == fingerprint()
    assert launch().returncode == 0
    assert len(log.read_text().splitlines()) == 3  # matching fingerprint skips ci

    # Vite and npm's internal lock remain present while the committed lock changes.
    previous_stamp = stamp.read_bytes()
    (frontend / 'package-lock.json').write_text('{"lockfileVersion":3}', encoding='utf-8')
    before = len(log.read_text().splitlines())
    failed_stale = launch({'FAKE_NPM_FAIL': 'ci'})
    assert failed_stale.returncode != 0  # a stale lock must invoke ci and propagate failure
    assert log.read_text().splitlines()[before:] == ['ci --no-audit --no-fund']
    assert stamp.read_bytes() == previous_stamp  # failed ci cannot certify the new lock
    recovered = launch()
    assert recovered.returncode == 0, recovered.stdout + recovered.stderr
    assert log.read_text().splitlines()[before + 1:] == ['ci --no-audit --no-fund', 'run dev -- --host 127.0.0.1']
    assert stamp.read_text().strip() == fingerprint()

    # An install made by another command has Vite/internal lock but no wrapper stamp.
    stamp.unlink()
    before = len(log.read_text().splitlines())
    failed_unstamped = launch({'FAKE_NPM_FAIL': 'ci'})
    assert failed_unstamped.returncode != 0
    assert not stamp.exists()
    assert log.read_text().splitlines()[before:] == ['ci --no-audit --no-fund']
    assert launch().returncode == 0
    assert stamp.read_text().strip() == fingerprint()
    assert log.read_text().splitlines()[before + 1:] == ['ci --no-audit --no-fund', 'run dev -- --host 127.0.0.1']
    before = len(log.read_text().splitlines())
    assert launch().returncode == 0
    assert log.read_text().splitlines()[before:] == ['run dev -- --host 127.0.0.1']

    stamp.write_text('', encoding='ascii')
    before = len(log.read_text().splitlines())
    assert launch().returncode == 0
    assert log.read_text().splitlines()[before:] == ['ci --no-audit --no-fund', 'run dev -- --host 127.0.0.1']
    assert stamp.read_text().strip() == fingerprint()

    failed_server = launch({'FAKE_NPM_FAIL': 'run'})
    assert failed_server.returncode != 0
    assert stamp.read_text().strip() == fingerprint()
    shutil.rmtree(frontend / 'node_modules')
    before = len(log.read_text().splitlines())
    failed_install = launch({'FAKE_NPM_FAIL': 'ci'})
    assert failed_install.returncode != 0
    assert not stamp.exists()  # a first failed install cannot leave a valid stamp
    assert len(log.read_text().splitlines()) == before + 1  # failed ci never launches
    (frontend / 'package-lock.json').unlink()
    assert launch().returncode != 0
    assert len(log.read_text().splitlines()) == before + 1  # missing lockfile never invokes npm



def test_legacy_checkout_source_is_read_only_but_never_a_cache():
    from pipeline.io.storage import raw_directory, source_path

    existing = ROOT / 'data' / 'examples' / 'geomet-assays.csv'
    before = existing.stat().st_mtime_ns
    assert source_path('unused.csv', existing) == existing.resolve()
    assert existing.stat().st_mtime_ns == before
    with pytest.raises(ValueError, match='outside'):
        raw_directory(existing.parent)


def test_resolved_symlink_into_checkout_cannot_be_a_root(tmp_path):
    from pipeline.io.storage import checkpoint_directory, raw_directory

    link = tmp_path / 'checkout alias'
    try:
        link.symlink_to(ROOT, target_is_directory=True)
    except OSError:
        pytest.skip('Creating directory symlinks is unavailable on this host')
    with pytest.raises(ValueError, match='outside'):
        raw_directory(link / 'data')
    with pytest.raises(ValueError, match='outside'):
        checkpoint_directory(link / 'models')


def test_real_samples_unset_root_never_uses_checkout_or_network(monkeypatch):
    from pipeline.cases import real_samples

    monkeypatch.setattr(real_samples, 'urlopen', lambda *a, **k: pytest.fail('unconfigured download'))
    with pytest.raises(ValueError, match='CAOS_DATA_ROOT'):
        real_samples.source_bytes('flotation')


@pytest.mark.parametrize('algorithm', ['md5', 'sha256'])
def test_real_samples_external_cache_checks_both_pins_before_write(tmp_path, monkeypatch, algorithm):
    import io
    from pipeline.cases import real_samples

    content = b'pinned GeoMet fixture'
    pin = {'file': 'test.csv', 'url': 'https://unused.invalid',
           'md5': hashlib.md5(content).hexdigest(), 'sha256': hashlib.sha256(content).hexdigest()}
    monkeypatch.setitem(real_samples.SOURCES, 'fixture', pin)
    monkeypatch.setattr(real_samples, 'urlopen', lambda *a, **k: io.BytesIO(content))
    monkeypatch.setenv('CAOS_DATA_ROOT', str(tmp_path / 'data root with spaces'))
    path = tmp_path / 'data root with spaces' / 'oreflow' / 'raw' / 'test.csv'
    assert real_samples.source_bytes('fixture') == content
    assert path.read_bytes() == content
    monkeypatch.setattr(real_samples, 'urlopen', lambda *a, **k: pytest.fail('cached input redownloaded'))
    assert real_samples.source_bytes('fixture') == content
    # Each pin must reject independently; a matching other digest is insufficient.
    monkeypatch.setitem(pin, algorithm, '0' * len(pin[algorithm]))
    with pytest.raises(ValueError, match='pinned checksums'):
        real_samples.source_bytes('fixture')
    assert path.read_bytes() == content
    path.unlink()
    monkeypatch.setattr(real_samples, 'urlopen', lambda *a, **k: io.BytesIO(content))
    with pytest.raises(ValueError, match='pinned checksums'):
        real_samples.source_bytes('fixture')
    assert not path.exists()


def test_real_samples_explicit_raw_compatibility_and_readonly_checkout(monkeypatch, tmp_path):
    import io
    from pipeline.cases import real_samples

    content = b'Cu ppm\n5000\n'
    pin = {'file': 'geomet-assays.csv', 'url': 'https://unused.invalid',
           'md5': hashlib.md5(content).hexdigest(), 'sha256': hashlib.sha256(content).hexdigest()}
    existing = ROOT / 'data' / 'examples' / pin['file']
    actual = existing.read_bytes()
    monkeypatch.setitem(real_samples.SOURCES, 'explicit', {**pin, 'md5': hashlib.md5(actual).hexdigest(),
                                                         'sha256': hashlib.sha256(actual).hexdigest()})
    monkeypatch.setattr(real_samples, 'urlopen', lambda *a, **k: pytest.fail('explicit file downloaded'))
    before = existing.stat().st_mtime_ns
    assert real_samples.source_bytes('explicit', raw=existing.parent) == actual
    assert existing.stat().st_mtime_ns == before
    monkeypatch.setitem(real_samples.SOURCES, 'missing', {**pin, 'file': '__missing_readonly_geomet__.csv'})
    with pytest.raises(ValueError, match='outside'):
        real_samples.source_bytes('missing', raw=existing.parent)
    assert not (existing.parent / '__missing_readonly_geomet__.csv').exists()
    # Existing raw=Path callers can also populate an explicitly external cache.
    monkeypatch.setattr(real_samples, 'urlopen', lambda *a, **k: io.BytesIO(content))
    monkeypatch.setitem(real_samples.SOURCES, 'external', pin)
    assert real_samples.source_bytes('external', raw=tmp_path / 'explicit cache') == content
    assert (tmp_path / 'explicit cache' / pin['file']).read_bytes() == content


def test_real_samples_resolves_environment_again_after_import(tmp_path, monkeypatch):
    from pipeline.cases import real_samples

    content = b'call-time cache fixture'
    pin = {'file': 'fixture.csv', 'url': 'https://unused.invalid',
           'md5': hashlib.md5(content).hexdigest(), 'sha256': hashlib.sha256(content).hexdigest()}
    monkeypatch.setitem(real_samples.SOURCES, 'dynamic', pin)
    monkeypatch.setattr(real_samples, 'urlopen', lambda *a, **k: pytest.fail('stale root triggered download'))
    for label in ('first data root', 'second data root'):
        root = tmp_path / label
        path = root / 'oreflow' / 'raw' / pin['file']
        path.parent.mkdir(parents=True)
        path.write_bytes(content)
        monkeypatch.setenv('CAOS_DATA_ROOT', str(root))
        assert real_samples.source_bytes('dynamic') == content
        path.unlink()
