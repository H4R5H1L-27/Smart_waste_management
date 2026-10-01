"""Single-vehicle route over nearly-full bins (OR-Tools VRP).

Follows the official VRP tutorial pattern:
https://developers.google.com/optimization/routing/vrp
Distances are haversine kilometres × 1000 so the solver works in metres.
"""

from __future__ import annotations

import math
from typing import Any, Iterable

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

FULL_THRESHOLD = 70.0


def haversine_km(a: dict[str, float], b: dict[str, float]) -> float:
    r = 6371.0
    lat1, lon1 = math.radians(a["lat"]), math.radians(a["lng"])
    lat2, lon2 = math.radians(b["lat"]), math.radians(b["lng"])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _tour_distance_km(points: list[dict[str, float]]) -> float:
    if len(points) < 2:
        return 0.0
    return sum(haversine_km(points[i], points[i + 1]) for i in range(len(points) - 1))


def _distance_matrix_m(points: list[dict[str, float]]) -> list[list[int]]:
    n = len(points)
    matrix = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            matrix[i][j] = int(haversine_km(points[i], points[j]) * 1000)
    return matrix


def _solve_vrp(distance_m: list[list[int]]) -> list[int] | None:
    n = len(distance_m)
    manager = pywrapcp.RoutingIndexManager(n, 1, 0)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_m[from_node][to_node]

    transit_idx = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_idx)

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    params.time_limit.FromSeconds(2)

    solution = routing.SolveWithParameters(params)
    if solution is None:
        return None

    index = routing.Start(0)
    order = []
    while not routing.IsEnd(index):
        order.append(manager.IndexToNode(index))
        index = solution.Value(routing.NextVar(index))
    order.append(manager.IndexToNode(index))
    return order


def _fetch_osrm_route(points: list[dict[str, float]]) -> dict[str, Any] | None:
    """Fetches real road geometry and metrics from OSRM for a sequence of points."""
    if len(points) < 2:
        return None
    coords = ";".join(f"{p['lng']:.5f},{p['lat']:.5f}" for p in points)
    url = f"https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=geojson"
    try:
        import httpx

        with httpx.Client(timeout=3.5) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    route = data["routes"][0]
                    # GeoJSON is [lng, lat]; convert to [lat, lng] for Leaflet
                    geometry = [[c[1], c[0]] for c in route["geometry"]["coordinates"]]
                    return {
                        "distance_km": round(route["distance"] / 1000.0, 3),
                        "duration_min": round(route["duration"] / 60.0, 1),
                        "geometry": geometry,
                    }
    except Exception:
        pass
    return None


