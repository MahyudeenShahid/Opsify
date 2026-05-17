---
trigger: always_on
---

1. 🎯 Core Principles

All development must follow these principles:

Build modular systems, not monoliths
Prefer simplicity over complexity
Design for scalability from day one
Every component must have a single responsibility
Optimize for real-world execution, not theoretical design
Assume the system will grow into a production-grade platform
2. 🧠 Architecture Rules
2.1 System Design
Divide the system into independent modules
Each module must:
operate independently
communicate via well-defined interfaces
avoid internal dependency leakage
2.2 Communication Standard
All inter-module communication must use:
structured JSON
events or messages
defined schemas
Rule:

❌ No direct coupling between modules
✔ All communication must pass through defined interfaces

3. 📁 File & Folder Structure Rules
3.1 Organization Principle
Group code by responsibility, not type
Each folder represents a domain or system unit
3.2 Required Structure
Every module must have:
clear folder boundary
isolated logic
independent documentation
3.3 File Naming Rules
Use lowercase with underscores:
order_parser.py
inventory_manager.ts
Names must reflect function, not implementation
4. 📄 File Creation Standard

Every file must include a header:

# File: <filename>

## Purpose
What this file is responsible for.

## Responsibility
Single clear responsibility of this module.

## Inputs
What data it receives.

## Outputs
What data it produces.

## Dependencies
External/internal modules it depends on.

## Notes
Design decisions, optimizations, or constraints.
5. ⚙️ Development Workflow

Every feature must follow this strict lifecycle:

STEP 1 — Understand
Identify requirement
Map to correct module
STEP 2 — Design
Define input/output contract
Define data schema
Define flow before coding
STEP 3 — Create Structure First
Create file
Add documentation header
Do NOT write logic yet
STEP 4 — Implement Minimal Version
Build working version first
Avoid over-engineering
STEP 5 — Optimize
Reduce complexity
Improve performance
Remove redundancy
STEP 6 — Integrate
Connect to system flow
Ensure compatibility with other modules
STEP 7 — Validate
Test with real-like inputs
Verify full pipeline execution
6. 🤖 Agent / Service Design Rules

If the system uses agents or services:

6.1 Responsibility Rule
One agent = one responsibility
No overlapping logic between agents
6.2 Independence Rule
Agents must be independent
No internal function calling between agents
6.3 Communication Rule

All outputs must follow:

{
  "status": "success",
  "source": "AgentName",
  "data": {},
  "next_step": "OptionalNextAgent"
}
7. 🔄 Data Flow Rules
All data must flow in one direction
Prefer event-driven architecture
Avoid circular dependencies
Standard Event Format
{
  "event_type": "EVENT_NAME",
  "source": "module_name",
  "timestamp": "ISO-8601",
  "payload": {}
}
8. ⚡ Performance Rules
Minimize unnecessary computations
Batch external calls where possible
Cache frequently used data
Prefer async processing for I/O tasks
Avoid blocking operations in main flow
9. 🧪 Testing Rules

Every module must support:

9.1 Unit Testing
Test single function behavior
9.2 Integration Testing
Test module interaction
9.3 Real Input Simulation
Use realistic user/system inputs
Testing Principle:

If it does not work with real-world data, it is not complete.

10. 🧱 Code Quality Standards
Follow clean architecture principles
Keep functions small and readable
Avoid deep nesting (>3 levels)
Use meaningful names only
No duplicate logic across modules
11. 🚫 Forbidden Practices
No monolithic files
No hardcoded workflows
No tight coupling between modules
No skipping documentation
No unclear or ambiguous data formats
No uncontrolled side effects
12. 🧠 Engineering Mindset

Think like building a real production system, not a prototype.

Every decision should answer:

Will this scale?
Is this modular?
Is this maintainable?
Can another developer understand this easily?
13. 🚀 Build Philosophy

“Start simple, make it work, then make it scalable.”

14. 🏁 Final Rule

If a feature cannot be explained in:

a module
a responsibility
an input/output flow

👉 then it is designed incorrectly