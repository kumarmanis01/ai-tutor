# Diagrams

This folder contains Mermaid source files for the hydrateAll architecture diagrams. Render PNGs using the Mermaid CLI.

Install and render (recommended):

```bash
# install mermaid-cli (one-off)
npx @mermaid-js/mermaid-cli -v

# render PNGs
npx @mermaid-js/mermaid-cli -i submit-enqueue.mmd -o submit-enqueue.png
npx @mermaid-js/mermaid-cli -i worker-claim-execute.mmd -o worker-claim-execute.png
npx @mermaid-js/mermaid-cli -i reconciler-aggregation.mmd -o reconciler-aggregation.png
```

On Windows PowerShell, run the same `npx` commands.

Place the generated PNGs next to these `.mmd` files. The main docs reference `docs/diagrams/*.png`.