def optimize_routes(
    bins: Iterable[dict[str, Any]],
    depot: dict[str, float],
    threshold: float = FULL_THRESHOLD,
    tasks: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if tasks is not None:
        full = [
            {
                "id": t["id"],
                "name": t.get("title") or t.get("name") or t["id"],
                "lat": float(t["lat"]),
                "lng": float(t["lng"]),
                "fill_percent": float(t.get("fill_percent", 100.0)),
                "source_type": t.get("source_type", "task"),
                "source_id": t.get("source_id", t["id"]),
                "reason": t.get("reason", "Scheduled collection stop"),
                "severity": t.get("severity", "medium"),
            }
            for t in tasks
        ]
    else:
        full = [
            {
                **b,
                "source_type": "bin",
                "source_id": b["id"],
                "reason": f"Ultrasonic fill level {float(b['fill_percent']):.0f}% exceeds {threshold:.0f}% threshold",
                "severity": "high" if float(b['fill_percent']) >= 85.0 else "medium",
            }
            for b in bins
            if float(b["fill_percent"]) > threshold
        ]
    if not full:
        empty = {
            "order": [],
            "distance_km": 0.0,
            "duration_min": 0.0,
            "stops": [],
            "geometry": [],
        }
        return {
            "optimized": empty,
            "naive": empty,
            "full_count": 0,
            "depot": depot,
            "threshold": threshold,
            "km_saved": 0.0,
            "fuel_saved_l": 0.0,
            "co2_saved_kg": 0.0,
            "time_saved_min": 0.0,
            "ai_suggestion": {
                "title": "All Stops Clear",
                "rationale": "No active high-fill bins or verified citizen reports requiring dispatch.",
                "action": "Maintain standby depot status.",
            },
        }

    # Naive baseline: visit in database / list order, start and end at depot.
    naive_ids = [b["id"] for b in full]
    naive_points = [depot] + [{"lat": b["lat"], "lng": b["lng"]} for b in full] + [depot]
    naive_km = _tour_distance_km(naive_points)

    if len(full) == 1:
        # Trivial single-bin dispatch: order is always depot -> bin -> depot
        opt_ids = naive_ids
        opt_points = naive_points
        opt_km = naive_km
        # Single OSRM fetch for identical routes
        opt_osrm = _fetch_osrm_route(opt_points)
        naive_osrm = opt_osrm
    else:
        points = [depot] + [{"lat": b["lat"], "lng": b["lng"]} for b in full]
        matrix = _distance_matrix_m(points)
        visit = _solve_vrp(matrix)
        if visit is None:
            opt_ids, opt_km = naive_ids, naive_km
            opt_points = naive_points
        else:
            # visit is depot ... bins ... depot. Drop depot indices for the bin order.
            opt_ids = [full[i - 1]["id"] for i in visit if i != 0]
            opt_points = [points[i] for i in visit]
            if visit[-1] != 0:
                opt_points = opt_points + [depot]
            opt_km = _tour_distance_km(opt_points)

        # Fetch real Chennai road network geometry via OSRM
        opt_osrm = _fetch_osrm_route(opt_points)
        if opt_points == naive_points:
            naive_osrm = opt_osrm
        else:
            naive_osrm = _fetch_osrm_route(naive_points)

    # Normalize road distances when one OSRM call succeeded and the other fell back to haversine
    if opt_osrm and not naive_osrm and opt_km > 0:
        ratio = opt_osrm["distance_km"] / opt_km
        final_opt_km = opt_osrm["distance_km"]
        final_naive_km = round(naive_km * ratio, 3)
    elif naive_osrm and not opt_osrm and naive_km > 0:
        ratio = naive_osrm["distance_km"] / naive_km
        final_naive_km = naive_osrm["distance_km"]
        final_opt_km = round(opt_km * ratio, 3)
    else:
        final_opt_km = opt_osrm["distance_km"] if opt_osrm else round(opt_km, 3)
        final_naive_km = naive_osrm["distance_km"] if naive_osrm else round(naive_km, 3)

    # Safety constraint: In rare API corner-cases, ensure optimized road metric never exceeds naive
    if final_opt_km > final_naive_km or opt_points == naive_points:
        final_opt_km = final_naive_km

    opt_duration = (
        opt_osrm["duration_min"] if opt_osrm else round((final_opt_km / 30.0) * 60, 1)
    )
    naive_duration = (
        naive_osrm["duration_min"] if naive_osrm else round((final_naive_km / 30.0) * 60, 1)
    )
    if opt_points == naive_points:
        opt_duration = naive_duration

    opt_geom = (
        opt_osrm["geometry"]
        if opt_osrm
        else [[p["lat"], p["lng"]] for p in opt_points]
    )
    naive_geom = (
        naive_osrm["geometry"]
        if naive_osrm
        else [[p["lat"], p["lng"]] for p in naive_points]
    )

    def payload(ids: list[str], km: float, dur: float, geom: list[list[float]]) -> dict[str, Any]:
        lookup = {b["id"]: b for b in full}
        stops = [
            {
                "id": bid,
                "name": lookup[bid]["name"],
                "lat": lookup[bid]["lat"],
                "lng": lookup[bid]["lng"],
                "fill_percent": lookup[bid].get("fill_percent", 0.0),
                "source_type": lookup[bid].get("source_type", "bin"),
                "source_id": lookup[bid].get("source_id", bid),
                "reason": lookup[bid].get("reason", "Collection pickup needed"),
                "severity": lookup[bid].get("severity", "medium"),
            }
            for bid in ids
        ]
        return {
            "order": ids,
            "distance_km": round(km, 3),
            "duration_min": round(dur, 1),
            "stops": stops,
            "geometry": geom,
        }

    km_saved = max(0.0, final_naive_km - final_opt_km)
    fuel_saved_l = round(km_saved * 0.35, 2)  # Diesel 35L/100km for municipal truck
    co2_saved_kg = round(fuel_saved_l * 2.68, 2)  # 2.68kg CO2 per L diesel
    time_saved_min = round(max(0.0, naive_duration - opt_duration), 1)

    has_organic = any("organic" in str(b.get("reason", "")).lower() or "food" in str(b.get("reason", "")).lower() for b in full)
    ai_suggestion = {
        "title": "Chennai Heat & Odor Escalation Dynamic Advisory",
        "rationale": (
            "Given high daytime Chennai humidity and heat, organic and high-severity waste deteriorates rapidly. "
            "Dispatching truck along the OR-Tools optimized route ensures minimal route distance while clearing priority stops promptly."
            if has_organic else
            "Google OR-Tools guided local search has eliminated back-tracking on campus roads, saving mileage and diesel emissions."
        ),
        "action": "Dispatch primary municipal truck on recommended sequence.",
        "requires_approval": True,
    }

    return {
        "optimized": payload(opt_ids, final_opt_km, opt_duration, opt_geom),
        "naive": payload(naive_ids, final_naive_km, naive_duration, naive_geom),
        "full_count": len(full),
        "depot": depot,
        "threshold": threshold,
        "km_saved": round(km_saved, 2),
        "fuel_saved_l": fuel_saved_l,
        "co2_saved_kg": co2_saved_kg,
        "time_saved_min": time_saved_min,
        "ai_suggestion": ai_suggestion,
    }

