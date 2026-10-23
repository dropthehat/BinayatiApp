`translate` Edge Function (deployed to BINAYATI, verify_jwt = false; it checks the caller's session itself).
Secrets: GEMINI_API_KEY (used first) or ANTHROPIC_API_KEY. Optional TRANSLATE_MODEL to pin a model.
Default model: gemini-3.5-flash-lite. A GET request returns {provider, model} so you can see what's in use.
