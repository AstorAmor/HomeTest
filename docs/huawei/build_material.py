# Genera el material de solicitud de Health Service Kit (estructura "Application Material V3.1").
#   python docs/huawei/build_material.py  ->  HomeTest_HealthServiceKit_Application_Material.pdf
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from pathlib import Path

ss = getSampleStyleSheet()
B, H1, H2 = ss["BodyText"], ss["Title"], ss["Heading2"]
B.fontSize, B.leading = 9, 11.5
P = lambda t: Paragraph(t, B)

def table(rows, widths):
    t = Table([[P(c) for c in r] for r in rows], colWidths=[w * cm for w in widths], repeatRows=1)
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEE7E1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t

DONE = "2026.11.30"
story = [
    Paragraph("HomeTest – Health Service Kit application material", H1),
    P("Applicant: individual developer (Huawei ID hid83017893). App: HomeTest (Android), package "
      "com.astoramor.apptestsmedicos, AppGallery Connect App ID 119155453. Prepared on 2 October 2026 "
      "following the structure of “Application Material V3.1”."),
    Paragraph("1. Data Usage", H2),
    table([
        ["Permissions", "Data usage scenarios and requirements", "Data usage purpose", "Development completion date", "Remarks"],
        ["Read step count data",
         "After the user connects Huawei Health from the Wearables screen and authorises access, the app reads daily step "
         "totals and shows them in the user's own dashboard: a daily ring on the Today screen and a 14-day trend chart in "
         "My Data. Data is classified by day.",
         "Help users understand their daily activity next to their blood test results and track a personalised step goal "
         "(e.g. 8,000 steps/day) that is part of their preventive-health plan.", DONE,
         "Read-only. The app never writes data to Huawei Health."],
        ["Read calories burned (active energy) data",
         "Daily active calories are shown in a ring on the Today screen (daily readiness section) and as a 14-day trend in My Data.",
         "Give users a simple view of their daily energy expenditure alongside their other health indicators.", DONE, "Read-only."],
        ["Read distance data", "Daily distance complements step count in the activity summary.",
         "Contextualise daily activity (steps vs. distance) for the user.", DONE, "Read-only."],
        ["Historical data (one month, read-only)",
         "On first connection the app reads up to the previous month of step, calorie and distance data, so the user sees "
         "a baseline and recent trends from day one instead of empty charts. Longer trends are built afterwards from the "
         "data read day by day while the connection is active.",
         "Give the user an immediate starting point for their activity goal and the 14-day / 1-month charts. It is not "
         "used for any other purpose.", DONE,
         "Only after explicit user authorisation; limited to one month."],
    ], [3, 5.2, 4.2, 2, 3]),
    Spacer(1, 6),
    P("<b>Data handling.</b> Data is stored in the European Union (Supabase, Frankfurt), protected by row-level access "
      "control so each user only sees their own data, and is never sold or used for advertising. The user can disconnect "
      "Huawei Health and delete their account at any time. Data is only shared with a healthcare professional if the user "
      "explicitly grants it per data category, and the user can revoke it at any time. OAuth tokens are kept server-side, "
      "never in the mobile app."),
    P("<b>Screenshots of the app simulation.</b> Can be provided on request (Today screen with the daily readiness and "
      "activity rings; My Data screen with 14-day trends; Wearables connection screen)."),
    Paragraph("2. Company Description", H2),
    table([
        ["Item", "Answer"],
        ["2.1.1 Has the company legally existed for more than 1 year?",
         "Not applicable. The application is submitted as an individual developer. The company that will operate HomeTest "
         "is being incorporated in Spain (EU). Only basic-openness data is requested."],
        ["2.1.2 Registered paid-up capital", "Not applicable (individual developer)."],
        ["2.1.3 Brief introduction",
         "HomeTest is an early-stage preventive-health project based in Madrid, Spain. It combines at-home blood tests, a "
         "mobile app to understand the results, and access to independent healthcare professionals (doctors, dietitians, trainers)."],
        ["2.2 Corporate information", "Individual developer: Astor García Amor. Country: Spain."],
    ], [5.5, 11.9]),
    Paragraph("3. Project Details", H2),
    table([
        ["Item", "Answer"],
        ["1. Application introduction",
         "HomeTest is a preventive-health membership app. Users record and understand their blood test results (extracted "
         "from their lab reports), home measurements (glucose, blood pressure), wellbeing check-ins and daily activity from "
         "their wearables. The app shows trends and informational wellbeing recommendations (it does not diagnose) and lets "
         "users share selected data categories with the professionals they choose. Huawei Health data (steps, calories, "
         "distance) is used to show daily activity and personal trends in the user's own dashboard."],
        ["2. Application industry", "Health and fitness / preventive healthcare (consumer)."],
        ["3. Project leader for Huawei-side connection", "Astor García Amor (developer)."],
        ["4. Cooperation details", "Read-only integration of Health Service Kit basic data via cloud REST APIs with user OAuth authorisation."],
        ["5. Purchasing needs", "No."],
    ], [5.5, 11.9]),
    Paragraph("4. Technical Self-test", H2),
    table([
        ["Item", "Answer"],
        ["Countries this app serves", "Spain (European Union)."],
        ["Commercial release or Demo", "Demo / pre-release testing (commercial release planned after company incorporation)."],
        ["Application types that will access Health Service Kit", "Android mobile app."],
        ["Open technical integration", "Cloud-side REST APIs (read-only), OAuth 2.0 with Huawei ID; tokens stored server-side."],
        ["Historical data range requested", "One month."],
        ["Privacy policy", "https://hometest-web.vercel.app/privacy"],
        ["User agreement", "https://hometest-web.vercel.app/terms"],
    ], [5.5, 11.9]),
]

out = Path(__file__).with_name("HomeTest_HealthServiceKit_Application_Material.pdf")
SimpleDocTemplate(str(out), pagesize=A4, leftMargin=1.8 * cm, rightMargin=1.8 * cm, topMargin=1.6 * cm, bottomMargin=1.6 * cm).build(story)
print(out)
