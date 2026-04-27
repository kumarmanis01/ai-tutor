declare module 'express' {
  const x: any
  export default x
}

declare module 'prom-client' {
  const x: any
  export default x
}

declare module '@kubernetes/client-node' {
  const x: any
  export = x
}

declare module 'minimist' {
  const x: any
  export default x
}

declare module 'pdf-lib' {
  export class PDFDocument {
    static create(): Promise<PDFDocument>
    static load(bytes: ArrayBuffer | Uint8Array | string): Promise<PDFDocument>
    embedFont(font: string): Promise<PDFFont>
    addPage(size?: [number, number]): PDFPage
    save(): Promise<Uint8Array>
    getPageCount(): number
  }
  export class PDFPage {
    drawText(text: string, options?: Record<string, any>): void
    setFontSize(size: number): void
    getSize(): { width: number; height: number }
    addContentStreams(...streams: any[]): void
  }
  export class PDFFont {
    widthOfTextAtSize(text: string, size: number): number
    heightAtSize(size: number): number
  }
  export const StandardFonts: {
    Helvetica: string
    HelveticaBold: string
    TimesRoman: string
    Courier: string
    [key: string]: string
  }
}
