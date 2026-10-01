"""API contract smoke tests (no TensorFlow)."""


def test_list_bins_includes_real_and_sim(client):
    bins = client.get("/bins").json()
    ids = {b["id"] for b in bins}
    assert "gymd" in ids
    assert "ab1" in ids
    assert len(bins) >= 100


def test_sensor_update_roundtrip(client):
    r = client.post("/bins/gymd/update", json={"fill_percent": 64.2})
    assert r.json() == {"status": "ok"}
    got = client.get("/bins/gymd").json()
    assert got["fill_percent"] == 64.2
    assert got["is_real"] is True

    # Test backward compatibility alias
    r_alias = client.post("/bins/real-1/update", json={"fill_percent": 72.0})
    assert r_alias.json() == {"status": "ok"}
    got_alias = client.get("/bins/gymd").json()
    assert got_alias["fill_percent"] == 72.0


def test_optimize_route_shape(client):
    client.post("/bins/ab4/update", json={"fill_percent": 91})
    client.post("/bins/hstlB/update", json={"fill_percent": 88})
    client.post("/bins/hstlE/update", json={"fill_percent": 95})
    data = client.post("/optimize-route", json={}).json()
    assert "optimized" in data and "naive" in data
    assert data["optimized"]["distance_km"] <= data["naive"]["distance_km"] + 1e-6
    assert data["full_count"] >= 3


def test_report_and_analytics_endpoints(client):
    r = client.post("/reports", json={"bin_id": "ab1", "message": "Overflow at AB1 entrance"})
    assert r.status_code == 200
    rep_data = r.json()
    assert "recommended_action" in rep_data
    assert len(rep_data["recommended_action"].split()) <= 15
    reports = client.get("/reports").json()
    assert reports[0]["bin_id"] == "ab1"
    assert reports[0]["recommended_action"] != ""
    cats = client.get("/analytics/categories").json()
    assert isinstance(cats, list)
    preds = client.get("/analytics/predictions").json()
    assert any(p["id"] == "gymd" for p in preds)


def test_delete_report(client):
    r = client.post("/reports", json={"bin_id": "ab2", "message": "Bin lid broken"})
    report_id = r.json()["id"]
    del_res = client.delete(f"/reports/{report_id}")
    assert del_res.status_code == 200
    assert del_res.json()["deleted"] == report_id
    reports = client.get("/reports").json()
    assert not any(rep["id"] == report_id for rep in reports)


def test_samples_endpoints(client):
    samples = client.get("/samples").json()
    assert isinstance(samples, list)
    assert len(samples) >= 5
    sample_url = samples[0]["url"]
    res = client.get(sample_url)
    assert res.status_code == 200
    assert "image" in res.headers.get("content-type", "")


def test_simulation_endpoints(client):
    step_res = client.post("/simulate/step")
    assert step_res.status_code == 200
    assert "bins" in step_res.json()

    # Mark a bin as high fill and test collect
    client.post("/bins/ab3/update", json={"fill_percent": 85})
    collect_res = client.post("/simulate/collect?threshold=70")
    assert collect_res.status_code == 200
    data = collect_res.json()
    assert "collected_bins" in data
    assert "ab3" in data["collected_bins"]
    # Check bin is now emptied
    bin_row = client.get("/bins/ab3").json()
    assert bin_row["fill_percent"] <= 20.0


def test_optimize_route_custom_threshold(client):
    client.post("/simulate/collect?threshold=0")
    client.post("/bins/ab1/update", json={"fill_percent": 55})
    res_default = client.post("/optimize-route", json={"threshold": 70}).json()
    assert "ab1" not in res_default["optimized"]["order"]

    res_lower = client.post("/optimize-route", json={"threshold": 50}).json()
    assert "ab1" in res_lower["optimized"]["order"]


