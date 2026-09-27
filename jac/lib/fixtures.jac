import json;
import os;
import from jac.lib.utils { now_unix }

glob FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "fixtures");

def load_fixture(name: str) -> dict[str, any] {
    path = os.path.join(FIXTURES_DIR, name + ".json");
    with open(path, "r") as f {
        raw = json.load(f);
    }
    assert raw["label"] == "fixture";
    raw["source"] = "fixture";
    raw["timestamp"] = now_unix() + int(raw.get("timestamp_offset_seconds", 0));
    return raw;
}
