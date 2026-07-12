# PDFcraft

A fast, fully client-side **PDF editor** that runs in the browser. Upload PDFs,
reorder/rotate/delete pages, merge multiple files, add styled text and QR codes,
then export a new PDF — all without a server. Your files never leave your device.

## Features

- **Upload & merge** multiple PDFs (drag-and-drop or file picker)
- **Page management** — reorder (drag), rotate, and delete pages
- **Text annotations** — click to place; edit content inline (double-click)
  - Font family, size, color, bold / italic / underline
  - Alignment, line height, opacity, and highlight color
  - Auto-sizing boxes (no wrapping — Shift+Enter for a new line)
- **QR codes** — place, edit the encoded URL/text, recolor, and resize
- **Zoom**, **undo / redo**, and one-click **Export PDF**

## Tech stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)
- [PDF.js](https://mozilla.github.io/pdf.js/) — render PDF pages to canvas
- [Konva](https://konvajs.org/) / [react-konva](https://konvajs.org/docs/react/) — interactive annotation layer
- [pdf-lib](https://pdf-lib.js.org/) — write the exported PDF
- [zustand](https://github.com/pmndrs/zustand) — state, [@dnd-kit](https://dndkit.com/) — drag-and-drop, [qrcode](https://github.com/soldair/node-qrcode) — QR generation

## Getting started

This project uses **pnpm**.

```bash
pnpm install
pnpm dev        # start the dev server
pnpm build      # type-check + production build
pnpm preview    # preview the production build
```

Then open the URL Vite prints (usually http://localhost:5173).

## License

[MIT](./LICENSE)
