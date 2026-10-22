# Binayati V15

One file, `index.html`. It is already connected to your Supabase project **BINAYATI**, and the database (tables, security rules, audit log, functions) is installed there.

## Before the first sign-up (2 minutes)
1. Supabase → **Authentication → Sign In / Providers → Email** → turn **off "Confirm email"**.
   Accounts use a username and password (no real email address), so confirmation emails would bounce.
2. Host `index.html` somewhere with a public address, for example GitHub Pages or Netlify Drop.
   Residents' links and invites point to wherever the file lives. If the address differs from where you open it, put it in `publicUrl` at the top of the file.

## Who does what
| Role | Gets in by | Can |
|---|---|---|
| Manager | Creates the building | Everything |
| Co-manager | Invite link | Everything except removing people |
| Collector (Natour, concierge, neighbour) | Invite link | Tick payments as cash in their pocket, log cash they spent, hand over, tick tasks |
| Resident | Private link in their WhatsApp bill | See their bill, receipts, balance and (if you allow) the building's books. No login |

## How the money works
- **Collected** means money that came in for a charge, whoever holds it.
- **With the collector** means cash ticked by the collector that has not been handed over yet.
- **In the safe** = opening balance + money paid to a manager or by transfer + confirmed handovers − expenses.
- **Supplier services** (moteur, internet) are collected per subscriber and shown as "held for suppliers" until you record paying them.
- **Arrears** carry over automatically: anything unpaid from an earlier month shows on the apartment's card and bill.
- **Shares** let a bigger apartment or a shop carry more or less of a split bill.

## Files
- `index.html` connects to your Supabase project.
- `local.html` is the same app, saving to the phone only. Use it for demos.
- `schema.sql` is the full database setup, already applied. Keep it to rebuild the project elsewhere.
