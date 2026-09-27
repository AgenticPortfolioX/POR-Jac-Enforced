#!/usr/bin/env python
import os
import sys
import _runtime as rt

def main():
    print("Stopping any running jac process...")
    rt.kill_server()

    print("Dropping the store...")
    try:
        dropped = rt.reset_store()
        print(f"Store reset (dropped database {dropped})")
    except Exception as exc:
        print(f"Warning: could not reset the store: {exc}")

    print("Starting server...")
    proc = rt.start_server()
    print(f"Server started (pid {proc.pid})")

    print("Waiting for /healthz...")
    if not rt.wait_for_healthz():
        print("Error: /healthz never returned 200")
        rt.stop_server(proc)
        sys.exit(1)

    print("Seeding asset...")
    node_id = rt.seed_asset()
    print(f"Asset seeded (node id: {node_id})")

    print("Stopping background server to free port for demo...")
    rt.stop_server(proc)
    print("Reset complete! The graph is seeded and ready for the demo.")

if __name__ == "__main__":
    main()
