# Rellena la plantilla "Application Material (for Individual Developers).xlsx" de Huawei Health
# Service Kit (cuenta individual). Texto en negro, como pide la plantilla.
#   python docs/huawei/fill_individual_xlsx.py
#
# Versión 2 (2026-10-16), tras el rechazo del 16/10: la app debe estar publicada en AppGallery y
# cada permiso tiene que verse en una captura. Cambios frente a la v1:
#   - Nombre "Kuova" (igual que en la app, la ficha de AppGallery y la política de privacidad).
#   - Solo pasos y calorías (lectura) + 1 mes de histórico; distancia fuera (la app no la enseña).
#   - Una captura por permiso, sin sueño ni pulso atribuidos a Huawei Health, y sin "demo".
# Capturas en v2/ (web demo local, viewport de móvil). Antes de generar, deja en v2/ la captura de
# los permisos marcados en la consola como console_scopes.png y pon el enlace de AppGallery abajo.
from pathlib import Path

import openpyxl
from openpyxl.drawing.image import Image as XlImage
from openpyxl.styles import Alignment, Font
from PIL import Image

HERE = Path(__file__).parent
V2 = HERE / "v2"
OUT = V2 / "Kuova_Huawei_Application_Material_Individual.xlsx"
APPGALLERY_URL = ""  # p. ej. https://appgallery.huawei.com/app/C119155453 cuando esté publicada
DONE = "2026-11-30"
IOS = "Not supported (Android only for now)"

wb = openpyxl.load_workbook(HERE / "template_individual.xlsx")
WRAP = Alignment(wrap_text=True, vertical="top")
missing = []


def put(ws, cell, value):
    c = ws[cell]
    c.value = value
    c.font = Font(name=c.font.name or "Arial", size=c.font.size or 10, color="FF000000", bold=c.font.bold)
    c.alignment = WRAP


def image(ws, cell, path, width):
    path = Path(path)
    if not path.exists():
        missing.append(path.name)
        return
    im = Image.open(path)
    tmp = V2 / f"_xl_{path.stem}.png"
    im.convert("RGB").save(tmp)
    xl = XlImage(str(tmp))
    xl.width, xl.height = width, int(width * im.height / im.width)
    ws.add_image(xl, cell)


def side_by_side(paths, out, height=1000, gap=24):
    ims = [Image.open(p).convert("RGB") for p in paths]
    ims = [im.resize((int(im.width * height / im.height), height)) for im in ims]
    canvas = Image.new("RGB", (sum(im.width for im in ims) + gap * (len(ims) - 1), height), "white")
    x = 0
    for im in ims:
        canvas.paste(im, (x, 0))
        x += im.width + gap
    canvas.save(out)
    return out


# Recorte del selector 1M + gráfica de pasos, para la fila del histórico
Image.open(V2 / "steps_1m.png").crop((0, 290, 600, 760)).save(V2 / "history_1m.png")
main_functions = side_by_side([V2 / "lab_main.png", V2 / "steps_1m.png"], V2 / "main_functions.png")

# --- Hoja 1: Data Usage ---
ws = wb.worksheets[0]
ws._images = []  # quitar las imágenes de ejemplo
rows = [
    ("Read step count data\n(Step – read)",
     "Read the user's daily step totals, classified by day. Shown as the latest daily value and as 7-day, "
     "14-day and 1-month charts with the average, lowest and highest day.",
     "After the user connects Huawei Health in Kuova (More → Wearables) and authorises access on the HUAWEI ID "
     "screen, steps appear in My Data → Steps (see screenshot) and as the daily step value on the Today screen. "
     "The user follows a personal daily step goal (e.g. 8,000 steps) that is part of the health plan built from "
     "their blood test results.",
     V2 / "steps_1m.png"),
    ("Read calories data\n(Calories – read)",
     "Read the user's daily active calories burned (kcal), classified by day. Shown as the latest daily value "
     "and as 7-day, 14-day and 1-month charts with the average, lowest and highest day.",
     "Shown in My Data → Active calories (see screenshot) and as the daily active-calorie value on the Today "
     "screen, so the user sees their daily energy expenditure next to their other health indicators.",
     V2 / "calories_1m.png"),
    ("Read historical data: one month\n(Reading historical data – One month)",
     "Only once, when the user first connects Huawei Health: read up to the previous 30 days of steps and "
     "calories (the two scopes above). No other data types and no annual history.",
     "Fills the 1-month (1M) charts of steps and active calories from day one (screenshot: 1M tab of the Steps "
     "chart; same chart for Active calories in row 2), so the user has a baseline instead of empty charts. "
     "After the first connection the app only reads new days; the 6M view fills up over time from those "
     "daily reads, never from extra history.",
     V2 / "history_1m.png"),
]
for i, (scope, req, scen, shot) in enumerate(rows):
    r = 3 + i
    put(ws, f"A{r}", i + 1)
    put(ws, f"B{r}", scope)
    put(ws, f"C{r}", req)
    put(ws, f"D{r}", scen)
    put(ws, f"E{r}", IOS)
    put(ws, f"G{r}", DONE)
    image(ws, f"H{r}", shot, 150)
    ws.row_dimensions[r].height = 250 if i < 2 else 130
