# Rellena la plantilla oficial "Application Material (for Enterprise Developers) V3.1" de Huawei
# Health Service Kit con los datos de HomeTest (desarrollador individual; mismos datos que
# build_material.py) y pega la captura de la pantalla Today.
#   python docs/huawei/fill_enterprise_form.py  ->  HomeTest_HealthServiceKit_Application_Form_V3.1.pdf
from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).parent
OUT = HERE / "HomeTest_HealthServiceKit_Application_Form_V3.1.pdf"

# --- Captura: Today (arriba y "Daily readiness") lado a lado, con una nota ---
shots = [Image.open(HERE / f) for f in ("today_1.jpg", "today_2.jpg")]
gap, pad, note_h = 24, 24, 110
w = sum(s.width for s in shots) + gap + 2 * pad
h = max(s.height for s in shots) + 2 * pad + note_h
canvas = Image.new("RGB", (w, h), "white")
x = pad
for s in shots:
    canvas.paste(s, (x, pad))
    x += s.width + gap
draw = ImageDraw.Draw(canvas)
try:
    font = ImageFont.truetype("arial.ttf", 17)
except OSError:
    font = ImageFont.load_default()
note = (
    "HomeTest app (Android), Today screen, demo with sample data. Steps and active calories feed the\n"
    "daily activity rings; distance completes the activity summary. Only steps, calories and distance are\n"
    "requested from Huawei Health (read-only). Sleep and heart-rate values in the mock-up come from\n"
    "other sources (e.g. Android Health Connect); they are not requested in this application."
)
draw.multiline_text((pad, h - note_h + 8), note, fill="black", font=font, spacing=6)
screenshot = HERE / "today_screenshot.png"
canvas.save(screenshot)

# --- Textos ---
T = {
    # 1. Data Usage
    "Examples": "Read step count data.\n\nRead calories burned (active energy) data.\n\nRead distance data.\n\nHistorical data: one month (read-only).\n\nNo write permissions.",
    "Data usage scenarios and requirementsRow1": (
        "After the user connects Huawei Health from the Wearables screen and authorises access, the app reads "
        "daily totals of steps, active calories and distance and shows them in the user's own dashboard: "
        "activity rings on the Today screen and 14-day / 1-month trends in My Data. Classified by day. "
        "On first connection, up to the previous month is read so the charts are not empty."
    ),
    "Data Usage PurposeRow1": (
        "Help users understand their daily activity next to their blood test results and track a "
        "personalised activity goal (e.g. 8,000 steps/day) that is part of their preventive-health plan. "
        "Data is never sold or used for advertising."
    ),
    "Development Completion timeRow1": "2026.11.30",
    # 2. Company Description (individual developer)
    "Text7": "Individual developer; the company that will operate HomeTest is being incorporated in Spain.",
    "Text1": "Spain (EU)",
    "Text10": "Not applicable (individual developer). Basic data only.",
    "Text11": (
        "HomeTest is an early-stage preventive-health project based in Madrid, Spain. It combines at-home "
        "blood tests, a mobile app to understand the results, and access to independent healthcare "
        "professionals (doctors, dietitians, trainers). Applicant: individual developer Astor García Amor "
        "(Huawei ID hid83017893, developer ID 30034000030345789). Company being incorporated in Spain."
    ),
    "Text15": "Not applicable – individual developer (Astor García Amor)",
    "Text16": "Individual developer",
    "Text17": "Astor García Amor",
    "Text18": "Preventive-health app: at-home blood tests, results and wellbeing plan",
    "Text19": "Not applicable",
    # 3. Project Details
    "Text20": (
        "HomeTest is a preventive-health membership app. Users record and understand their blood test results, "
        "home measurements, wellbeing check-ins and daily activity from their wearables. It shows trends and "
        "informational wellbeing recommendations (it does not diagnose) and lets users share selected data with "
        "the professionals they choose. Huawei Health data (steps, calories, distance) is shown only in the "
        "user's own dashboard."
    ),
    "Text21": "Health and fitness / preventive healthcare (consumer)",
    "Text22": "Astor García Amor (developer)",
    "Text23": "Read-only integration of basic data via REST API",
    "Text24": "No",
    # 4. Technical Self-test
    "Countries this app serves Example Mainland China": "Spain (European Union)",
    "Commercial release or Demo Example Commercial Release": "Demo",
    "Select all the application types you want to access the Health Service Kit Examples Android mobile apps iOS mobile apps WeChat miniprograms HarmonyOS apps": "Android mobile app",
    "Text25": "\n\n\nREST API (cloud-side, OAuth 2.0 with Huawei ID; tokens stored server-side)",
    "Whether the data permissions applied for can meet the needs": "Y",
    "Example REST APIWhether the data usage scenarios and requirements of the application involve medical treatment": "N (wellbeing information, no diagnosis or treatment)",
    "Example REST APIExpected authorized user scale and interface request TPS Example 1 million users TPS 34K": "Pilot: < 1,000 users in the first year; TPS < 1",
}
CHECK = {"Check Box5": False, "Check Box6": True}  # 2.1.1: Yes / No

