`write-reminder` Edge Function (BINAYATI, verify_jwt = false; checks the caller's session itself).
POST {tone: gentle|warm|firm|thanks, lang: ar|en|both, building, unit, name, month, items[], left, arrears, monthsBehind, payTo}
Returns {ok, text}. The app rejects any text whose amounts differ from `left`, and appends the resident link itself.
Uses GEMINI_API_KEY; WRITE_MODEL (or TRANSLATE_MODEL) pins the model, default gemini-3.5-flash-lite.
