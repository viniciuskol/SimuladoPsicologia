import Foundation
import PDFKit
import AppKit

// pdflines <pdf> <saida.json>: cada linha de cada página com posição e trechos em negrito/itálico.
struct Run: Codable { let text: String; let bold: Bool; let italic: Bool; let underline: Bool }
struct Line: Codable { let page: Int; let x: Int; let top: Int; let text: String; let runs: [Run] }
let a = CommandLine.arguments
guard a.count == 3, let doc = PDFDocument(url: URL(fileURLWithPath: a[1])) else { exit(1) }
var out: [Line] = []
for i in 0..<doc.pageCount {
    guard let page = doc.page(at: i), let all = page.selection(for: page.bounds(for: .mediaBox)) else { continue }
    let H = page.bounds(for: .mediaBox).height
    for sel in all.selectionsByLine() {
        let b = sel.bounds(for: page)
        var runs: [Run] = []
        if let s = sel.attributedString {
            s.enumerateAttributes(in: NSRange(location: 0, length: s.length)) { attrs, r, _ in
                let t = (s.string as NSString).substring(with: r)
                let f = attrs[.font] as? NSFont
                let name = (f?.fontName ?? "").lowercased()
                let bold = name.contains("bold") || name.contains("black") || name.contains("-bd") || name.contains("heavy")
                let italic = name.contains("italic") || name.contains("oblique")
                let und = (attrs[.underlineStyle] as? Int ?? 0) != 0
                runs.append(Run(text: t, bold: bold, italic: italic, underline: und))
            }
        }
        out.append(Line(page: i + 1, x: Int(b.minX), top: Int(H - b.maxY), text: sel.string ?? "", runs: runs))
    }
}
try JSONEncoder().encode(out).write(to: URL(fileURLWithPath: a[2]))
print(out.count)
