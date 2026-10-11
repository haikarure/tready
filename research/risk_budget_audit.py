#!/usr/bin/env python3
"""Offline research model, not an exchange adapter or a trading application.

Run from any directory: python research/risk_budget_audit.py
Only reads saved, public market data; writes results.json beside this file.
No credentials, network calls, signing, or orders.
"""

from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR, getcontext
from itertools import product
import hashlib
import json
from pathlib import Path

getcontext().prec = 50
D = Decimal
ROOT = Path(__file__).resolve().parent
MICRO = D("0.000001")


def down(value, step):
    return (value / step).to_integral_value(rounding=ROUND_FLOOR) * step


def up(value, step):
    return (value / step).to_integral_value(rounding=ROUND_CEILING) * step


def loss(quantity, entry, exit_price, side, fee_rate, reserve=D(0)):
    """Adverse price loss + two taker fees + an assumed cash reserve.

    Fee rounding up to AUSD micros is a conservative MODEL assumption,
    not a verification of the exchange's exact settlement rounding.
    reserve represents assumed funding/other AUSD costs, not a forecast.
    """
    adverse = entry - exit_price if side == "long" else exit_price - entry
    if quantity < 0 or adverse <= 0 or fee_rate < 0 or reserve < 0:
        raise ValueError("Use a positive adverse move and nonnegative inputs")
    return (
        quantity * adverse
        + up(quantity * entry * fee_rate, MICRO)
        + up(quantity * exit_price * fee_rate, MICRO)
        + reserve
    )


def size(budget, entry, exit_price, side, fee_rate, lot_step, reserve=D(0)):
    """Largest whole-lot quantity fitting this specific loss model."""
    adverse = entry - exit_price if side == "long" else exit_price - entry
    if budget <= reserve or adverse <= 0 or lot_step <= 0:
        raise ValueError("Budget/price/lot inputs do not admit a trade")
    low = 0
    high = int(down((budget - reserve) / adverse, lot_step) / lot_step)
    while low < high:
        mid = (low + high + 1) // 2
        if loss(D(mid) * lot_step, entry, exit_price, side, fee_rate, reserve) <= budget:
            low = mid
        else:
            high = mid - 1
    return D(low) * lot_step


def walk_book(levels, quantity, price_scale, size_scale):
    """Projection against a SAVED book. An unobserved tail stays unknown."""
    if quantity <= 0:
        raise ValueError("Quantity must be positive")
    remaining = quantity
    notional = D(0)
    matched = D(0)
    for level in levels:
        available = D(level["s"]) / size_scale
        taken = min(remaining, available)
        notional += taken * D(level["p"]) / price_scale
        matched += taken
        remaining -= taken
        if remaining == 0:
            break
    return {
        "requested_BTC": quantity,
        "observed_matched_BTC": matched,
        "observed_notional_AUSD": notional,
        "entire_quantity_observed": remaining == 0,
        "vwap_if_entire_quantity_observed": notional / matched if remaining == 0 else None,
        "unobserved_tail_BTC": remaining,
    }


def json_default(value):
    if isinstance(value, D):
        return str(value)
    raise TypeError(type(value).__name__)


