# Fabric Diagram Renderer

Renders Mermaid flowchart diagrams with Microsoft Fabric styling — icons, drop shadows, gradient fills, and themed edges. Produces polished SVGs identical to [Fabric Jumpstart](https://jumpstart.fabric.microsoft.com/) architecture diagrams.

## Quick Start (from any project)

```bash
npx github:yourorg/fabric-diagram-renderer render my-diagram.mmd --both
```

This fetches the tool, installs dependencies, generates icons, and renders your `.mmd` file to styled SVGs — all in one command.

## Setup (own repo)

1. Push this folder as its own GitHub repo (e.g. `yourorg/fabric-diagram-renderer`)
2. From any other project, run:

```bash
# Render both light + dark themes
npx github:yourorg/fabric-diagram-renderer render architecture.mmd --both

# Render light theme only
npx github:yourorg/fabric-diagram-renderer render architecture.mmd

# Render dark theme only
npx github:yourorg/fabric-diagram-renderer render architecture.mmd --dark

# Specify output path
npx github:yourorg/fabric-diagram-renderer render architecture.mmd output.svg

# Scaffold a starter diagram in the current directory
npx github:yourorg/fabric-diagram-renderer init
```

No global install or local dependency needed — `npx` handles everything.

## Writing Diagrams

Use standard Mermaid flowchart syntax with `:::ClassName` annotations for Fabric item types:

```text
graph LR
    %% External sources use Unicode codepoint class for emoji icons
    SRC[My Data Source]:::U1F4E6

    %% Fabric workspace container
    subgraph MyWorkspace:::Workspace
        direction LR
        NB[Transform Data]:::Notebook
        LH[Bronze Lakehouse]:::Lakehouse
        EH[Analytics Eventhouse]:::Eventhouse
        ES[Ingestion Stream]:::Eventstream
        SM[Sales Model]:::SemanticModel
        RPT[Sales Report]:::Report
    end

    %% Connections
    SRC ==> ES
    ES ==> EH
    NB --> LH
    LH -.-> SM
    SM -.-> RPT
```

### Supported Item Types

| Class Name | Renders As |
|---|---|
| `Notebook` | Notebook |
| `Lakehouse` | Lakehouse |
| `Eventhouse` | Eventhouse |
| `Eventstream` | Eventstream |
| `KQLDatabase` | KQL Database |
| `KQLDashboard` | Real-Time Dashboard |
| `Reflex` | Activator |
| `DataPipeline` | Data Pipeline |
| `Dataflow` | Dataflow |
| `CopyJob` | Copy Job |
| `Warehouse` | Warehouse |
| `SQLDatabase` | SQL Database |
| `MirroredDatabase` | Mirrored Database |
| `Report` | Report |
| `SemanticModel` | Semantic Model |
| `DataAgent` | Data Agent |
| `MLExperiment` | ML Experiment |
| `Environment` | Environment |
| `UserDataFunction` | User Data Function |
| `Workspace` | Workspace (subgraph) |

### Emoji/Unicode Icons (for external nodes)

For nodes outside the Fabric workspace, use Unicode codepoints (`U` + hex code):

```
NODE[Label]:::U1F69A    → 🚚 (truck)
NODE[Label]:::U1F4E6    → 📦 (package)
NODE[Label]:::U1F3E2    → 🏢 (office building)
NODE[Label]:::U1F3ED    → 🏭 (factory)
NODE[Label]:::U1F30D    → 🌍 (globe)
NODE[Label]:::U1F310    → 🌐 (globe with meridians)
NODE[Label]:::U26C8     → ⛈ (storm)
NODE[Label]:::U26A1     → ⚡ (lightning / power)
NODE[Label]:::U2601     → ☁ (cloud)
NODE[Label]:::U1F512    → 🔒 (lock / security)
NODE[Label]:::U1F511    → 🔑 (key)
NODE[Label]:::U1F4CA    → 📊 (bar chart)
NODE[Label]:::U1F4C8    → 📈 (chart increasing)
NODE[Label]:::U1F4BE    → 💾 (floppy disk / storage)
NODE[Label]:::U1F4E1    → 📡 (satellite / antenna)
NODE[Label]:::U1F5A5    → 🖥 (desktop computer)
NODE[Label]:::U1F4F1    → 📱 (mobile phone)
NODE[Label]:::U1F916    → 🤖 (robot / AI)
NODE[Label]:::U1F9EA    → 🧪 (test tube)
NODE[Label]:::U1F6E0    → 🛠 (tools / wrench)
NODE[Label]:::U1F465    → 👥 (people / users)
NODE[Label]:::U1F4AC    → 💬 (speech bubble)
NODE[Label]:::U1F514    → 🔔 (bell / notification)
NODE[Label]:::U23F0     → ⏰ (alarm clock / scheduler)
NODE[Label]:::U1F680    → 🚀 (rocket / deploy)
NODE[Label]:::U1F3E5    → 🏥 (hospital)
NODE[Label]:::U1F3E6    → 🏦 (bank)
NODE[Label]:::U1F6D2    → 🛒 (shopping cart / retail)
NODE[Label]:::U1F3AC    → 🎬 (media / streaming)
NODE[Label]:::U1F50D    → 🔍 (search / magnifying glass)
```

### Edge Types

| Syntax | Renders As |
|---|---|
| `A ==> B` | Thick solid arrow |
| `A --> B` | Normal solid arrow |
| `A -.-> B` | Dashed arrow |

## Reusing Across Projects

Since this is its own repo, just call it with `npx` from anywhere:

```bash
npx github:yourorg/fabric-diagram-renderer render path/to/diagram.mmd --both
```

`npx` caches the package after first use, so subsequent calls are fast. To force a fresh pull:

```bash
npx --yes github:yourorg/fabric-diagram-renderer render diagram.mmd --both
```

### Optional: Global install for frequent use

```bash
npm install -g github:yourorg/fabric-diagram-renderer
fabric-diagram render my-diagram.mmd --both
```

## How It Works

1. **Mermaid** parses the flowchart syntax and generates a base SVG
2. **enhance.ts** post-processes the SVG DOM (via Puppeteer):
   - Injects Fabric item icons from `@fabric-msft/svg-icons`
   - Adds drop shadows (`feGaussianBlur` + `feOffset`)
   - Applies gradient fills to nodes
   - Styles edges with teal color and rounded caps
   - Formats subgraph containers with headers, icons, and divider lines
   - Adds item-type subtitle labels below node names
3. **Puppeteer** renders in headless Chrome for accurate `getBBox()` calculations

## Credits

Rendering pipeline adapted from [microsoft/fabric-jumpstart](https://github.com/microsoft/fabric-jumpstart) (MIT license).
Icons from [@fabric-msft/svg-icons](https://www.npmjs.com/package/@fabric-msft/svg-icons).
