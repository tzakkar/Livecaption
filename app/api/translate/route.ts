import { NextResponse } from "next/server";

const DEEPL_FREE_URL = "https://api-free.deepl.com/v2/translate";
const DEEPL_PRO_URL = "https://api.deepl.com/v2/translate";

/** Map our language codes to DeepL target_lang (uppercase two-letter; DeepL supports EN, DE, FR, etc.) */
function toDeepLLang(code: string): string {
  return code.length >= 2 ? code.slice(0, 2).toUpperCase() : code.toUpperCase();
}

export async function GET() {
  const provider = process.env.TRANSLATION_API_PROVIDER;
  const deeplKey = process.env.DEEPL_API_KEY;
  const available =
    (provider === "deepl" && !!deeplKey) ||
    (provider === "google" && !!process.env.GOOGLE_TRANSLATE_API_KEY);
  return NextResponse.json({
    available: !!available,
    provider: available ? provider : undefined,
  });
}

export async function POST(request: Request) {
  const provider = process.env.TRANSLATION_API_PROVIDER;
  const deeplKey = process.env.DEEPL_API_KEY;

  if (provider === "deepl" && deeplKey) {
    try {
      const body = await request.json();
      const { sourceLanguage, targetLanguage, text } = body as {
        sourceLanguage?: string;
        targetLanguage?: string;
        text?: string;
      };
      if (!targetLanguage || typeof text !== "string") {
        return NextResponse.json(
          { error: "Missing targetLanguage or text" },
          { status: 400 }
        );
      }
      const trimmed = String(text).trim();
      if (!trimmed) {
        return NextResponse.json({ translatedText: "" });
      }

      const targetLang = toDeepLLang(targetLanguage);
      const sourceLang = sourceLanguage ? toDeepLLang(sourceLanguage) : undefined;
      const isFree = deeplKey.endsWith(":fx");
      const url = isFree ? DEEPL_FREE_URL : DEEPL_PRO_URL;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `DeepL-Auth-Key ${deeplKey}`,
        },
        body: JSON.stringify({
          text: [trimmed],
          target_lang: targetLang,
          ...(sourceLang && { source_lang: sourceLang }),
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("DeepL API error:", res.status, errText);
        return NextResponse.json(
          { error: `Translation failed: ${res.status}` },
          { status: 502 }
        );
      }

      const data = (await res.json()) as {
        translations?: Array<{ text?: string }>;
      };
      const translatedText =
        data.translations?.[0]?.text ?? trimmed;
      return NextResponse.json({ translatedText });
    } catch (e) {
      console.error("Translate API error:", e);
      return NextResponse.json(
        { error: "Translation request failed" },
        { status: 500 }
      );
    }
  }

  if (provider === "google" && process.env.GOOGLE_TRANSLATE_API_KEY) {
    // Optional: add Google Cloud Translation API here
    return NextResponse.json(
      { error: "Google Translate not implemented yet" },
      { status: 501 }
    );
  }

  return NextResponse.json(
    { error: "Translation API not configured. Set TRANSLATION_API_PROVIDER and API key." },
    { status: 503 }
  );
}
