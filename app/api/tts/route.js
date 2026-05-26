export async function POST(req) {
  const { text } = await req.json();
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return Response.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 503 });
  }

  // George — deep British male, closest to Marvel JARVIS
  const voiceId = 'JBFqnCBsd6RMkjVDRZzb';

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.75,
        style: 0.35,
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return Response.json({ error: err }, { status: 500 });
  }

  const audio = await res.arrayBuffer();
  return new Response(audio, {
    headers: { 'Content-Type': 'audio/mpeg' },
  });
}
