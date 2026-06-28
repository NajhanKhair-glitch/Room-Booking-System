#!/usr/bin/env python3
"""Generate the BSU Terms & Conditions PDF (stdlib only, no deps)."""
import textwrap, os

W, H = 595, 842
LEFT, BOT, TOP = 60, 70, 792

# (style, text)
BLOCKS = [
    ('title',    'TERMS OF USE FOR SPACES AND PHYSICAL FACILITIES'),
    ('subtitle', 'UNIVERSITI TEKNOLOGI MARA (UiTM) CAWANGAN PERAK, KAMPUS TAPAH'),
    ('small',    'Bahagian Sumber & Umum (BSU)  -  BSU Space Booking System'),
    ('gap', ''),
    ('body',     'All users are required to adhere to the rules that have been outlined below.'),
    ('gap', ''),
    ('heading',  'A.  GENERAL TERMS OF USE FOR ALL BOOKABLE SPACES'),
    ('item', '1.  All equipment including chairs, tables, rostrums and PA system that are made available in the booked space cannot be moved out of that space.'),
    ('item', '2.  Food or drinks are not allowed inside the booked space unless permission has been obtained from the space administrator.'),
    ('item', '3.  The space administrator is only responsible for providing the space and basic facilities. Any other requirement needs to be specifically requested from the relevant provider.'),
    ('item', '4.  The space administrator is not responsible for the safety of equipment borrowed from other departments or providers.'),
    ('item', '5.  Permission for the usage of an external PA system must first be obtained from the space administrator. Consideration will only be given if it is relevant to the event/activity.'),
    ('item', '6.  Users are responsible for:'),
    ('sub',  'a)  Managing and arranging any requirement relevant to the event/activity such as chairs and tables for registration and refreshment, traffic control and signboards from the campus Security Office, backdrop, and other requirements as allowed by UiTM.'),
    ('sub',  'b)  Ensuring that all lights and air-conditioners are switched off before leaving the space.'),
    ('sub',  'c)  Ensuring that the projector and computers are switched off and in good condition before leaving the space.'),
    ('sub',  'd)  Returning the space in a clean and tidy condition after use.'),
    ('gap', ''),
    ('heading',  'B.  BOOKING & APPROVAL'),
    ('item', '7.  Reservation requests are subject to approval by the space moderator (BSU approving officer).'),
    ('item', '8.  Any cancellation or change of date/time for an approved program must be informed to the BSU moderator for status update.'),
    ('item', '9.  The space is open for booking up to 180 days prior to the event and closes 2 days before the booking date.'),
    ('item', '10. Maximum reservation is 5 days per reservation; the minimum booking is 1 hour per date.'),
    ('gap', ''),
    ('heading',  'C.  PAYMENT'),
    ('item', '11. Payment must be completed online (FPX / eWallet / Card) to confirm the reservation.'),
    ('item', '12. Cleaning service charges (where applicable) are billed separately and paid to the cleaning crew.'),
    ('item', '13. Prices shown do not include technician charges or equipment reservation cost.'),
    ('gap', ''),
    ('heading',  'D.  CLEANLINESS & RESPONSIBILITY'),
    ('item', '14. Users must keep the space clean and tidy throughout the usage period.'),
    ('item', '15. Users must ensure no documents or items are left behind after use.'),
    ('item', '16. Users are liable for any damage caused to the space or its facilities during the booking period.'),
    ('gap', ''),
    ('small',    'Bahagian Sumber & Umum (BSU), UiTM Cawangan Perak Kampus Tapah   -   Ref: BSU-TOU-2026'),
]

STYLE = {
    # style:   (font, size, leading, space_after, align, indent, wrapchars)
    'title':    ('F2', 14, 18, 10, 'center', 0,  58),
    'subtitle': ('F2', 10, 14, 3,  'center', 0,  78),
    'small':    ('F1', 9,  12, 3,  'center', 0,  92),
    'heading':  ('F2', 11, 16, 6,  'left',   0,  76),
    'body':     ('F1', 10, 14, 4,  'left',   0,  92),
    'item':     ('F1', 10, 14, 5,  'left',   0,  92),
    'sub':      ('F1', 10, 14, 3,  'left',   22, 86),
    'gap':      ('F1', 10, 7,  0,  'left',   0,  92),
}

def esc(s):
    return s.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

def char_w(size):
    return size * 0.5  # rough Helvetica avg

# ---- Lay out into pages ----
pages = []
cur = []
y = TOP

def new_page():
    global cur, y
    if cur:
        pages.append(cur)
    cur = []
    y = TOP

for style, text in BLOCKS:
    font, size, lead, after, align, indent, wrapn = STYLE[style]
    if text == '':
        y -= lead
        continue
    lines = textwrap.wrap(text, wrapn) or ['']
    for ln in lines:
        if y - lead < BOT:
            new_page()
        if align == 'center':
            w = len(ln) * char_w(size)
            x = (W - w) / 2.0
        else:
            x = LEFT + indent
        cur.append((font, size, x, y, ln))
        y -= lead
    y -= after
if cur:
    pages.append(cur)

# ---- Build content streams ----
def content_for(page):
    out = []
    for font, size, x, y, ln in page:
        out.append(f"BT /{font} {size} Tf 1 0 0 1 {x:.2f} {y:.2f} Tm ({esc(ln)}) Tj ET")
    return "\n".join(out).encode('latin-1', 'replace')

# ---- Assemble PDF objects ----
objs = {}
# 1 Catalog, 2 Pages, 3 F1, 4 F2, then per page: page obj + content obj
objs[3] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
objs[4] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"

page_obj_nums = []
next_num = 5
for page in pages:
    page_num = next_num
    content_num = next_num + 1
    next_num += 2
    page_obj_nums.append(page_num)
    stream = content_for(page)
    objs[content_num] = b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream)
    objs[page_num] = (
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] "
        b"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> "
        b"/Contents %d 0 R >>" % (W, H, content_num)
    )

kids = b" ".join(b"%d 0 R" % n for n in page_obj_nums)
objs[2] = b"<< /Type /Pages /Kids [%s] /Count %d >>" % (kids, len(page_obj_nums))
objs[1] = b"<< /Type /Catalog /Pages 2 0 R >>"

# ---- Serialize with xref ----
buf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
offsets = {}
for num in sorted(objs.keys()):
    offsets[num] = len(buf)
    buf += b"%d 0 obj\n" % num + objs[num] + b"\nendobj\n"

xref_pos = len(buf)
n_objs = max(objs.keys()) + 1
buf += b"xref\n0 %d\n" % n_objs
buf += b"0000000000 65535 f \n"
for num in range(1, n_objs):
    if num in offsets:
        buf += b"%010d 00000 n \n" % offsets[num]
    else:
        buf += b"0000000000 65535 f \n"
buf += b"trailer\n<< /Size %d /Root 1 0 R >>\n" % n_objs
buf += b"startxref\n%d\n%%%%EOF" % xref_pos

out_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'terms_conditions.pdf')
out_path = os.path.abspath(out_path)
with open(out_path, 'wb') as f:
    f.write(buf)
print("Wrote", out_path, "(%d bytes, %d pages)" % (len(buf), len(pages)))
