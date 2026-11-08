import Foundation
import PDFKit
import AppKit

// pdftool find <pdf> <texto>            -> página e retângulo de cada ocorrência
// pdftool crop <pdf> <pag> <x> <y> <w> <h> <escala> <saida.png>   (y a partir do TOPO; pag começa em 1)
// pdftool page <pdf> <pag> <escala> <saida.png>
func render(_ page: PDFPage, rect: CGRect, scale: CGFloat, to path: String) {
    let w = Int(rect.width * scale), h = Int(rect.height * scale)
    let cs = CGColorSpaceCreateDeviceRGB()
    guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                              space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { exit(2) }
    ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    ctx.scaleBy(x: scale, y: scale)
    ctx.translateBy(x: -rect.minX, y: -rect.minY)
    page.draw(with: .mediaBox, to: ctx)
    guard let img = ctx.makeImage() else { exit(3) }
    let rep = NSBitmapImageRep(cgImage: img)
    try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}

let a = CommandLine.arguments
guard a.count >= 3, let doc = PDFDocument(url: URL(fileURLWithPath: a[2])) else { print("erro"); exit(1) }
switch a[1] {
case "find":
    for sel in doc.findString(a[3], withOptions: [.caseInsensitive]) {
        for p in sel.pages {
            let b = sel.bounds(for: p), H = p.bounds(for: .mediaBox).height
            print("p\(doc.index(for: p) + 1) x=\(Int(b.minX)) topo=\(Int(H - b.maxY)) w=\(Int(b.width)) h=\(Int(b.height))")
        }
    }
case "info":
    let p = doc.page(at: 0)!.bounds(for: .mediaBox)
    print(doc.pageCount, Int(p.width), Int(p.height), (doc.page(at: 1)?.string?.count ?? 0))
case "page":
    let p = doc.page(at: Int(a[3])! - 1)!
    render(p, rect: p.bounds(for: .mediaBox), scale: CGFloat(Double(a[4])!), to: a[5])
case "crop":
    let p = doc.page(at: Int(a[3])! - 1)!
    let H = p.bounds(for: .mediaBox).height
    let x = Double(a[4])!, y = Double(a[5])!, w = Double(a[6])!, h = Double(a[7])!
    render(p, rect: CGRect(x: x, y: H - y - h, width: w, height: h), scale: CGFloat(Double(a[8])!), to: a[9])
default: exit(1)
}
