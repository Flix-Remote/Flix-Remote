import Foundation
import Capacitor
import Darwin
import Security
import Network
import ADBCore
import CryptoKit
import Speech
import AVFoundation

@objc(HomeDiscoveryPlugin)
public class HomeDiscoveryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HomeDiscoveryPlugin"
    public let jsName = "HomeDiscovery"
    public let pluginMethods: [CAPPluginMethod] = ["saveSession", "readSession", "clearSession", "recognizeSpeech"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private var speechEngine: AVAudioEngine?
    private var speechTask: SFSpeechRecognitionTask?
    private var speechCall: CAPPluginCall?
    private var speechText = ""
    private var speechTapInstalled = false
    @objc public func recognizeSpeech(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else { call.reject("اسمح بالتعرف على الكلام من إعدادات الآيفون"); return }
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                guard granted else { call.reject("اسمح بالميكروفون من إعدادات الآيفون"); return }
                DispatchQueue.main.async { self.startSpeech(call) }
            }
        }
    }
    private func finishSpeech(_ error: String? = nil) {
        guard let call = speechCall else { return }; speechCall = nil
        speechEngine?.stop()
        if speechTapInstalled { speechEngine?.inputNode.removeTap(onBus: 0); speechTapInstalled = false }
        speechEngine = nil
        speechTask?.cancel(); speechTask = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        if let error = error, speechText.isEmpty { call.reject(error) } else { call.resolve(["text": speechText]) }
    }
    private func startSpeech(_ call: CAPPluginCall) {
        guard speechCall == nil else { call.reject("الاستماع جارٍ"); return }
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "ar-SA")), recognizer.isAvailable else { call.reject("الإملاء الصوتي غير متاح الآن؛ اكتب الأمر"); return }
        guard recognizer.supportsOnDeviceRecognition else { call.reject("الإملاء المحلي غير متاح لهذه اللغة على هذا الجهاز؛ اكتب الأمر"); return }
        do {
            try AVAudioSession.sharedInstance().setCategory(.record, mode: .measurement, options: .duckOthers)
            try AVAudioSession.sharedInstance().setActive(true)
            let engine = AVAudioEngine(), request = SFSpeechAudioBufferRecognitionRequest()
            // Audio stays on the device; never fall back to Apple's speech service.
            request.requiresOnDeviceRecognition = true
            request.shouldReportPartialResults = true
            speechCall = call; speechText = ""; speechEngine = engine
            let input = engine.inputNode, format = input.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else { finishSpeech("الميكروفون غير متاح"); return }
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in request.append(buffer) }
            speechTapInstalled = true
            engine.prepare(); try engine.start()
            speechTask = recognizer.recognitionTask(with: request) { result, error in
                DispatchQueue.main.async {
                    if let result = result { self.speechText = result.bestTranscription.formattedString }
                    if result?.isFinal == true || error != nil { self.finishSpeech(error == nil ? nil : "تعذر الاستماع؛ اكتب الأمر") }
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 12) { if self.speechCall === call { self.finishSpeech() } }
        } catch {
            if speechCall != nil { finishSpeech("تعذر تشغيل الميكروفون") }
            else { try? AVAudioSession.sharedInstance().setActive(false); call.reject("تعذر تشغيل الميكروفون") }
        }
    }
    private func keychainQuery(_ call: CAPPluginCall) -> [String: Any] {
        let account: String
        switch call.getString("key") {
        case "tv-secrets": account = "tv-secrets"
        case "phone-adb-identity": account = "phone-adb-identity"
        default: account = "account-session"
        }
        return [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.flix.homeremote", kSecAttrAccount as String: account]
    }
    @objc public func saveSession(_ call: CAPPluginCall) {
        guard let value = call.getString("value"), value.utf8.count <= 16384 else { call.reject("جلسة غير صالحة"); return }
        let data = Data(value.utf8)
        let updated = SecItemUpdate(keychainQuery(call) as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if updated == errSecItemNotFound { var query = keychainQuery(call); query[kSecValueData as String] = data; query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly; guard SecItemAdd(query as CFDictionary, nil) == errSecSuccess else { call.reject("تعذر حفظ الجلسة الآمن"); return } }
        else if updated != errSecSuccess { call.reject("تعذر حفظ الجلسة الآمن"); return }
        call.resolve()
    }
    @objc public func readSession(_ call: CAPPluginCall) {
        var query = keychainQuery(call); query[kSecReturnData as String] = true; query[kSecMatchLimit as String] = kSecMatchLimitOne
        var value: CFTypeRef?; let status = SecItemCopyMatching(query as CFDictionary, &value)
        if status == errSecItemNotFound { call.resolve([:]); return }
        guard status == errSecSuccess, let data = value as? Data, let text = String(data: data, encoding: .utf8) else { call.reject("تعذرت قراءة الجلسة؛ سجّل الدخول مجددًا"); return }
        call.resolve(["value": text])
    }
    @objc public func clearSession(_ call: CAPPluginCall) { SecItemDelete(keychainQuery(call) as CFDictionary); call.resolve() }

}

@objc(HomeRemoteViewController)
class HomeRemoteViewController: CAPBridgeViewController {
    override func capacitorDidLoad() { bridge?.registerPluginInstance(HomeDiscoveryPlugin()); bridge?.registerPluginInstance(DirectLanPlugin()); bridge?.registerPluginInstance(DirectAdbPlugin()) }
}

// Direct native phone -> TV transport. This plugin never contacts a desktop hub.
private func directLocal(_ host: String) -> Bool {
    let parts = host.split(separator: ".", omittingEmptySubsequences: false)
    guard parts.count == 4 else { return false }
    var p: [Int] = []
    for text in parts { guard let n = Int(text), n >= 0, n <= 255, String(n) == text else { return false }; p.append(n) }
    return p[0] == 10 || (p[0] == 172 && (16...31).contains(p[1])) || (p[0] == 192 && p[1] == 168) || (p[0] == 169 && p[1] == 254)
}
private final class DirectChannel {
    var tcp: NWConnection?; var ws: URLSessionWebSocketTask?; var session: URLSession?
    let lock = NSLock(); let signal = DispatchSemaphore(value: 0)
    var queue: [String] = []; var buffered = 0; var error = ""; var closed = false
    func receive(_ value: String) { let size = value.utf8.count; lock.lock(); if closed { lock.unlock(); return }; if queue.count >= 256 || size > 1048576 || buffered + size > 4194304 { error = "TV receive buffer exceeded"; lock.unlock(); close(); return }; queue.append(value); buffered += size; lock.unlock(); signal.signal() }
    func end(_ message: String = "") { lock.lock(); closed = true; if !message.isEmpty { error = message }; lock.unlock(); signal.signal() }
    func close() { end(); tcp?.stateUpdateHandler = nil; tcp?.cancel(); ws?.cancel(with: .goingAway, reason: nil); session?.invalidateAndCancel(); tcp = nil; ws = nil; session = nil }

}
private final class DirectSessionDelegate: NSObject, URLSessionWebSocketDelegate {
    let opened: () -> Void; let failed: (String) -> Void
    init(opened: @escaping () -> Void, failed: @escaping (String) -> Void) { self.opened = opened; self.failed = failed }
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) { opened() }
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) { failed("TV WebSocket disconnected") }
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error as NSError? { failed("TV connection failed (\(error.domain):\(error.code))") }
    }
    // Only a validated literal LAN TV IP can reach this delegate. Cloud auth uses normal TLS.
    func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust, directLocal(challenge.protectionSpace.host), let trust = challenge.protectionSpace.serverTrust { completionHandler(.useCredential, URLCredential(trust: trust)) }
        else { completionHandler(.performDefaultHandling, nil) }
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
@objc(DirectLanPlugin)
public class DirectLanPlugin: CAPPlugin, CAPBridgedPlugin, NetServiceBrowserDelegate, NetServiceDelegate {
    public let identifier = "DirectLanPlugin"
    public let jsName = "DirectLan"
    public let pluginMethods: [CAPPluginMethod] = ["discover", "open", "read", "write", "close", "http"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private var channels: [String: DirectChannel] = [:]; private let channelLock = NSLock()
    private let io = DispatchQueue(label: "flix.direct.lan", attributes: .concurrent)
    private var browsers: [NetServiceBrowser] = []; private var services: [NetService] = []
    private var discovered: [[String: Any]] = []; private var discoveryCall: CAPPluginCall?
    private var discoveryDiagnostics: [String: Any] = [:]
    private func channel(_ id: String) -> DirectChannel? { channelLock.lock(); defer { channelLock.unlock() }; return channels[id] }
    private func url(_ value: String, schemes: [String]) -> URL? { guard let u = URL(string: value), let h = u.host, directLocal(h), u.user == nil, u.password == nil, u.fragment == nil, schemes.contains(u.scheme ?? "") else { return nil }; return u }
    @objc public func open(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), UUID(uuidString: id) != nil else { call.reject("Invalid TV channel"); return }
        let c = DirectChannel(); channelLock.lock(); let allowed = channels.count < 8 && channels[id] == nil; if allowed { channels[id] = c }; channelLock.unlock()
        guard allowed else { call.reject("Too many TV connections"); return }
        let stateLock = NSLock(); var settled = false
        let finish: (String?) -> Void = { message in
            stateLock.lock(); let first = !settled; settled = true; stateLock.unlock()
            if let message = message { c.end(message); if first { c.close(); self.channelLock.lock(); self.channels.removeValue(forKey: id); self.channelLock.unlock(); call.reject(message) } }
            else if first { call.resolve() }
        }
        io.asyncAfter(deadline: .now() + 9) { stateLock.lock(); let pending = !settled; stateLock.unlock(); if pending { finish("TV connection timed out") } }
        if call.getString("kind") == "tcp" {
            guard let host = call.getString("host"), directLocal(host), let port = call.getInt("port"), (1024...65535).contains(port), let nwPort = NWEndpoint.Port(rawValue: UInt16(port)) else { finish("Invalid TV address"); return }
            let connection = NWConnection(host: NWEndpoint.Host(host), port: nwPort, using: .tcp); c.tcp = connection
            connection.stateUpdateHandler = { state in switch state { case .ready: finish(nil); self.receiveTcp(c); case .failed: finish("TV TCP connection failed"); case .cancelled: c.end(); default: break } }
            connection.start(queue: io)
        } else {
            guard let u = url(call.getString("url") ?? "", schemes: ["ws", "wss"]) else { finish("LAN TV URL required"); return }
            let delegate = DirectSessionDelegate(opened: { finish(nil) }, failed: { finish($0) })
            let config = URLSessionConfiguration.ephemeral; config.timeoutIntervalForRequest = 8; config.httpCookieStorage = nil
            let session = URLSession(configuration: config, delegate: delegate, delegateQueue: nil); c.session = session
            let task = session.webSocketTask(with: u); task.maximumMessageSize = 4 * 1024 * 1024; c.ws = task; task.resume(); receiveWs(c)
        }
    }
    private func receiveTcp(_ c: DirectChannel) { c.tcp?.receive(minimumIncompleteLength: 1, maximumLength: 65536) { data, _, complete, error in if let data = data, !data.isEmpty { c.receive(data.base64EncodedString()) }; if error != nil { c.end("TV TCP disconnected") } else if complete { c.end() } else { self.receiveTcp(c) } } }
    private func receiveWs(_ c: DirectChannel) { if c.closed { return }; c.ws?.receive { result in switch result { case .success(let m): switch m { case .string(let s): c.receive(s); case .data(let d): if let s = String(data: d, encoding: .utf8) { c.receive(s) }; @unknown default: break }; self.receiveWs(c); case .failure: c.end("TV WebSocket disconnected") } } }
    @objc public func read(_ call: CAPPluginCall) {
        guard let c = channel(call.getString("id") ?? "") else { call.reject("TV channel closed"); return }
        io.async { _ = c.signal.wait(timeout: .now() + 1); c.lock.lock(); let data = c.queue.isEmpty ? nil : c.queue.removeFirst(); if let data = data { c.buffered -= data.utf8.count }; let closed = c.closed && c.queue.isEmpty && data == nil; let error = c.error; c.lock.unlock(); if data == nil && !error.isEmpty { call.reject(error); return }; var result: [String: Any] = ["closed": closed]; if let data = data { result["data"] = data }; call.resolve(result) }
    }
    @objc public func write(_ call: CAPPluginCall) {
        guard let c = channel(call.getString("id") ?? ""), let data = call.getString("data"), data.utf8.count <= 400000 else { call.reject("TV channel or chunk invalid"); return }
        if let tcp = c.tcp { guard let bytes = Data(base64Encoded: data) else { call.reject("Invalid TCP bytes"); return }; tcp.send(content: bytes, completion: .contentProcessed { error in if error != nil { call.reject("TV write failed") } else { call.resolve() } }) }
        else if let ws = c.ws { ws.send(.string(data)) { error in if error != nil { call.reject("TV write failed") } else { call.resolve() } } }
        else { call.reject("TV disconnected") }
    }
    @objc public func close(_ call: CAPPluginCall) { channelLock.lock(); let c = channels.removeValue(forKey: call.getString("id") ?? ""); channelLock.unlock(); c?.close(); call.resolve() }
    @objc public func http(_ call: CAPPluginCall) {
        guard let u = url(call.getString("url") ?? "", schemes: ["http", "https"]) else { call.reject("LAN TV URL required"); return }
        let method = call.getString("method") ?? "GET"; guard ["GET", "POST"].contains(method) else { call.reject("Invalid method"); return }
        var request = URLRequest(url: u); request.httpMethod = method; request.timeoutInterval = 10
        // Bounded streaming delegate prevents a TV icon/description from exhausting phone memory.
        let limited = DirectHttpDelegate(limit: min(4 * 1024 * 1024, max(1, call.getInt("limit") ?? 131072)), call: call)
        let bounded = URLSession(configuration: .ephemeral, delegate: limited, delegateQueue: nil)
        bounded.dataTask(with: request).resume()
    }
    @objc public func discover(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.discoveryCall == nil else { call.reject("البحث جارٍ بالفعل"); return }; self.discoveryCall = call; self.discovered = []; self.services = []; self.discoveryDiagnostics = [:]
            for type in ["_androidtvremote2._tcp.", "_googlecast._tcp.", "_adb._tcp.", "_adb-tls-connect._tcp."] { let browser = NetServiceBrowser(); browser.delegate = self; self.browsers.append(browser); browser.searchForServices(ofType: type, inDomain: "local.") }
            self.io.async { let values = self.ssdp(); DispatchQueue.main.async { if self.discoveryCall === call { self.discovered.append(contentsOf: values) } } }
            // Free Apple accounts cannot sign the restricted multicast entitlement. Read-only
            // unicast service probes keep discovery usable without that entitlement or a relay.
            self.io.async { let fallback = self.unicastDescriptions(); DispatchQueue.main.async { if self.discoveryCall === call { self.discovered.append(contentsOf: fallback.devices); self.discoveryDiagnostics["wifiAvailable"] = fallback.wifi; self.discoveryDiagnostics["fallbackCandidates"] = fallback.devices.count } } }
            DispatchQueue.main.asyncAfter(deadline: .now() + 9.5) { guard self.discoveryCall === call else { return }; self.browsers.forEach { $0.stop() }; self.browsers = []; self.services.forEach { $0.stop() }; self.services = []; self.discoveryCall = nil; call.resolve(["devices": self.discovered, "diagnostics": self.discoveryDiagnostics]) }
        }
    }
    public func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) { guard browsers.contains(browser), discoveryCall != nil else { return }; services.append(service); service.delegate = self; service.resolve(withTimeout: 3) }
    public func netServiceBrowser(_ browser: NetServiceBrowser, didNotSearch errorDict: [String: NSNumber]) { if discoveryCall != nil { discoveryDiagnostics["warnings"] = ["Bonjour unavailable: check Local Network permission in iPhone Settings"] } }
    private func unicastDescriptions() -> (devices: [[String: Any]], wifi: Bool) {
        let monitor = NWPathMonitor(requiredInterfaceType: .wifi), pathReady = DispatchSemaphore(value: 0)
        monitor.pathUpdateHandler = { _ in pathReady.signal() }; monitor.start(queue: io)
        _ = pathReady.wait(timeout: .now() + 1); defer { monitor.cancel() }
        let path = monitor.currentPath
        let names = Set(path.availableInterfaces.filter { $0.type == .wifi }.map { $0.name })
        guard path.status == .satisfied, !names.isEmpty else { return ([], false) }
        var interfaces: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&interfaces) == 0 else { return ([], true) }; defer { freeifaddrs(interfaces) }
        var hosts = Set<String>(); var cursor = interfaces
        while let item = cursor {
            defer { cursor = item.pointee.ifa_next }
            guard names.contains(String(cString: item.pointee.ifa_name)), let address = item.pointee.ifa_addr, address.pointee.sa_family == UInt8(AF_INET), let mask = item.pointee.ifa_netmask else { continue }
            let raw = UnsafeRawPointer(address).assumingMemoryBound(to: sockaddr_in.self).pointee.sin_addr.s_addr
            let rawMask = UnsafeRawPointer(mask).assumingMemoryBound(to: sockaddr_in.self).pointee.sin_addr.s_addr
            let ip = UInt32(bigEndian: raw), netmask = UInt32(bigEndian: rawMask)
            // Limit broad networks to the phone's /24 window; never scan VPN, cellular or public ranges.
            let boundedMask = netmask | 0xffffff00, network = ip & boundedMask, broadcast = network | ~boundedMask
            guard broadcast > network + 1 else { continue }
            for value in (network + 1)..<broadcast where value != ip {
                var v = in_addr(s_addr: value.bigEndian); var buffer = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
                if inet_ntop(AF_INET, &v, &buffer, socklen_t(buffer.count)) != nil { let host = String(cString: buffer); if directLocal(host) { hosts.insert(host) } }
            }
        }
        let endpoints: [(UInt16, String)] = [(1387, "/"), (8001, "/api/v2/"), (8060, "/query/device-info"), (8008, "/ssdp/device-desc.xml")]
        let slots = DispatchSemaphore(value: 64), group = DispatchGroup(), lock = NSLock()
        var result: [[String: Any]] = []; let deadline = DispatchTime.now() + 7
        for host in hosts.sorted().prefix(254) {
            for (port, route) in endpoints {
                if slots.wait(timeout: deadline) == .timedOut { break }
                if DispatchTime.now() >= deadline { slots.signal(); break }
                group.enter()
                let connection = NWConnection(host: NWEndpoint.Host(host), port: NWEndpoint.Port(rawValue: port)!, using: .tcp)
                let stateLock = NSLock(); var finished = false
                let finish: (Bool) -> Void = { ready in
                    stateLock.lock(); if finished { stateLock.unlock(); return }; finished = true; stateLock.unlock()
                    if ready { lock.lock(); result.append(["host": host, "location": "http://\(host):\(port)\(route)"]); lock.unlock() }
                    connection.cancel(); slots.signal(); group.leave()
                }
                connection.stateUpdateHandler = { state in switch state { case .ready: finish(true); case .failed, .cancelled: finish(false); default: break } }
                connection.start(queue: io); io.asyncAfter(deadline: .now() + 0.35) { finish(false) }
            }
        }
        _ = group.wait(timeout: deadline + 0.5); lock.lock(); let snapshot = result; lock.unlock()
        return (snapshot, true)
    }
    public func netServiceDidResolveAddress(_ service: NetService) {
        guard discoveryCall != nil, services.contains(service) else { return }
        for data in service.addresses ?? [] { data.withUnsafeBytes { bytes in guard let p = bytes.baseAddress?.assumingMemoryBound(to: sockaddr.self), p.pointee.sa_family == sa_family_t(AF_INET) else { return }; var name = [CChar](repeating: 0, count: Int(NI_MAXHOST)); guard getnameinfo(p, socklen_t(data.count), &name, socklen_t(name.count), nil, 0, NI_NUMERICHOST) == 0 else { return }; let host = String(cString: name); if directLocal(host) { discovered.append(["host": host, "name": service.name, "platform": "android", "service": service.type, "port": (service.type == "_adb._tcp." || service.type == "_adb-tls-connect._tcp.") ? service.port : 5555]) } } }
    }
    private func ssdp() -> [[String: Any]] {
        let fd = Darwin.socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP); guard fd >= 0 else { return [] }; defer { Darwin.close(fd) }
        var timeout = timeval(tv_sec: 0, tv_usec: 500000); setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &timeout, socklen_t(MemoryLayout<timeval>.size))
        var target = sockaddr_in(); target.sin_len = UInt8(MemoryLayout<sockaddr_in>.size); target.sin_family = sa_family_t(AF_INET); target.sin_port = UInt16(1900).bigEndian; inet_pton(AF_INET, "239.255.255.250", &target.sin_addr)
        let payload = Array("M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n".utf8)
        _ = withUnsafePointer(to: &target) { p in p.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.sendto(fd, payload, payload.count, 0, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) } }
        var result: [[String: Any]] = []; let until = Date().addingTimeInterval(4)
        while Date() < until && result.count < 100 { var source = sockaddr_in(); var size = socklen_t(MemoryLayout<sockaddr_in>.size); var buffer = [UInt8](repeating: 0, count: 8192); let n = withUnsafeMutablePointer(to: &source) { p in p.withMemoryRebound(to: sockaddr.self, capacity: 1) { Darwin.recvfrom(fd, &buffer, 8192, 0, $0, &size) } }; if n <= 0 { continue }; var host = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN)); guard inet_ntop(AF_INET, &source.sin_addr, &host, socklen_t(host.count)) != nil else { continue }; let address = String(cString: host); if directLocal(address), let text = String(bytes: buffer.prefix(n), encoding: .utf8) { result.append(["host": address, "ssdp": text]) } }
        return result
    }
}
private final class DirectHttpDelegate: NSObject, URLSessionDataDelegate {
    let limit: Int; let call: CAPPluginCall; var bytes = Data(); var type = "application/octet-stream"; var rejected = false
    init(limit: Int, call: CAPPluginCall) { self.limit = limit; self.call = call }
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) { guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode), response.expectedContentLength <= Int64(limit) else { rejected = true; call.reject("TV HTTP rejected or too large"); completionHandler(.cancel); return }; type = response.mimeType ?? type; completionHandler(.allow) }
    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) { guard !rejected else { return }; if bytes.count + data.count > limit { rejected = true; dataTask.cancel(); call.reject("TV response too large") } else { bytes.append(data) } }
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) { defer { session.finishTasksAndInvalidate() }; guard !rejected else { return }; if error != nil { call.reject("TV HTTP failed") } else { call.resolve(["data": bytes.base64EncodedString(), "type": type]) } }
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
    func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) { if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust, directLocal(challenge.protectionSpace.host), let trust = challenge.protectionSpace.serverTrust { completionHandler(.useCredential, URLCredential(trust: trust)) } else { completionHandler(.performDefaultHandling, nil) } }
}


