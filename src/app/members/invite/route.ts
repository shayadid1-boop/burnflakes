import { NextResponse } from "next/server";
import { requireMember } from "@/lib/auth";

/** Build a calendar invite (.ics) for the people picked on the "send to members" screen. Admin only. */
export async function GET(req: Request) {
  const me = await requireMember();
  if (me.role !== "admin") return new NextResponse("admin only", { status: 403 });

  const q = new URL(req.url).searchParams;
  const title = (q.get("title") ?? "").trim() || "פגישת ברנפלקס";
  const desc = (q.get("desc") ?? "").trim();
  const place = (q.get("place") ?? "").trim();
  const start = q.get("start") ?? "";                       // "2026-10-20T19:00" — local time as typed
  const minutes = Math.max(15, Number(q.get("minutes") || 60));
  const to = (q.get("to") ?? "").split(",").map((e) => e.trim()).filter(Boolean);

  const startDate = new Date(start);
  if (!start || Number.isNaN(startDate.getTime())) return new NextResponse("bad start time", { status: 400 });
  const endDate = new Date(startDate.getTime() + minutes * 60_000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  // a calendar line may not exceed 75 octets, and newlines inside a value must be escaped
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[;,]/g, (m) => "\\" + m).replace(/\r?\n/g, "\\n");
  const fold = (line: string) => line.match(/.{1,73}/g)?.join("\r\n ") ?? line;

  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Burnflakes//shifts//HE", "CALSCALE:GREGORIAN", "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@burnflakes`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(startDate)}`,
    `DTEND:${stamp(endDate)}`,
    fold(`SUMMARY:${esc(title)}`),
    ...(desc ? [fold(`DESCRIPTION:${esc(desc)}`)] : []),
    ...(place ? [fold(`LOCATION:${esc(place)}`)] : []),
    ...(me.userEmail ? [`ORGANIZER;CN=${esc(me.firstName ?? "ברנפלקס")}:mailto:${me.userEmail}`] : []),
    ...to.map((e) => fold(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${e}`)),
    "END:VEVENT", "END:VCALENDAR",
  ];

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="burnflakes-invite.ics"`,
    },
  });
}
