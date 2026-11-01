"""Framework consumers retain failed attempts and compare only explicit scored populations."""
from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('framework_summary', ROOT / 'docs/frameworks/04_scikit-learn/example.py')
SUMMARY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SUMMARY)


def score(value):
    return {'valid_for_scoring': value is not None, 'status': 'scored' if value is not None else 'rejected-transfer', 'rmse': value}


def folds():
    return [{'held_out': name, 'models': {'a': {'recovery_pct': score(a)}, 'b': {'recovery_pct': score(b)}}}
            for name, a, b in [('shared', 1.0, 2.0), ('a-only', 9.0, None), ('b-only', None, 100.0)]]


def test_conditional_means_and_common_cases_have_distinct_explicit_populations():
    records = folds()
    a, b = (SUMMARY.fold_summary(records, model) for model in ['a', 'b'])
    assert (a['attempted'], a['evaluated'], a['rejected'], a['mean']) == (3, 2, 1, 5.0)
    assert b['mean'] == 51.0
    assert a['rejected_folds'] == ['b-only'] and b['rejected_folds'] == ['a-only']
    shared = SUMMARY.common_folds(records, ['a', 'b'])
    assert shared == ['shared']
    assert [SUMMARY.fold_summary(records, model, shared)['mean'] for model in ['a', 'b']] == [1.0, 2.0]
    assert records[-1]['models']['a']['recovery_pct']['rmse'] is None


def test_all_rejected_or_empty_common_cohorts_have_no_mean():
    records = [{'held_out': 'failed', 'models': {'a': {'recovery_pct': score(None)}}}]
    summary = SUMMARY.fold_summary(records, 'a')
    assert (summary['attempted'], summary['evaluated'], summary['rejected'], summary['mean']) == (1, 0, 1, None)
    assert SUMMARY.common_folds(records, ['a']) == []
    assert SUMMARY.fold_summary(folds(), 'a', [])['mean'] is None
    assert SUMMARY.display_score(None) == 'unavailable'


@pytest.mark.parametrize('change', [
    {'valid_for_scoring': True, 'rmse': None},
    {'rmse': float('nan')},
    {'valid_for_scoring': False, 'status': 'rejected-transfer', 'rmse': 0.0},
])
def test_inconsistent_or_nonfinite_scores_fail_instead_of_being_dropped(change):
    records = folds()
    records[0]['models']['a']['recovery_pct'].update(change)
    with pytest.raises(ValueError, match='Invalid'):
        SUMMARY.fold_summary(records, 'a')


def test_common_cohort_cannot_reintroduce_a_rejected_case():
    with pytest.raises(ValueError, match='unavailable'):
        SUMMARY.fold_summary(folds(), 'a', ['b-only'])