for cell in ("A6", "B6", "A7", "B7"):
    ws[cell].value = None
# F, I y J están combinadas de la fila 3 a la 7 en la plantilla: un solo valor para todas las filas
put(ws, "F3", "Android mobile app")
put(ws, "I3", "App ID: 119155453\nApp name: Kuova\nPackage: com.astoramor.apptestsmedicos\n"
    "Scopes selected in the console: Step (read), Calories (read), Reading historical data: One month.")
image(ws, "I4", V2 / "console_scopes.png", 260)
put(ws, "J3", "All scopes are read-only; history is read once, on first connection, and limited to one "
    "month. Screenshots taken from the Kuova app with sample data: the Huawei Health connection "
    "is built once the test scopes are granted. The connection entry point will use only the official "
    "HUAWEI Health logo, following the Specifications for Using Logos, with no other Huawei text.")

# --- Hoja 2: App Info ---
ws = wb.worksheets[1]
put(ws, "B2", "Kuova (Kuova Health) is a preventive-health app for adults in Spain (European Union). Users order "
    "blood tests, read and understand their results, log home measurements (glucose, blood pressure), do short "
    "wellbeing check-ins and see their daily activity from their phone or wearable. The app shows trends and "
    "informational wellbeing recommendations; it does not diagnose or treat. Users can share selected data "
    "categories with healthcare professionals they choose. From Huawei Health, Kuova only reads daily steps and "
    "active calories (plus up to one month of history on first connection), shown only to the user in their own "
    "dashboard. Data is stored in the EU and is never sold or used for advertising.\n"
    "Applicant: individual developer Astor García Amor, founder of Kuova. App name, developer and data types are "
    "the same in the app, on AppGallery and in the privacy policy: https://kuovahealth.com/privacy"
    + (f"\nAppGallery: {APPGALLERY_URL}" if APPGALLERY_URL else ""))
put(ws, "B3", "Kuova app (Android): Lab tab (upcoming tests, personalised plan, test finder) and My Data → Steps "
    "with the 1-month chart. Sample data.")
image(ws, "C3", main_functions, 420)
put(ws, "B4", "Health and fitness – preventive health (consumer app). Industry selected in the console: Health.")
put(ws, "B5", "Kuova is released on AppGallery in Spain. Only basic-openness data is requested, as required for "
    "individual developers. The Huawei Health connection is built once the test scopes are granted, which is why "
    "the screenshots use sample data.")
put(ws, "B6", "Step count (read) and calories (read) are used only to show the user their own daily steps and "
    "active calories: the daily value on Today and 7-day / 14-day / 1-month charts in My Data, to track a personal "
    "activity goal that is part of their health plan. One month of history is read once, on first connection, to "
    "fill the 1-month charts. No write scopes, no other data types, no sharing with third parties without the "
    "user's explicit consent.")
ws.column_dimensions["B"].width = 90
for r in range(2, 7):
    ws.row_dimensions[r].height = 90
ws.row_dimensions[3].height = 300

# --- Hoja 3: Self-Check ---
ws = wb.worksheets[2]
put(ws, "C2", "Yes. The app is released on AppGallery in Spain (European Union).")
put(ws, "C3", "Commercial use.")
put(ws, "C4", "No.")
put(ws, "C5", "Android mobile apps.")
put(ws, "C6", "RESTful API (cloud side, OAuth 2.0 with HUAWEI ID; tokens stored only on our server, never on the phone).")
put(ws, "C7", "Yes.")
put(ws, "C8", "No. Wellbeing information only; no diagnosis or treatment.")
put(ws, "C9", "Fewer than 1,000 users in the first year; under 1 TPS.")
put(ws, "A10", ws["A10"].value)

wb.save(OUT)
for f in V2.glob("_xl_*.png"):
    f.unlink()
print(OUT)
if missing:
    print("FALTA:", ", ".join(missing), "(ponlo en docs/huawei/v2 y vuelve a ejecutar)")
if not APPGALLERY_URL:
    print("AVISO: APPGALLERY_URL vacío; añádelo cuando la app esté publicada.")
