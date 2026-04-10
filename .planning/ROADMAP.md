# Roadmap: PhantomPad

## Overview
PhantomPad is a mature project that has reached its initial foundation (v1.0). The journey forward focus on stabilizing the input bridge, improving security, and enhancing cross-platform support.

## Milestones
- ✅ **v1.0 MVP Foundation** - Core server, input bridge, and mobile interfaces (Completed)
- 🚧 **v1.1 GSD Adoption** - Establishing the planning workflow and initial optimizations (Current)

## Phases

<details>
<summary>✅ v1.0 MVP Foundation (Phases 1-3) - SHIPPED 2026-04-08</summary>

### Phase 1: Core Server & Net
**Goal**: Basic Express/Socket.io connectivity.
**Plans**: Complete (Inferred)

### Phase 2: Input Emulation
**Goal**: PowerShell bridge for Keyboard and ViGEm gamepad support.
**Plans**: Complete (Inferred)

### Phase 3: Mobile Interfaces
**Goal**: PWA and native Android WebView wrapper.
**Plans**: Complete (Inferred)

</details>

### 🚧 v1.1 GSD Adoption (In Progress)

**Milestone Goal:** Integrate GSD workflow and address immediate technical debt.

#### Phase 4: Project Initialization & Mapping
**Goal**: Create a complete technical map of the codebase and project goals.
**Depends on**: Phase 3
**Requirements**: Adhere to GSD standards
**Success Criteria**:
  1. `.planning/` directory structure created.
  2. Codebase map (7 documents) generated.
  3. `PROJECT.md` reflects current system state.
**Plans**: 1 plan
- [x] 04-01: Initialize GSD and codebase map

#### Phase 5: Gaming & Sensor Optimization
**Goal**: Implement gyroscopic steering and expand AAA game support.
**Depends on**: Phase 4
**Requirements**: Support for gyroscopic steering, Presets for AAA games, Universal compatibility.
**Success Criteria**:
  1. Gyro sensor data from the phone translates to steering inputs (X-axis) in games.
  2. New presets added for popular AAA games (e.g., Cyberpunk 2077, Forza).
  3. Improved input handler robustness for various game windowing modes.
**Plans**: TBD

Plans:
- [ ] 05-01: Research and implement gyro steering
- [ ] 05-02: Expand game presets library

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-3. Foundation | v1.0 | 3/3 | Complete | 2026-04-08 |
| 4. GSD Init | v1.1 | 1/1 | Complete | 2026-04-08 |
| 5. Gaming Opt | v1.1 | 2/2 | Complete | 2026-04-08 |
| 6. Testing | v1.1 | 3/3 | Complete | 2026-04-08 |
| 7. Deployment | v1.1 | 2/2 | Complete | 2026-04-08 |
