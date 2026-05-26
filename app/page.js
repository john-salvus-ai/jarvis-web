"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./page.module.css";

const CAPABILITIES = [
  ["web",       "WEB SEARCH"],
  ["scrape",    "WEB SCRAPE"],
  ["github",    "GITHUB"],
  ["stripe",    "STRIPE"],
  ["supabase",  "SUPABASE"],
  ["spotify",   "SPOTIFY"],
  ["gmail",     "GMAIL"],
  ["calendar",  "CALENDAR"],
  ["quickbooks","QUICKBOOKS"],
  ["shopify",   "SHOPIFY"],
  ["hubspot",   "HUBSPOT"],
  ["clickup",   "CLICKUP"],
  ["atlassian", "JIRA / CONFLUENCE"],
  ["datadog",   "DATADOG"],
  ["sentry",    "SENTRY"],
  ["figma",     "FIGMA"],
  ["vercel",    "VERCEL"],
  ["klaviyo",   "KLAVIYO"],
  ["memory",    "MEMORY"],
  ["files",     "FILESYSTEM"],
];

export default function JarvisPage() {
  const [status, setStatus] = useState("STANDBY");
  const [responseText, setResponseText] = useState("Good day, sir. All systems operational. How may I assist you?");
  const [heardText, setHeardText] = useState("");
  const [history, setHistory] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true);
  const [textInput, setTextInput] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [rate, setRate] = useState(0.9);
  const [pitch, setPitch] = useState(0.85);
  const [clock, setClock] = useState("");
  const [activeTool, setActiveTool] = useState(null);
  const [msgCount, setMsgCount] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [waveHeights, setWaveHeights] = useState([12, 20, 28, 20, 12]);

  const recognitionRef = useRef(null);
  const historyEndRef = useRef(null);
  const animFrameRef = useRef(null);
  const waveIntervalRef = useRef(null);

  // Clock
  useEffect(() => {
    const tick = () => setClock(new Date().toTimeString().slice(0, 8));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Reactor rotation
  useEffect(() => {
    let angle = 0;
    const animate = () => {
      angle = (angle + 0.3) % 360;
      setRotation(angle);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  // Waveform
  useEffect(() => {
    if (isListening) {
      waveIntervalRef.current = setInterval(() => {
        setWaveHeights([12,20,28,20,12].map(h => h * (0.3 + Math.random() * 0.7)));
      }, 100);
    } else {
      clearInterval(waveIntervalRef.current);
      setWaveHeights([12, 20, 28, 20, 12]);
    }
    return () => clearInterval(waveIntervalRef.current);
  }, [isListening]);

  // Auto-scroll history
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  // Speech recognition setup
  const setupRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.continuous = false;
    r.interimResults = true;
    r.lang = "en-US";

    r.onstart = () => { setIsListening(true); setStatus("LISTENING"); };
    r.onresult = (evt) => {
      let interim = "", final = "";
      for (let i = evt.resultIndex; i < evt.results.length; i++) {
        const t = evt.results[i][0].transcript;
        if (evt.results[i].isFinal) final += t;
        else interim += t;
      }
      setHeardText(final || interim);
      if (final) r._final = final;
    };
    r.onend = () => {
      setIsListening(false);
      const t = r._final;
      r._final = "";
      if (t) sendMessage(t);
    };
    r.onerror = (e) => {
      setIsListening(false);
      if (e.error !== "no-speech") setHeardText(`Error: ${e.error}`);
    };
    return r;
  }, []); // eslint-disable-line

  // Send message to API
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isThinking) return;
    setIsThinking(true);
    setStatus("THINKING");
    setResponseText("");
    setHeardText("");
    setActiveTool(null);

    setHistory(prev => [...prev, { who: "YOU", msg: text }]);

    let fullText = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = JSON.parse(line.slice(6));

          if (json.type === "text") {
            fullText += json.text;
            setResponseText(fullText);
          }
          if (json.type === "tool") {
            setActiveTool(TOOL_LABELS[json.name] || json.name.toUpperCase());
            setStatus("EXECUTING");
          }
          if (json.type === "done") {
            setActiveTool(null);
            setIsThinking(false);
            setMsgCount(c => c + 1);
            setStatus("STANDBY");
            setHistory(prev => [...prev, { who: "JARVIS", msg: json.text || fullText }]);
            if (ttsEnabled) speak(json.text || fullText, rate, pitch);
          }
          if (json.type === "error") {
            setResponseText(`Error: ${json.message}`);
            setIsThinking(false);
            setStatus("ERROR");
          }
        }
      }
    } catch (err) {
      setResponseText(`Connection error: ${err.message}`);
      setIsThinking(false);
      setStatus("ERROR");
    }
  }, [isThinking, ttsEnabled, rate, pitch]);

  function speak(text, r, p) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/#{1,6}\s/g,"").replace(/\*\*/g,"").replace(/\*/g,"").replace(/`/g,"").trim();
    const utt = new SpeechSynthesisUtterance(clean);
    utt.rate = r; utt.pitch = p; utt.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v => v.name.includes("Daniel") || v.name.includes("Google UK English Male"))
      || voices.find(v => v.lang === "en-GB")
      || voices.find(v => v.lang.startsWith("en"));
    if (v) utt.voice = v;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utt);
  }

  function handleReactorClick() {
    if (!voiceMode || isThinking) return;
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (!recognitionRef.current) recognitionRef.current = setupRecognition();
      try { recognitionRef.current?.start(); } catch (_) {}
    }
  }

  async function handleReset() {
    await fetch("/api/reset", { method: "POST" }).catch(() => {});
    setHistory([]);
    setMsgCount(0);
    setResponseText("Session reset. Ready when you are, sir.");
    if (ttsEnabled) speak("Session reset. Ready when you are, sir.", rate, pitch);
  }

  function handleSendText() {
    const t = textInput.trim();
    if (t) { sendMessage(t); setTextInput(""); }
  }

  // Spacebar PTT
  useEffect(() => {
    const down = (e) => {
      if (e.code === "Space" && voiceMode && !isThinking && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "INPUT") {
        e.preventDefault();
        if (!isListening) {
          if (!recognitionRef.current) recognitionRef.current = setupRecognition();
          try { recognitionRef.current?.start(); } catch (_) {}
        }
      }
    };
    const up = (e) => {
      if (e.code === "Space" && isListening) recognitionRef.current?.stop();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [voiceMode, isThinking, isListening, setupRecognition]);

  const reactorState = isListening ? "listening" : isThinking ? "thinking" : isSpeaking ? "speaking" : "idle";

  return (
    <div className={styles.app}>

      {/* Top bar */}
      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.label}>SYSTEM</span>
          <span className={styles.value} data-state={reactorState}>{status}</span>
        </div>
        <div className={styles.topbarCenter}>J.A.R.V.I.S.</div>
        <div className={styles.topbarRight}>
          <span className={styles.label}>TIME</span>
          <span className={styles.value}>{clock}</span>
        </div>
      </div>

      {/* Main HUD */}
      <div className={styles.mainHud}>

        {/* Left panel */}
        <div className={styles.sidePanel}>
          <div className={styles.panelBlock}>
            <div className={styles.panelLabel}>CAPABILITIES</div>
            <div className={styles.capList}>
              {CAPABILITIES.map(([k,l]) => (
                <div key={k} className={`${styles.capItem} ${activeTool ? styles.capActive : ""}`}>
                  <div className={styles.capDot} />
                  <span>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.panelBlock}>
            <div className={styles.panelLabel}>SESSION</div>
            <div className={styles.panelValue}>{msgCount} exchange{msgCount !== 1 ? "s" : ""}</div>
            <button className={styles.hudBtn} onClick={handleReset}>RESET SESSION</button>
          </div>
        </div>

        {/* Center */}
        <div className={styles.centerHud}>
          <div className={styles.reactorWrap} onClick={handleReactorClick}>
            <svg viewBox="0 0 300 300" className={`${styles.reactorSvg} ${styles[reactorState]}`}>
              <circle cx="150" cy="150" r="145" fill="none" stroke="#0077aa" strokeWidth="1" opacity="0.6"/>
              <circle cx="150" cy="150" r="135" fill="none" stroke="#0077aa" strokeWidth="1" strokeDasharray="4 8" opacity="0.3"/>
              <circle cx="150" cy="150" r="120" fill="none" stroke="#00d4ff" strokeWidth="1" opacity="0.4"/>
              <circle cx="150" cy="150" r="108" fill="none" stroke="#00d4ff" strokeWidth="2" strokeDasharray="60 280"
                style={{ transformOrigin: "150px 150px", transform: `rotate(${rotation}deg)` }} opacity="0.8"/>
              <circle cx="150" cy="150" r="96" fill="none" stroke="#1a6fff" strokeWidth="1.5" strokeDasharray="30 200"
                style={{ transformOrigin: "150px 150px", transform: `rotate(${-rotation * 0.66}deg)` }} opacity="0.6"/>
              <circle cx="150" cy="150" r="82" fill="none" stroke="#0077aa" strokeWidth="1" opacity="0.5"/>
              <circle cx="150" cy="150" r="68" fill="none" stroke="#00d4ff" strokeWidth="6" opacity="0.12"/>
              <polygon points="150,90 176,105 176,135 150,150 124,135 124,105" fill="rgba(0,212,255,0.04)" stroke="#00d4ff" strokeWidth="0.5" opacity="0.4"/>
              <circle cx="150" cy="150" r="38" fill="#000a1a" stroke="#00d4ff" strokeWidth="1.5" opacity="0.9"/>
              <circle cx="150" cy="150" r="28" fill="rgba(0,60,120,0.3)" stroke="#00d4ff" strokeWidth="0.5" opacity="0.6"/>
              <polyline points="10,10 10,30 30,30" fill="none" stroke="#00d4ff" strokeWidth="1.5" opacity="0.5"/>
              <polyline points="290,10 290,30 270,30" fill="none" stroke="#00d4ff" strokeWidth="1.5" opacity="0.5"/>
              <polyline points="10,290 10,270 30,270" fill="none" stroke="#00d4ff" strokeWidth="1.5" opacity="0.5"/>
              <polyline points="290,290 290,270 270,270" fill="none" stroke="#00d4ff" strokeWidth="1.5" opacity="0.5"/>

              {/* Mic icon */}
              <g transform="translate(150,150)" opacity={isListening ? 0 : 1} style={{ transition: "opacity 0.3s" }}>
                <rect x="-7" y="-16" width="14" height="22" rx="7" fill="none" stroke="#00d4ff" strokeWidth="2"/>
                <path d="M-12,0 Q-12,14 0,14 Q12,14 12,0" fill="none" stroke="#00d4ff" strokeWidth="2"/>
                <line x1="0" y1="14" x2="0" y2="20" stroke="#00d4ff" strokeWidth="2"/>
                <line x1="-6" y1="20" x2="6" y2="20" stroke="#00d4ff" strokeWidth="2"/>
              </g>

              {/* Waveform */}
              <g transform="translate(150,150)" opacity={isListening ? 1 : 0} style={{ transition: "opacity 0.3s" }}>
                {waveHeights.map((h, i) => (
                  <rect key={i} x={-30 + i*12} y={-h/2} width="8" height={h} rx="2" fill="#00d4ff"/>
                ))}
              </g>
            </svg>
            <div className={styles.reactorLabel}>
              {isListening ? "LISTENING..." : isThinking ? (activeTool || "PROCESSING...") : "CLICK TO SPEAK"}
            </div>
          </div>
          <div className={styles.heardText}>{heardText || " "}</div>
        </div>

        {/* Right panel */}
        <div className={styles.sidePanel}>
          <div className={styles.panelBlock}>
            <div className={styles.panelLabel}>INPUT MODE</div>
            <div className={styles.modeRow}>
              <button className={`${styles.modeBtn} ${voiceMode ? styles.modeBtnActive : ""}`} onClick={() => setVoiceMode(true)}>VOICE</button>
              <button className={`${styles.modeBtn} ${!voiceMode ? styles.modeBtnActive : ""}`} onClick={() => setVoiceMode(false)}>TEXT</button>
            </div>
            {!voiceMode && (
              <div>
                <textarea
                  className={styles.textInput}
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
                  placeholder="Type a command..."
                  rows={3}
                />
                <button className={styles.hudBtn} onClick={handleSendText}>SEND</button>
              </div>
            )}
          </div>
          <div className={styles.panelBlock}>
            <div className={styles.panelLabel}>VOICE OUTPUT</div>
            <div className={styles.toggleRow}>
              <span>SPEECH</span>
              <label className={styles.toggle}>
                <input type="checkbox" checked={ttsEnabled} onChange={e => setTtsEnabled(e.target.checked)}/>
                <span className={styles.slider}/>
              </label>
            </div>
            <div className={styles.panelLabel} style={{marginTop:12}}>RATE</div>
            <input type="range" min="0.5" max="1.5" step="0.05" value={rate} onChange={e => setRate(+e.target.value)} className={styles.hudSlider}/>
            <div className={styles.panelLabel} style={{marginTop:8}}>PITCH</div>
            <input type="range" min="0.5" max="1.5" step="0.05" value={pitch} onChange={e => setPitch(+e.target.value)} className={styles.hudSlider}/>
          </div>
        </div>

      </div>

      {/* Response */}
      <div className={styles.responseArea}>
        <div className={styles.responseLabel}>RESPONSE</div>
        <div className={`${styles.responseText} ${isThinking && !responseText ? styles.blinking : ""}`}>
          {responseText || (isThinking ? "" : "Awaiting input...")}
        </div>
      </div>

      {/* History */}
      <div className={styles.historyArea}>
        <div className={styles.historyLabel}>INTERACTION LOG</div>
        <div className={styles.historyLog}>
          {history.map((e, i) => (
            <div key={i} className={`${styles.historyEntry} ${e.who === "YOU" ? styles.userEntry : styles.jarvisEntry}`}>
              <span className={styles.who}>{e.who}</span>
              <span className={styles.histMsg}>{e.msg.slice(0, 300)}{e.msg.length > 300 ? "..." : ""}</span>
            </div>
          ))}
          <div ref={historyEndRef}/>
        </div>
      </div>

    </div>
  );
}
