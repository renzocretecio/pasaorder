import pytest
from fastapi import HTTPException

from main import ClassifyRequest, Message, classify, require_internal_key
from thinkless_service import classify_conversation


def message(text: str):
    return [{"role": "customer", "content": text}]


def test_rules_cover_the_three_buckets():
    assert (
        classify_conversation(message("Boss pa-order 2 burgers, pickup"), False)["bucket"]
        == "POSSIBLE_ORDER"
    )
    assert classify_conversation(message("Dagdag pala fries"), True)["bucket"] == "NEEDS_ATTENTION"
    assert classify_conversation(message("Magkano burger?"), False)["bucket"] == "NEEDS_ATTENTION"
    assert classify_conversation(message("May burger pa ba?"), False)["bucket"] == "NEEDS_ATTENTION"
    assert classify_conversation(message("Open pa kayo?"), False)["bucket"] == "NEEDS_ATTENTION"
    assert classify_conversation(message("May GCash?"), False)["bucket"] == "NEEDS_ATTENTION"
    assert classify_conversation(message("hi"), False)["bucket"] == "NEEDS_ATTENTION"
    assert classify_conversation(message("salamat"), False)["bucket"] == "NORMAL"


def test_active_order_does_not_autocreate_an_addon():
    result = classify_conversation(message("Pa-order isang fries"), True)
    assert result["bucket"] == "NEEDS_ATTENTION"


def test_address_reply_keeps_an_unresolved_order_in_possible_orders():
    conversation = [
        {"role": "customer", "content": "What are your hours?"},
        {"role": "customer", "content": "Iced americano 1 at empanada 1. deliver"},
        {"role": "customer", "content": "order ko"},
        {"role": "store", "content": "Address po"},
        {"role": "customer", "content": "lauan st"},
    ]
    assert classify_conversation(conversation, False)["bucket"] == "POSSIBLE_ORDER"
    assert classify_conversation(conversation, True)["bucket"] == "NEEDS_ATTENTION"
    cancelled = [*conversation[:-1], {"role": "customer", "content": "Cancel ko nalang"}]
    assert classify_conversation(cancelled, False)["bucket"] == "NEEDS_ATTENTION"


def test_ambiguous_message_defaults_to_attention():
    result = classify_conversation(message("Yung dati nalang"), False)
    assert result["bucket"] == "NEEDS_ATTENTION"
    assert result["status"] == "abstained"


def test_classify_requires_internal_key(monkeypatch):
    monkeypatch.setenv("INFERENCE_API_KEY", "a" * 32)
    with pytest.raises(HTTPException) as error:
        require_internal_key("wrong")
    assert error.value.status_code == 401
    require_internal_key("a" * 32)
    result = classify(
        ClassifyRequest(messages=[Message(role="customer", content="Pa-order burger")])
    )
    assert result["bucket"] == "POSSIBLE_ORDER"
