from pipeline.io.contract import REQUIRED_COLUMNS, validate_rows


def good():
    return {"case_id": "c", "feed_tph": 640, "feed_grade_pct": .74, "feed_p80_um": 14000, "hardness_kwh_t": 12,
            "density_t_m3": 2.65, "grind_p80_um": 165, "classifier_cut_um": 125, "flotation_time_min": 18,
            "air_rate_m3_min": 2.4, "reagent_gpt": 145, "water_m3_t": 2.2}


def test_good_row_is_accepted():
    report = validate_rows([good()])
    assert report.ok and len(report.accepted) == 1 and not report.rejected
    assert set(good()) >= set(REQUIRED_COLUMNS)


def test_bad_rows_rejected_without_silent_coercion():
    rows = [good() | {"feed_tph": "nan"}, good() | {"feed_p80_um": 100, "grind_p80_um": 100}, good() | {"water_m3_t": -1}, {"case_id": "missing"}]
    report = validate_rows(rows)
    assert len(report.accepted) == 0
    assert len(report.rejected) == len(rows)
    assert all("reason" in row for row in report.rejected)


def test_review_flags_are_not_rejections():
    report = validate_rows([good() | {"feed_tph": 6000, "reagent_gpt": 1800}])
    assert report.ok and report.flagged and not report.rejected


def test_process_family_is_preserved_and_invalid_family_rejected():
    magnetic = validate_rows([good() | {"process_family": "magnetic"}])
    assert magnetic.ok and magnetic.accepted[0].process_family == "magnetic"
    invalid = validate_rows([good() | {"process_family": "unknown"}])
    assert not invalid.ok and "unsupported process_family" in invalid.rejected[0]["reason"]