def main():
    fixture_path = ROOT / "fixtures" / "perpl-btc-public.json"
    fixture_bytes = fixture_path.read_bytes()
    fixture = json.loads(fixture_bytes)
    book = fixture["book"]
    config = fixture["market"]["config"]
    price_scale = D(10) ** config["price_decimals"]
    size_scale = D(10) ** config["size_decimals"]
    tick = D(1) / price_scale
    lot_step = D(1) / size_scale
    fee = D(config["taker_fees"][0]) / D(1_000_000)
    entry = D(book["ask"][0]["p"]) / price_scale
    stop = down(entry * D("0.999"), tick)
    stress_exit = down(stop * D("0.999"), tick)
    outside_exit = down(stop * D("0.998"), tick)
    worst_entry = up(entry * D("1.001"), tick)
    budget = D(5)

    naive = down(budget / (entry - stop), lot_step)
    fee_aware = size(budget, entry, stop, "long", fee, lot_step)
    bounded = size(budget, worst_entry, stress_exit, "long", fee, lot_step)
    projections = [
        {"method": "stop_distance_only", "quantity_BTC": naive,
         "modeled_loss_at_stop_AUSD": loss(naive, entry, stop, "long", fee),
         "modeled_loss_with_10bps_exit_gap_AUSD": loss(naive, entry, stress_exit, "long", fee)},
        {"method": "fees_at_quoted_entry", "quantity_BTC": fee_aware,
         "modeled_loss_at_stop_AUSD": loss(fee_aware, entry, stop, "long", fee),
         "modeled_loss_with_10bps_exit_gap_AUSD": loss(fee_aware, entry, stress_exit, "long", fee)},
        {"method": "fees_and_assumed_entry_exit_bounds", "quantity_BTC": bounded,
         "modeled_loss_at_bounds_AUSD": loss(bounded, worst_entry, stress_exit, "long", fee),
         "modeled_loss_OUTSIDE_exit_bound_AUSD": loss(bounded, worst_entry, outside_exit, "long", fee)},
    ]

    # An independent synthetic arithmetic example: no historical trade implied.
    toy = loss(D(50), D(100), D("99.9"), "long", D("0.000345"))
    assert toy == D("8.448275")

    # Sweep both directions, price scales, budgets, fees, and reserve assumptions.
    grid_count = 0
    for e, bps, risk, side, rate, reserve_fraction in product(
        [D(100), D(83000)], [D(1), D(5), D(10), D(25), D(100)],
        [D(1), D(5), D(50)], ["long", "short"],
        [D(0), D("0.000345"), D("0.001")], [D(0), D("0.1")]
    ):
        x = e * (1 - bps / 10000 if side == "long" else 1 + bps / 10000)
        reserve = risk * reserve_fraction
        q = size(risk, e, x, side, rate, lot_step, reserve)
        assert loss(q, e, x, side, rate, reserve) <= risk
        assert loss(q + lot_step, e, x, side, rate, reserve) > risk
        grid_count += 1

    # A sampled consistency check within the declared long-only BTC bounds.
    envelope_checks = 0
    for entry_fraction, exit_fraction, fill_fraction in product(
        [D(0), D("0.5"), D(1)], [D(0), D("0.5"), D(1)],
        [D("0.25"), D("0.5"), D(1)]
    ):
        e = entry + (worst_entry - entry) * entry_fraction
        x = stop - (stop - stress_exit) * exit_fraction
        q = down(bounded * fill_fraction, lot_step)
        assert loss(q, e, x, "long", fee) <= budget
        envelope_checks += 1

    observed_ask_depth = sum(D(x["s"]) / size_scale for x in book["ask"])
    tail = walk_book(book["ask"], observed_ask_depth + lot_step, price_scale, size_scale)
    assert not tail["entire_quantity_observed"]
    assert tail["vwap_if_entire_quantity_observed"] is None
    assert projections[0]["modeled_loss_at_stop_AUSD"] > budget
    assert projections[1]["modeled_loss_with_10bps_exit_gap_AUSD"] > budget
    assert projections[2]["modeled_loss_at_bounds_AUSD"] <= budget
    assert projections[2]["modeled_loss_OUTSIDE_exit_bound_AUSD"] > budget

    result = {
        "status": "offline_research_model_only",
        "fixture_sha256": hashlib.sha256(fixture_bytes).hexdigest(),
        "source": fixture["provenance"],
        "assumptions": {
            "side": "long", "budget_AUSD": budget, "quoted_entry_AUSD": entry,
            "synthetic_stop_AUSD": stop, "assumed_worst_entry_AUSD": worst_entry,
            "assumed_stress_exit_AUSD": stress_exit, "outside_exit_bound_AUSD": outside_exit,
            "fee_rate_each_leg": fee, "lot_step_BTC": lot_step,
            "fee_tier": "base, fixed for the whole simulated trade",
            "funding_reserve_AUSD_for_BTC_example": "0",
            "included": ["adverse price loss", "two modeled taker fees rounded up to AUSD micros"],
            "excluded": ["funding beyond an assumed reserve", "gas in MON", "liquidation or ADL", "builder fee", "keeper/venue outages", "actual settlement rounding verification"],
            "important": "Future exit prices are synthetic assumptions; today's order book does not prove future stop liquidity. Context and book are separate snapshots. No atomic account valuation is asserted.",
        },
        "synthetic_100_to_99_9_loss_AUSD": toy,
        "BTC_comparison": projections,
        "saved_book_projection_for_fee_aware_quantity": walk_book(book["ask"], fee_aware, price_scale, size_scale),
        "unknown_tail_case": tail,
        "verification": {"sizing_grid_cases": grid_count, "sampled_in_bound_cases": envelope_checks,
                         "negative_controls": ["naive fee omission", "gap beyond quote-only sizing", "gap outside declared envelope", "insufficient observed depth"]},
        "not_proved": ["profitable strategy", "hard maximum loss", "live order lifecycle", "venue reliability", "customer demand", "novelty", "hackathon prize eligibility"],
    }
    (ROOT / "results.json").write_text(json.dumps(result, default=json_default, indent=2) + "\n")
    print(json.dumps({"BTC_comparison": projections, "verification": result["verification"]}, default=json_default, indent=2))


if __name__ == "__main__":
    main()
