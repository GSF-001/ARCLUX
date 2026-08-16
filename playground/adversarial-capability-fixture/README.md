# Adversarial Capability Fixture

This fixture exercises ARCLUX capability classification from source evidence.
It is intentionally mock-only: no socket, shell, credential store, or remote
target is accessed. The expected evidence flow is:

```text
behavioral evidence -> classification input -> mock target -> mock response -> risk classification
```

The fixture is suitable for detector tests and regression checks. A detected
signal describes a modeled capability, not proof that a real exploit works.
