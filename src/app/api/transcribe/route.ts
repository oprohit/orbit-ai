import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { audio, mimeType } = body;

    if (!audio) {
      return NextResponse.json({ ok: false, error: "No audio provided" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    // Call Gemini with multimodal audio input
    const cleanMime = mimeType ? mimeType.split(";")[0] : "audio/webm";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: cleanMime,
                    data: audio,
                  },
                },
                {
                  text: "Transcribe the user's spoken voice command verbatim into plain English. Output ONLY the exact transcribed words without quotes, markdown, or commentary. If silence or no speech, output empty string.",
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Gemini transcribe error:", err);
      return NextResponse.json({ ok: false, error: "Transcription upstream failed" }, { status: 502 });
    }

    const data = await res.json();
    const rawTranscript = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const transcript = rawTranscript.replace(/^["']|["']$/g, "").trim();

    return NextResponse.json({ ok: true, transcript });
  } catch (err: any) {
    console.error("Transcribe route error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
