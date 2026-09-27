# PoRJE Demo, Full Package

---

## Part 1: Pre-Demo Prompt for Your Coding Agent

Copy this to your agent before you present.

```
TASK: Prepare the PoRJE demo environment for presentation.

STEP 1. Reset the runtime store and warm up the JIT.
  Run `python scripts/reset.py`
  This cross-platform script safely kills any stale server, drops the graph database,
  re-compiles the Jac JIT, seeds the root asset, and confirms the /healthz endpoint.
  Confirm it reports "Reset complete!".

STEP 2. Print a final one-line status report:
  "PRE-DEMO READY: Graph seeded, JIT warmed, stale processes killed."

Do not modify any file. If any step fails, stop and report the exact failure
and the raw output. Do not attempt fixes.
```

---

## Part 2: Terminal Setup Before You Present

Two terminals. Leave them open side by side. Backend on the left, frontend on the right.

**Terminal 1 (backend and graph, this is where the Jac Walkers print)**
```
cd ~/proof-of-reserve-jac
source .venv/bin/activate
export PORJE_TRACE=1
```

**Terminal 2 (frontend, this is the demo screen)**
```
cd ~/proof-of-reserve-jac/frontend
```

Nothing runs yet. You start the two servers as Command 1 and Command 2 once you begin.

Browser: open `http://localhost:3000` in one tab and `https://sepolia.etherscan.io/address/YOUR_POR_TOKEN_ADDRESS` in a second tab. Keep them side by side.

---

## Part 3: Intro to Say Before You Touch a Keyboard

Welcome Everyone. Proof of Reserve, Jack Enforced. is a Jac protocol that turns a Chainlink reserve attestation into a permit, so a mint can only happen after the attestation survives a walk. Chainlink Proof of Reserve is the attestation itself: at a stated time, a stated amount of backing was reported for a stated asset, and that report is what makes on-chain reserves usable as evidence instead of a screenshot. The problem is that almost every application treats that report as a badge. A number is displayed, but nothing has to happen because of it. The report is a fact about the past, not authorization to move value. A price can be fresh while the reserve is old. A reserve timestamp can update while the amount never moves. A parent asset can look backed while the claim it depends on is missing. And missing Proof of Reserve is usually an empty field, not a hard stop. Proof of Reserve today is a strong sensor and a weak primitive. It tells you something was reported. It does not decide whether that report is still usable, and it does not decide how much new supply that report can support.

Our project closes that gap. We take the Chainlink attestation and place those cryptographically attested Proof of Reserve amounts and times on a Jac graph as nodes and edges, so the Freshness Walker, the Cover Walker, and the Auditor Walker can move across the claim. Each one writes a colored stamp. The mint stays locked until all three are green, and when it runs it issues exactly what the current reserve covers, sized by the graph itself. This turns Proof of Reserve from something you can quote into something you have to pass through.

Issuers, vaults, lenders, bridges, and treasury tokens all mint or accept size against a reserve, often on a static number or a yes-or-no read. We gate new supply, refuse thin or stale collateral, and size a mint to live coverage. When a dashboard still looks fine and the backing underneath is already broken, the mint refuses in public, with a readable record of why.

Terminal 1 is the backend. It runs the Jac runtime, holds the graph, and prints every node the Jac Walkers visit. Terminal 2 is the frontend. It renders the graph and gives you the three buttons that trigger each demo path. Both are open the whole time.

---

## Command 1

**Terminal 1**

```
jac start main.jac
```

Command 1 boots the backend. Starts the graph, loads every Jac Walker, and turns each one into a callable endpoint.

---

## Command 2

**Terminal 2**

```
npm run dev
```

Command 2 boots the frontend on port 3000. It reads the graph, it does not compute anything. Every verdict it shows comes from Terminal 1.

---

## Command 3

**Terminal 1**

```
python scripts/seed_graph.py
```

Command 3 creates the root asset node. Everything the Jac Walkers do from here happens on top of this node.

---

## Command 4 - Browser (click Happy in the UI)

Command 4 fills the graph: a price, a proven reserve attestation, and a child claim. The Freshness Walker, the Cover Walker, and the Auditor Walker run in sequence. In Terminal 1, watch each Jac Walker visit nodes and cross edges. Three green stamps land. The Auditor Walker still prints four findings. That is the system trying to fail and finding no reason.

---

## Command 5 - Browser (enter 1000000 in the requested amount, then click Mint)

Command 5 is the mint. The Cover Walker already set how much the reserve justifies. The Act Walker reads the three stamps and mints the smaller of the amount you asked for and the amount that is justified. The transaction lands on Ethereum Sepolia, a public test network, so anyone can inspect it. Open Etherscan for the transaction and the NFT: minted amount, coverage used, price time stamp, reserve time stamp, and the three stamp colors. Anyone can open that record later and see why the mint was allowed.

---

## Command 6 - Browser (click Yellow, then click Unknown)

Command 6 is the refuse. Same asset, same button. Yellow is a flat reserve: the time stamp moved, the amount did not, while price did. Unknown is a missing child: the parent looks attested, the claim under it is gone. The mint sends nothing. The Counsel Walker, silent until the stamps existed, names what broke.

---

## Click Happy again and end on green

---

## Closing, Tie It Together

This project is best in class because it does something no Proof of Reserve dashboard does. It refuses. Jac Walkers carry attested reserve figures across the graph. The Freshness Walker, the Cover Walker, and the Auditor Walker write a time stamp, coverage, and an audit. The Act Walker cannot mint until those three stamps are green. A refusal is the product, not a crash.

Jac fits because the graph is the data and the computation at once: claims as nodes, Jac Walkers as approvals, stamps as verdicts, and the Act Walker as the Jac Walker that reads them. There is no separate database, policy engine, or glue code. Issuers, lenders, bridges, and treasury tokens that mint against a reserve that can look healthy while it is not get a mandatory walk and an on-chain refusal anyone can audit.