def test_classify_invalid_image(client):
    # Non-image content type
    res = client.post(
        "/classify",
        files={"file": ("test.txt", b"not an image", "text/plain")},
    )
    assert res.status_code == 400

    # Corrupt image bytes
    res_corrupt = client.post(
        "/classify",
        files={"file": ("corrupt.jpg", b"corrupted jpeg content", "image/jpeg")},
    )
    assert res_corrupt.status_code == 400
    assert "0x" not in res_corrupt.json()["detail"]  # No internal memory addresses leaked

    # Unsupported format (SVG)
    res_svg = client.post(
        "/classify",
        files={"file": ("test.svg", b"<svg><circle r='5'/></svg>", "image/svg+xml")},
    )
    assert res_svg.status_code == 400
    assert "SVG" in res_svg.json()["detail"]

    # Oversized file (>10MB)
    fake_huge = b"0" * (11 * 1024 * 1024)
    res_huge = client.post(
        "/classify",
        files={"file": ("huge.jpg", fake_huge, "image/jpeg")},
    )
    assert res_huge.status_code == 413


def test_optimize_route_zero_bins(client):
    client.post("/simulate/collect?threshold=0")
    res = client.post("/optimize-route", json={"threshold": 100.0}).json()
    assert res["full_count"] == 0
    assert "km_saved" in res
    assert res["km_saved"] == 0.0
    assert "threshold" in res
    assert res["threshold"] == 100.0
    assert res["optimized"]["geometry"] == []


def test_optimize_route_single_bin(client):
    # Empty all bins and set exactly one bin above threshold
    client.post("/simulate/collect?threshold=0")
    client.post("/bins/ab2/update", json={"fill_percent": 95})
    res = client.post("/optimize-route", json={"threshold": 70}).json()
    assert res["full_count"] == 1
    assert res["km_saved"] == 0.0
    assert len(res["optimized"]["stops"]) == 1
    assert len(res["naive"]["stops"]) == 1
    assert res["optimized"]["stops"][0]["id"] == "ab2"
    assert res["optimized"]["distance_km"] == res["naive"]["distance_km"]
    assert res["optimized"]["duration_min"] == res["naive"]["duration_min"]


def test_mobile_report_page(client):
    res = client.get("/report", follow_redirects=True)
    assert res.status_code == 200
    assert "Civic" in res.text


def test_multipart_report_submission(client):
    # 1x1 valid JPEG
    dummy_jpeg = (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c"
        b"\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c"
        b"\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00"
        b"\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01"
        b"\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05"
        b"\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
    )
    res = client.post(
        "/reports",
        data={"bin_id": "gymd", "message": "Plastic bottles overflowing", "lat": "12.8392", "lng": "80.1546"},
        files={"file": ("test.jpg", dummy_jpeg, "image/jpeg")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["bin_id"] == "gymd"
    assert "recommended_action" in data
    assert len(data["recommended_action"].split()) <= 15
    assert data["severity"] in ("low", "medium", "high")
    assert "/uploads/" in data["image_url"]
    assert "recommended_steps" in data
    assert isinstance(data["recommended_steps"], list)


def test_analyze_waste_endpoint(client):
    res = client.post("/api/analyze-waste", json={"category": "plastic", "message": "overflowing bottles"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["category"] == "plastic"
    assert data["severity"] in ("LOW", "MEDIUM", "HIGH")
    assert "description" in data
    assert "recommended_action" in data
    assert "recommended_steps" in data
    assert isinstance(data["recommended_steps"], list)
    assert len(data["recommended_steps"]) >= 3


def test_json_report_with_base64_image(client):
    # Base64 1x1 jpeg
    b64_dummy = (
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////"
        "////////////////////////////////////////////////////////////////////wgALCAAB"
        "AAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
    )
    res = client.post(
        "/reports",
        json={
            "bin_id": "ab1",
            "message": "Plastic bottles on walkway",
            "category": "plastic",
            "severity": "medium",
            "image_url": b64_dummy,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["bin_id"] == "ab1"
    assert "/uploads/" in data["image_url"]
    assert "recommended_steps" in data
    assert isinstance(data["recommended_steps"], list)
