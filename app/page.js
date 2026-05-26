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
  const [conversationMode, setConversationMode] = useState(false);
  const [clock, setClock] = useState("");
  const [activeTool, setActiveTool] = useState(null);
  const [msgCount, setMsgCount] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [waveHeights, setWaveHeights] = useState([12, 20, 28, 20, 12]);

  const recognitionRef = useRef(null);
  const historyEndRef = useRef(null);
  const animFrameRef = useRef(null);
  const waveIntervalRef = useRef(null);
  const sendMessageRef = useRef(null);
  const autoListenRef = useRef(false);
  const conversationModeRef = useRef(false);
  const currentAudioRef = useRef(null);
  const isIOS = useRef(false);

  useEffect(() => {
    isIOS.current = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  }, []);

  useEffect(() => {
    conversationModeRef.current = conversationMode;
    recognitionRef.current = null;
  }, [conversationMode]);

  useEffect(() => {
    const tick = () => setClock(new Date().toTimeString().slice(0, 8));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

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

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const setupRecognition = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    // iOS Safari doesn't support continuous mode reliably
    r.continuous = conversationModeRef.current && !isIOS.current;
    r.interimResults = !isIOS.current; // iOS gives final results only
    r.lang = "en-US";

    let accumulated = "";
    let silenceTimer = null;

    r.onstart = () => { setIsListening(true); setStatus("LISTENING"); accumulated = ""; };

    r.onresult = (evt) => {
      let final = "", interim = "";
      for (let i = evt.resultIndex; i < evt.results.length; i++) {
        const t = evt.results[i][0].transcript;
        if (evt.results[i].isFinal) final += t;
        else interim += t;
      }
      accumulated += final;
      setHeardText(accumulated + interim);

      if (conversationModeRef.current && (final || interim)) {
        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          if (accumulated.trim()) r.stop();
        }, 1800);
      }
      if (!conversationModeRef.current && final) r._final = (r._final || "") + final;
    };

    r.onend = () => {
      setIsListening(false);
      clearTimeout(silenceTimer);
      const text = conversationModeRef.current
        ? accumulated.trim()
        : (r._final || "").trim();
      if (!conversationModeRef.current) r._final = "";
      accumulated = "";
      if (text) sendMessageRef.current?.(text);
    };

    r.onerror = (e) => {
      setIsListening(false);
      clearTimeout(silenceTimer);
      accumulated = "";
      if (e.error === "not-allowed") {
        setHeardText("Mic access denied — check browser settings.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setHeardText(`Mic error: ${e.error}`);
      }
    };
    return r;
  }, []); // eslint-disable-line

  const startListening = useCallback(() => {
    if (!recognitionRef.current) recognitionRef.current = setupRecognition();
    try { recognitionRef.current?.start(); } catch (_) {}
  }, [setupRecognition]);

  function stopSpeaking() {
    autoListenRef.current = false;
    if (currentAudioRef.current) {
      currentAudioRef.current.onended = null;
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if (window.speechSynthesis?.speaking) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  function speakBrowser(clean, onEnd) {
    if (!window.speechSynthesis) { onEnd?.(); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(clean);
    utt.rate = 0.88; utt.pitch = 0.82; utt.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v => v.name.includes("Daniel") || v.name.includes("Google UK English Male"))
      || voices.find(v => v.lang === "en-GB")
      || voices.find(v => v.lang.startsWith("en"));
    if (v) utt.voice = v;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend = () => { setIsSpeaking(false); onEnd?.(); };
    window.speechSynthesis.speak(utt);
  }

  async function speak(text) {
    const clean = text.replace(/#{1,6}\s/g,"").replace(/\*\*/g,"").replace(/\*/g,"").replace(/`/g,"").trim();
    const onEnd = () => {
      if (autoListenRef.current) {
        autoListenRef.current = false;
        setTimeout(() => startListening(), 400);
      }
    };
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudioRef.current = audio;
        setIsSpeaking(true);
        audio.onended = () => {
          currentAudioRef.current = null;
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          onEnd();
        };
        audio.onerror = () => {
          currentAudioRef.current = null;
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          speakBrowser(clean, onEnd);
        };
        await audio.play();
        return;
      }
    } catch (_) {}
    speakBrowser(clean, onEnd);
  }

  const sendMessage = useCallback(async (text) => {
    if (!text?.trim() || isThinking) return;
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

          if (json.type === "chunk") {
            fullText += json.text;
            setResponseText(fullText);
          }
          if (json.type === "done") {
            setActiveTool(null);
            setIsThinking(false);
            setMsgCount(c => c + 1);
            setStatus("STANDBY");
            const finalText = json.text || fullText;
            setResponseText(finalText);
            setHistory(prev => [...prev, { who: "JARVIS", msg: finalText }]);
            if (ttsEnabled) {
              if (conversationModeRef.current && !isIOS.current) autoListenRef.current = true;
              speak(finalText);
            } else if (conversationModeRef.current && !isIOS.current) {
              setTimeout(() => startListening(), 500);
            }
          }
          if (json.type === "thinking") {
            setStatus("PROCESSING...");
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
  }, [isThinking, ttsEnabled, startListening]);

  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  function handleReactorClick() {
    if (!voiceMode) return;
    if (isSpeaking) {
      stopSpeaking();
      setTimeout(() => startListening(), 100);
      return;
    }
    if (isThinking) return;
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      startListening();
    }
  }

  async function handleReset() {
    await fetch("/api/reset", { method: "POST" }).catch(() => {});
    setHistory([]);
    setMsgCount(0);
    setResponseText("Session reset. Ready when you are, sir.");
    if (ttsEnabled) speak("Session reset. Ready when you are, sir.");
  }

  function handleSendText() {
    const t = textInput.trim();
    if (t) { sendMessage(t); setTextInput(""); }
  }

  useEffect(() => {
    const down = (e) => {
      if (e.code === "Space" && voiceMode && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "INPUT") {
        e.preventDefault();
        if (isSpeaking) {
          stopSpeaking();
          setTimeout(() => startListening(), 100);
        } else if (!isThinking && !isListening) {
          startListening();
        }
      }
    };
    const up = (e) => {
      if (e.code === "Space" && isListening && !conversationMode) recognitionRef.current?.stop();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [voiceMode, isThinking, isListening, isSpeaking, conversationMode, startListening]);

  const reactorState = isListening ? "listening" : isThinking ? "thinking" : isSpeaking ? "speaking" : "idle";
  const reactorLabel = isListening ? "LISTENING..." : isThinking ? (activeTool || "PROCESSING...") : isSpeaking ? "TAP TO INTERRUPT" : conversationMode ? "AUTO-LISTEN ON" : "CLICK TO SPEAK";

  return (
    <div className={styles.app}>

      <div className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.label}>SYSTEM</span>
          <span className={styles.value} data-state={reactorState}>{status}</span>
        </div>
        <div className={styles.topbarCenter}>
          <img src="/salvus-logo.png" alt="Salvus AI" style={{ height: 28, marginRight: 10, verticalAlign: "middle", opacity: 0.9 }} />
          J.A.R.V.I.S.
        </div>
        <div className={styles.topbarRight}>
          <span className={styles.label}>TIME</span>
          <span className={styles.value}>{clock}</span>
        </div>
      </div>

      <div className={styles.mainHud}>

        <div className={`${styles.sidePanel} ${styles.leftPanel}`}>
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
              <g transform="translate(150,150)" opacity={isListening ? 0 : 1} style={{ transition: "opacity 0.3s" }}>
                <rect x="-7" y="-16" width="14" height="22" rx="7" fill="none" stroke="#00d4ff" strokeWidth="2"/>
                <path d="M-12,0 Q-12,14 0,14 Q12,14 12,0" fill="none" stroke="#00d4ff" strokeWidth="2"/>
                <line x1="0" y1="14" x2="0" y2="20" stroke="#00d4ff" strokeWidth="2"/>
                <line x1="-6" y1="20" x2="6" y2="20" stroke="#00d4ff" strokeWidth="2"/>
              </g>
              <g transform="translate(150,150)" opacity={isListening ? 1 : 0} style={{ transition: "opacity 0.3s" }}>
                {waveHeights.map((h, i) => (
                  <rect key={i} x={-30 + i*12} y={-h/2} width="8" height={h} rx="2" fill="#00d4ff"/>
                ))}
              </g>
            </svg>
            <div className={styles.reactorLabel}>{reactorLabel}</div>
          </div>
          <div className={styles.heardText}>{heardText || " "}</div>
        </div>

        <div className={`${styles.sidePanel} ${styles.rightPanel}`}>
          <div className={styles.panelBlock}>
            <div className={styles.panelLabel}>INPUT MODE</div>
            <div className={styles.modeRow}>
              <button className={`${styles.modeBtn} ${voiceMode ? styles.modeBtnActive : ""}`} onClick={() => setVoiceMode(true)}>VOICE</button>
              <button className={`${styles.modeBtn} ${!voiceMode ? styles.modeBtnActive : ""}`} onClick={() => setVoiceMode(false)}>TEXT</button>
            </div>
            {voiceMode && (
              <div style={{marginTop:10}}>
                <div className={styles.panelLabel}>CONVERSATION</div>
                <div className={styles.toggleRow}>
                  <span style={{fontSize:"0.65rem"}}>AUTO-LISTEN</span>
                  <label className={styles.toggle}>
                    <input type="checkbox" checked={conversationMode} onChange={e => setConversationMode(e.target.checked)}/>
                    <span className={styles.slider}/>
                  </label>
                </div>
                {conversationMode && (
                  <div style={{marginTop:8}}>
                    <button
                      className={styles.hudBtn}
                      onClick={() => { if (!isListening && !isThinking && !isSpeaking) startListening(); }}
                    >
                      {isListening ? "LISTENING..." : isSpeaking ? "JARVIS SPEAKING" : "START TALKING"}
                    </button>
                    <div style={{fontSize:"0.58rem", opacity:0.5, marginTop:6, letterSpacing:"0.08em", textAlign:"center"}}>
                      SPEAK NATURALLY · PAUSES AUTO-SEND
                    </div>
                  </div>
                )}
              </div>
            )}
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
            <div className={styles.panelValue} style={{marginTop:12, fontSize:"0.65rem", opacity:0.7, letterSpacing:"0.1em"}}>ELEVENLABS · BRITISH MALE</div>
          </div>
        </div>

      </div>

      <div className={styles.responseArea}>
        <div className={styles.responseLabel}>RESPONSE</div>
        <div className={`${styles.responseText} ${isThinking && !responseText ? styles.blinking : ""}`}>
          {responseText || (isThinking ? "" : "Awaiting input...")}
        </div>
      </div>

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
