`read-doc` Edge Function (deployed to BINAYATI, verify_jwt = false; checks the caller's session itself).
POST {kind: "receipt" | "transfer", image: base64 JPEG, units?: [{code,name,name_ar,phone}], cats?: [...]}
Returns {ok, fields}. Uses GEMINI_API_KEY; READ_MODEL (or TRANSLATE_MODEL) pins the model, default gemini-3.5-flash-lite.
Photos are stored by the app in the private `receipts` bucket under <building_id>/.