@objc(DirectAdbPlugin)
public class DirectAdbPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DirectAdbPlugin"
    public let jsName = "DirectAdb"
    public let pluginMethods: [CAPPluginMethod] = ["pair", "shell", "install"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private func endpoint(_ call: CAPPluginCall) throws -> (String, UInt16) {
        let host = call.getString("host") ?? "", port = call.getInt("port") ?? 0
        guard directLocal(host), port >= 1024, port <= 65535 else { throw NSError(domain: "DirectAdb", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid LAN endpoint"]) }
        return (host, UInt16(port))
    }
    @objc public func pair(_ call: CAPPluginCall) { Task {
        do { let (host, port) = try endpoint(call); let code = call.getString("code") ?? ""
            guard code.range(of: "^[0-9]{6}$", options: .regularExpression) != nil else { call.reject("Enter six digit TV code"); return }
            _ = try await ADBPairing.pair(host: host, port: port, code: code); call.resolve()
        } catch { call.reject("TV pairing failed: verify the current code, pairing port and Wi-Fi") }
    } }
    @objc public func shell(_ call: CAPPluginCall) { Task {
        var client: ADBClient?
        do { let (host, port) = try endpoint(call); let command = call.getString("command") ?? ""
            guard command.utf8.count <= 8192, !command.contains("\0") else { call.reject("Invalid command"); return }
            let connection = try ADBClient(); client = connection; try await connection.connect(host: host, port: port)
            let output = try await connection.shell(command); await connection.disconnect(); call.resolve(["output": output])
        } catch { if let client { await client.disconnect() }; call.reject("ADB TLS: " + error.localizedDescription) }
    } }
    @objc public func install(_ call: CAPPluginCall) { Task {
        var client: ADBClient?; var remote = ""
        do { let (host, port) = try endpoint(call); let id = call.getString("id") ?? ""
            guard id.range(of: "^[a-f0-9-]{36}$", options: .regularExpression) != nil, let uri = call.getString("uri"), let file = URL(string: uri), file.isFileURL else { call.reject("Invalid package"); return }
            let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let expected = documents.appendingPathComponent("packages").appendingPathComponent(id).resolvingSymlinksInPath()
            guard file.resolvingSymlinksInPath() == expected else { call.reject("Invalid private package path"); return }
            let size = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            guard size >= 4, size <= 67108864 else { call.reject("Invalid APK size"); return }
            let data = try Data(contentsOf: file); let hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
            guard hash == call.getString("sha256") else { call.reject("Package hash changed"); return }
            let connection = try ADBClient(); client = connection; try await connection.connect(host: host, port: port)
            remote = "/data/local/tmp/flix-" + id + ".apk"; try await connection.pushFile(from: file, to: remote)
            let output = try await connection.shell("pm install -r " + remote)
            guard output.range(of: "(?m)^Success\\r?$", options: .regularExpression) != nil else { throw NSError(domain: "DirectAdb", code: 2, userInfo: [NSLocalizedDescriptionKey: output]) }
            _ = try? await connection.shell("rm -f " + remote); await connection.disconnect(); call.resolve(["output": output])
        } catch { if let client { if !remote.isEmpty { _ = try? await client.shell("rm -f " + remote) }; await client.disconnect() }; call.reject("APK installation: " + error.localizedDescription) }
    } }
}
