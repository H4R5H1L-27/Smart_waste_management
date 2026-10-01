"""Route optimizer: optimized distance must be <= naive on several full-bin sets."""

from routing.optimizer import optimize_routes

DEPOT = {"lat": 13.0103, "lng": 80.2155}


def _bin(i, lat, lng, fill):
    return {
        "id": f"t-{i}",
        "name": f"test {i}",
        "lat": lat,
        "lng": lng,
        "fill_percent": fill,
        "is_real": False,
    }


def _assert_opt_le_naive(bins):
    result = optimize_routes(bins, DEPOT)
    opt = result["optimized"]["distance_km"]
    naive = result["naive"]["distance_km"]
    assert opt <= naive + 1e-6, f"optimized {opt} > naive {naive}"
    return result


def test_cluster_across_chennai():
    bins = [
        _bin(1, 13.0500, 80.2824, 91),
        _bin(2, 12.9249, 80.1270, 88),
        _bin(3, 13.0878, 80.2170, 77),
        _bin(4, 13.0002, 80.2667, 40),
    ]
    result = _assert_opt_le_naive(bins)
    assert result["full_count"] == 3
    assert result["optimized"]["order"]


def test_south_west_sweep():
    bins = [
        _bin(1, 12.9816, 80.2180, 95),
        _bin(2, 12.9249, 80.1270, 82),
        _bin(3, 13.0067, 80.2570, 71),
        _bin(4, 13.0724, 80.1948, 99),
        _bin(5, 13.0418, 80.2337, 10),
    ]
    _assert_opt_le_naive(bins)


def test_all_full_is_never_worse():
    bins = [
        _bin(1, 13.0500, 80.2824, 80),
        _bin(2, 13.0067, 80.2570, 81),
        _bin(3, 13.0878, 80.2170, 82),
        _bin(4, 12.9816, 80.2180, 83),
        _bin(5, 13.0336, 80.2690, 84),
        _bin(6, 13.0732, 80.2608, 85),
        _bin(7, 12.9249, 80.1270, 86),
        _bin(8, 13.0604, 80.2490, 87),
    ]
    _assert_opt_le_naive(bins)
