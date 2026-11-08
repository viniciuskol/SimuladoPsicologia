import Foundation
import PDFKit

// Procura blocos de tinta fora das linhas de texto: desenhos e bordas de tabela.
// Saída: pagina x y w h (pontos, y a partir do topo) e a questão mais próxima acima.
let cell = 8
guard CommandLine.arguments.count == 2, let doc = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1])) else { exit(1) }
for i in 0..<doc.pageCount {
    guard let page = doc.page(at: i) else { continue }
    let box = page.bounds(for: .mediaBox)
    let W = Int(box.width), H = Int(box.height)
    guard let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: W,
                              space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue) else { continue }
    ctx.setFillColor(gray: 1, alpha: 1); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
    page.draw(with: .mediaBox, to: ctx)
    var numbers: [(y: Int, text: String)] = []
    if let all = page.selection(for: box) {
        for line in all.selectionsByLine() {
            let b = line.bounds(for: page)
            ctx.setFillColor(gray: 1, alpha: 1)
            ctx.fill(b.insetBy(dx: -1, dy: -1))
            let t = (line.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if t.count <= 2, Int(t) != nil { numbers.append((H - Int(b.maxY), t)) }
        }
    }
    guard let data = ctx.data else { continue }
    let px = data.bindMemory(to: UInt8.self, capacity: W * H)
    let cols = W / cell + 1, rows = H / cell + 1
    var grid = [Bool](repeating: false, count: cols * rows)
    for y in 0..<H {
        let top = H - 1 - y
        if top < 70 || top > H - 75 { continue }
        for x in 0..<W where px[y * W + x] < 110 {
            if x > 290 && x < 305 { continue }
            grid[(top / cell) * cols + x / cell] = true
        }
    }
    var seen = [Bool](repeating: false, count: grid.count)
    for s in 0..<grid.count where grid[s] && !seen[s] {
        var stack = [s]; seen[s] = true
        var (x0, x1, y0, y1) = (Int.max, 0, Int.max, 0)
        while let c = stack.popLast() {
            let cx = c % cols, cy = c / cols
            x0 = min(x0, cx); x1 = max(x1, cx); y0 = min(y0, cy); y1 = max(y1, cy)
            for dy in -2...2 { for dx in -2...2 {
                let nx = cx + dx, ny = cy + dy
                if nx < 0 || ny < 0 || nx >= cols || ny >= rows { continue }
                let n = ny * cols + nx
                if grid[n] && !seen[n] { seen[n] = true; stack.append(n) }
            } }
        }
        let w = (x1 - x0 + 1) * cell, h = (y1 - y0 + 1) * cell
        if w >= 40 && h >= 24 {
            let top = y0 * cell, left = x0 * cell
            let sameCol = numbers.filter { ($0.y <= top) }.last?.text ?? "?"
            print("p\(i + 1) x=\(left) y=\(top) w=\(w) h=\(h) perto_de_Q\(sameCol)")
        }
    }
}
