import AppKit

struct Stroke {
    var points: [CGPoint]
    var color: NSColor
    var width: CGFloat
}

let paper = NSColor(calibratedWhite: 0.93, alpha: 1)
let inks: [(String, NSColor)] = [
    ("Black", NSColor(calibratedWhite: 0.08, alpha: 1)),
    ("Red", NSColor(calibratedRed: 0.84, green: 0.19, blue: 0.19, alpha: 1)),
    ("Blue", NSColor(calibratedRed: 0.18, green: 0.5, blue: 0.82, alpha: 1)),
    ("Green", NSColor(calibratedRed: 0.18, green: 0.62, blue: 0.36, alpha: 1)),
    ("Orange", NSColor(calibratedRed: 0.85, green: 0.47, blue: 0.34, alpha: 1)),
    ("Yellow", NSColor(calibratedRed: 0.95, green: 0.76, blue: 0.19, alpha: 1)),
    ("Grey", NSColor(calibratedWhite: 0.55, alpha: 1)),
    ("White", NSColor.white),
]
let widths: [(String, CGFloat)] = [("Fine", 2.5), ("Medium", 5), ("Thick", 10)]
let eraserWidth: CGFloat = 26
let canvasSize = NSSize(width: 960, height: 600)
let sketchFolder = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent(".claude/clubhouse-helper/sketches", isDirectory: true)

final class Canvas: NSView {
    var strokes: [Stroke] = []
    var color = inks[0].1
    var width = widths[1].1
    var isErasing = false

    override var isFlipped: Bool { true }

    override func draw(_ dirtyRect: NSRect) {
        paper.setFill()
        bounds.fill()

        for stroke in strokes {
            let path = NSBezierPath()
            path.lineWidth = stroke.width
            path.lineCapStyle = .round
            path.lineJoinStyle = .round
            path.move(to: stroke.points[0])

            if stroke.points.count == 1 {
                path.line(to: stroke.points[0])
            }

            for point in stroke.points.dropFirst() {
                path.line(to: point)
            }

            stroke.color.setStroke()
            path.stroke()
        }
    }

    override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        strokes.append(Stroke(points: [point], color: isErasing ? paper : color, width: isErasing ? eraserWidth : width))
        needsDisplay = true
    }

    override func mouseDragged(with event: NSEvent) {
        guard !strokes.isEmpty else { return }
        strokes[strokes.count - 1].points.append(convert(event.locationInWindow, from: nil))
        needsDisplay = true
    }

    func png() -> Data? {
        guard let image = bitmapImageRepForCachingDisplay(in: bounds) else { return nil }
        cacheDisplay(in: bounds, to: image)

        return image.representation(using: .png, properties: [:])
    }
}

final class Pad: NSObject, NSApplicationDelegate, NSWindowDelegate {
    let canvas = Canvas(frame: NSRect(origin: .zero, size: canvasSize))
    var window: NSWindow?

    func button(_ title: String, _ action: Selector, tag: Int = 0) -> NSButton {
        let made = NSButton(title: title, target: self, action: action)
        made.tag = tag
        made.bezelStyle = .rounded

        return made
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let tools = NSStackView()
        tools.orientation = .horizontal
        tools.spacing = 8
        tools.edgeInsets = NSEdgeInsets(top: 8, left: 12, bottom: 8, right: 12)

        for (index, ink) in inks.enumerated() {
            tools.addArrangedSubview(button(ink.0, #selector(pickInk(_:)), tag: index))
        }

        for (index, size) in widths.enumerated() {
            tools.addArrangedSubview(button(size.0, #selector(pickWidth(_:)), tag: index))
        }

        tools.addArrangedSubview(button("Eraser", #selector(erase)))
        tools.addArrangedSubview(button("Undo", #selector(undo)))
        tools.addArrangedSubview(button("Clear", #selector(clear)))
        tools.addArrangedSubview(NSView())
        tools.addArrangedSubview(button("Cancel", #selector(cancel)))
        let send = button("Send to Claude", #selector(sendSketch))
        send.keyEquivalent = "\r"
        tools.addArrangedSubview(send)

        let column = NSStackView(views: [tools, canvas])
        column.orientation = .vertical
        column.spacing = 0
        canvas.widthAnchor.constraint(equalToConstant: canvasSize.width).isActive = true
        canvas.heightAnchor.constraint(equalToConstant: canvasSize.height).isActive = true

        let made = NSWindow(
            contentRect: NSRect(origin: .zero, size: canvasSize),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        made.title = "Draw it: sketch what you want, then Send to Claude"
        made.contentView = column
        made.delegate = self
        made.center()
        made.level = .floating
        made.makeKeyAndOrderFront(nil)
        window = made
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func pickInk(_ sender: NSButton) {
        canvas.color = inks[sender.tag].1
        canvas.isErasing = false
    }

    @objc func pickWidth(_ sender: NSButton) {
        canvas.width = widths[sender.tag].1
        canvas.isErasing = false
    }

    @objc func erase() {
        canvas.isErasing = true
    }

    @objc func undo() {
        _ = canvas.strokes.popLast()
        canvas.needsDisplay = true
    }

    @objc func clear() {
        canvas.strokes = []
        canvas.needsDisplay = true
    }

    @objc func cancel() {
        exit(1)
    }

    @objc func sendSketch() {
        guard !canvas.strokes.isEmpty, let data = canvas.png() else { exit(1) }
        try? FileManager.default.createDirectory(at: sketchFolder, withIntermediateDirectories: true)
        let file = sketchFolder.appendingPathComponent("sketch-\(Int(Date().timeIntervalSince1970)).png")

        do {
            try data.write(to: file)
            print(file.path)
            exit(0)
        } catch {
            exit(1)
        }
    }

    func windowWillClose(_ notification: Notification) {
        exit(1)
    }
}

let application = NSApplication.shared
let pad = Pad()
application.delegate = pad
application.setActivationPolicy(.accessory)
application.run()