doc = pymupdf.open(HERE / "template_v3.1.pdf")
seen = set()
for page in doc:
    for wdg in page.widgets():
        name = wdg.field_name
        if name in T:
            wdg.field_value = T[name]
            narrow = (wdg.rect.width < 100) or page.number == 5
            wdg.text_fontsize = 5.5 if page.number == 0 else (6.5 if narrow else 9)
            wdg.update()
            seen.add(name)
        elif name in CHECK:
            wdg.field_value = wdg.on_state() if CHECK[name] else "Off"
            wdg.update()
            seen.add(name)
        elif wdg.field_type == pymupdf.PDF_WIDGET_TYPE_BUTTON and page.number == 1:
            page.insert_image(wdg.rect, filename=str(screenshot), keep_proportion=True)
            seen.add("screenshot")

missing = (set(T) | set(CHECK) | {"screenshot"}) - seen
assert not missing, missing
doc.save(OUT, garbage=3, deflate=True)
print(OUT)

# --- Versión para subir: página 4 con imagen de la empresa, formulario aplanado y comprimido ---
# (Huawei rechazaba la subida: pide todas las secciones rellenas, incluida la imagen de la pág. 4.)
ov = Image.new("RGB", (1400, 900), "white")
dr = ImageDraw.Draw(ov)
try:
    big, mid, small = (ImageFont.truetype("arialbd.ttf", 44), ImageFont.truetype("arialbd.ttf", 28), ImageFont.truetype("arial.ttf", 22))
except OSError:
    big = mid = small = ImageFont.load_default()
dr.text((60, 50), "HomeTest — preventive health, from home", fill="#B5552F", font=big)
dr.text((60, 120), "Madrid, Spain · individual developer (company being incorporated)", fill="#444", font=small)
boxes = [
    ("1. At-home blood test", "Kit at home or lab\nappointment; sample\nanalysed by a partner lab."),
    ("2. HomeTest app", "Results explained,\ntrends, wellbeing plan.\nWearables: steps,\ncalories, distance."),
    ("3. Professionals", "Doctors, dietitians and\ntrainers the user chooses;\nsharing only with explicit,\nrevocable consent."),
]
for i, (title, body) in enumerate(boxes):
    x0 = 60 + i * 450
    dr.rounded_rectangle((x0, 220, x0 + 400, 620), radius=24, outline="#B5552F", width=4, fill="#FBF3EE")
    dr.text((x0 + 24, 250), title, fill="#222", font=mid)
    dr.multiline_text((x0 + 24, 320), body, fill="#333", font=small, spacing=10)
    if i < 2:
        dr.polygon([(x0 + 412, 405), (x0 + 440, 420), (x0 + 412, 435)], fill="#B5552F")
dr.multiline_text((60, 680), "Data stored in the EU (Frankfurt) · never sold or used for advertising\n"
                  "Wellbeing information only: HomeTest does not diagnose or treat", fill="#444", font=small, spacing=10)
overview = HERE / "company_overview.png"
ov.save(overview)

up = pymupdf.open(OUT)
for wdg in up[3].widgets():
    if wdg.field_type == pymupdf.PDF_WIDGET_TYPE_BUTTON:
        up[3].insert_image(wdg.rect, filename=str(overview), keep_proportion=True)
up.bake()  # aplana los campos: el texto queda como contenido fijo de la página
for page in up:  # reduce las imágenes pesadas de la plantilla
    for img in page.get_images(full=True):
        xref = img[0]
        pix = pymupdf.Pixmap(up, xref)
        if pix.width > 1200 or pix.height > 1200:
            if pix.alpha or pix.n > 3:
                pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
            pix.shrink(1 if max(pix.width, pix.height) < 2400 else 2)
            page.replace_image(xref, pixmap=pix)
UPLOAD = HERE / "HomeTest_HealthServiceKit_Application_Form_V3.1_upload.pdf"
up.save(UPLOAD, garbage=4, deflate=True, deflate_images=True)
print(UPLOAD)
