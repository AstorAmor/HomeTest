"""Catálogo provisional de ejercicios para los entrenamientos (src/data/workouts/exerciseData.ts).
Base: free-exercise-db (github.com/yuhonas/free-exercise-db, fijado a un commit): nombre, músculos, nivel,
instrucciones en inglés y dos fotos por ejercicio (inicio y final), que la app alterna como un GIF.
Aquí se elige un subconjunto útil para programar (~130) y se le añade lo que la base no trae: patrón de
movimiento, material que hace falta, si va por tiempo o por lado, si tiene impacto, y el nombre y unas
indicaciones cortas en español (redactadas aquí, no traducidas a máquina).

OJO: el repositorio se declara de dominio público (Unlicense), pero no documenta de dónde salen las fotos.
Son provisionales: antes de enseñárselas a usuarios reales hay que sustituirlas por clips propios
(ver exerciseMedia en src/data/workouts/catalog.ts, el único sitio que construye las URLs).

Uso: python scripts/exercise-catalog.py [ruta/a/exercises.json]
Sin ruta, descarga el JSON del commit fijado."""
import json
import re
import sys
import urllib.request
from pathlib import Path

COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5'
DATA_URL = f'https://raw.githubusercontent.com/yuhonas/free-exercise-db/{COMMIT}/dist/exercises.json'
OUT = Path(__file__).resolve().parent.parent / 'src' / 'data' / 'workouts' / 'exerciseData.ts'

# Material (ids de src/data/workouts/types.ts):
# dumbbells mancuernas · kettlebell pesa rusa · bands bandas elásticas · bench banco o escalón ·
# bar barra de dominadas · barbell barra y discos (con rack) · machines máquinas y poleas · cardio máquinas de cardio
# Banderas: time = va por tiempo · side = por lado · impact = con saltos
D, K, BA, BE, BAR, BB, M, C = 'dumbbells', 'kettlebell', 'bands', 'bench', 'bar', 'barbell', 'machines', 'cardio'

# (id, patrón, necesita todo, necesita uno de, nivel, banderas, nombre en inglés si el de la base no sirve,
#  nombre en español, indicaciones en español)
ROWS = [
    # ── Sentadilla ──
    ('Bodyweight_Squat', 'squat', [], [], 'b', '', 'Bodyweight squat', 'Sentadilla', [
        'Pies a la anchura de los hombros, puntas un poco hacia fuera.',
        'Baja como si fueras a sentarte, con el pecho alto y el peso repartido en todo el pie.',
        'Sube empujando el suelo hasta estirar las piernas.']),
    ('Goblet_Squat', 'squat', [], [K, D], 'b', '', None, 'Sentadilla goblet', [
        'Sujeta la pesa con las dos manos, pegada al pecho.',
        'Baja entre las piernas con el tronco erguido y los codos por dentro de las rodillas.',
        'Sube empujando con todo el pie, sin despegar los talones.']),
    ('Dumbbell_Squat', 'squat', [D], [], 'b', '', None, 'Sentadilla con mancuernas', [
        'Una mancuerna en cada mano, con los brazos estirados a los lados.',
        'Baja con la espalda recta hasta que los muslos queden paralelos al suelo, o hasta donde controles.',
        'Sube sin despegar los talones.']),
    ('Plie_Dumbbell_Squat', 'squat', [], [D, K], 'b', '', 'Sumo squat', 'Sentadilla sumo', [
        'Pies más abiertos que los hombros y puntas hacia fuera.',
        'Sujeta una pesa con las dos manos, colgando entre las piernas.',
        'Baja con las rodillas hacia donde apuntan los pies y sube apretando los glúteos.']),
    ('Front_Squats_With_Two_Kettlebells', 'squat', [K], [], 'i', '', None, 'Sentadilla frontal con dos pesas rusas', [
        'Sube las pesas a la altura de los hombros, con los codos cerca del cuerpo.',
        'Baja con el tronco erguido hasta donde mantengas la espalda neutra.',
        'Sube con fuerza sin dejar caer los codos.']),
    ('Squats_-_With_Bands', 'squat', [BA], [], 'b', '', 'Band squat', 'Sentadilla con banda', [
        'Pisa la banda con los pies a la anchura de los hombros y sujeta los extremos a la altura de los hombros.',
        'Baja con el pecho alto y la espalda recta.',
        'Sube contra la resistencia de la banda hasta estirar las piernas.']),
    ('Barbell_Squat', 'squat', [BB], [], 'i', '', None, 'Sentadilla con barra', [
        'Apoya la barra en la parte alta de la espalda, nunca sobre el cuello.',
        'Coge aire, aprieta el abdomen y baja con control hasta la profundidad que domines.',
        'Sube con la espalda neutra y las rodillas alineadas con los pies.']),
    ('Leg_Press', 'squat', [M], [], 'b', '', None, 'Prensa de piernas', [
        'Espalda bien apoyada y pies a la anchura de las caderas en la plataforma.',
        'Baja doblando las rodillas sin que la zona lumbar se despegue del respaldo.',
        'Empuja hasta casi estirar las piernas, sin bloquear las rodillas.']),
    ('Hack_Squat', 'squat', [M], [], 'b', '', None, 'Sentadilla hack', [
        'Hombros bajo los apoyos y pies en el centro de la plataforma.',
        'Baja con control hasta que los muslos queden paralelos a la plataforma.',
        'Sube empujando con todo el pie, sin bloquear las rodillas.']),

    # ── Zancada y una pierna ──
    ('Bodyweight_Walking_Lunge', 'lunge', [], [], 'b', 'side', 'Walking lunge', 'Zancadas caminando', [
        'Da un paso largo adelante y baja hasta que las dos rodillas formen un ángulo recto.',
        'La rodilla de delante, en línea con el pie.',
        'Empuja con la pierna de delante y avanza con la otra.']),
    ('Dumbbell_Lunges', 'lunge', [D], [], 'b', 'side', 'Dumbbell lunge', 'Zancadas con mancuernas', [
        'De pie con los pies juntos y una mancuerna en cada mano.',
        'Da un paso adelante y baja hasta que la rodilla de atrás casi roce el suelo.',
        'Vuelve empujando con el talón de delante y alterna las piernas.']),
    ('Dumbbell_Rear_Lunge', 'lunge', [D], [], 'b', 'side', 'Dumbbell reverse lunge', 'Zancada atrás con mancuernas', [
        'De pie con una mancuerna en cada mano.',
        'Da un paso atrás y baja con el tronco erguido.',
        'Vuelve al inicio empujando con la pierna de delante.']),
    ('Split_Squat_with_Dumbbells', 'lunge', [D], [], 'b', 'side', 'Dumbbell split squat', 'Sentadilla dividida con mancuernas', [
        'Un pie delante y otro detrás, como en una zancada, con una mancuerna en cada mano.',
        'Baja en vertical hasta que la rodilla de atrás casi toque el suelo.',
        'Sube sin mover los pies. Termina las repeticiones y cambia de pierna.']),
    ('Dumbbell_Step_Ups', 'lunge', [D, BE], [], 'i', 'side', 'Dumbbell step-up', 'Subidas al banco con mancuernas', [
        'Apoya un pie entero en un banco o escalón estable.',
        'Sube empujando con esa pierna, sin impulsarte con la de abajo.',
        'Baja con control. Termina las repeticiones y cambia de pierna.']),
    ('Step-up_with_Knee_Raise', 'lunge', [BE], [], 'b', 'side', None, 'Subida al escalón con rodilla arriba', [
        'Ponte frente a un escalón o banco estable.',
        'Sube con una pierna y lleva la otra rodilla hacia el pecho.',
        'Baja con control y alterna las piernas.']),
    ('Barbell_Lunge', 'lunge', [BB], [], 'i', 'side', None, 'Zancada con barra', [
        'Barra sobre la parte alta de la espalda, como en la sentadilla.',
        'Da un paso adelante y baja hasta que la rodilla de atrás casi toque el suelo.',
        'Vuelve empujando con la pierna de delante y alterna.']),

    # ── Bisagra de cadera ──
    ('Butt_Lift_Bridge', 'hinge', [], [], 'b', '', 'Glute bridge', 'Puente de glúteos', [
        'Túmbate boca arriba, con las rodillas dobladas y los pies apoyados en el suelo.',
        'Sube la cadera apretando los glúteos hasta formar una línea de los hombros a las rodillas.',
        'Baja despacio sin llegar a apoyar del todo.']),
    ('Single_Leg_Glute_Bridge', 'hinge', [], [], 'i', 'side', None, 'Puente de glúteos a una pierna', [
        'Túmbate boca arriba con una rodilla doblada y la otra pierna estirada en el aire.',
        'Sube la cadera empujando con el talón del pie apoyado, sin que se incline hacia un lado.',
        'Baja despacio. Termina las repeticiones y cambia de pierna.']),
    ('Stiff-Legged_Dumbbell_Deadlift', 'hinge', [D], [], 'b', '', 'Dumbbell Romanian deadlift', 'Peso muerto rumano con mancuernas', [
        'De pie con una mancuerna en cada mano y las rodillas un poco flexionadas.',
        'Lleva la cadera hacia atrás y baja las pesas pegadas a las piernas, con la espalda recta.',
        'Cuando notes tensión detrás de los muslos, sube apretando los glúteos.']),
    ('Kettlebell_One-Legged_Deadlift', 'hinge', [], [K, D], 'i', 'side', 'Single-leg deadlift', 'Peso muerto a una pierna', [
        'De pie sobre una pierna, con la pesa en la mano contraria.',
        'Inclínate hacia delante llevando la pierna libre atrás, con la espalda recta y la cadera nivelada.',
        'Vuelve a subir apretando el glúteo de la pierna de apoyo.']),
    ('One-Arm_Kettlebell_Swings', 'hinge', [K], [], 'i', '', 'One-arm kettlebell swing', 'Swing a una mano con pesa rusa', [
        'Pies algo más abiertos que los hombros; coge la pesa con una mano.',
        'Llévala entre las piernas doblando la cadera, no las rodillas.',
        'Extiende la cadera con fuerza para que la pesa suba hasta el pecho: el brazo solo acompaña. Cambia de mano a mitad de serie.']),
    ('Band_Good_Morning', 'hinge', [BA], [], 'b', '', 'Band good morning', 'Buenos días con banda', [
        'Pisa la banda y pásala por detrás del cuello, apoyada en los hombros.',
        'Con las rodillas un poco flexionadas, inclínate desde la cadera con la espalda recta.',
        'Vuelve a subir empujando la cadera hacia delante.']),
    ('Pull_Through', 'hinge', [M], [], 'b', '', 'Cable pull-through', 'Pull through en polea', [
        'De espaldas a una polea baja con cuerda, sujétala entre las piernas.',
        'Lleva la cadera atrás con la espalda recta y las rodillas un poco flexionadas.',
        'Extiende la cadera apretando los glúteos hasta quedar de pie.']),
    ('Romanian_Deadlift', 'hinge', [BB], [], 'i', '', None, 'Peso muerto rumano con barra', [
        'De pie con la barra a la altura de los muslos y agarre a la anchura de los hombros.',
        'Lleva la cadera atrás y baja la barra pegada a las piernas, con la espalda recta.',
        'Sube cuando notes estirarse la parte de atrás de los muslos.']),
    ('Barbell_Deadlift', 'hinge', [BB], [], 'i', '', None, 'Peso muerto con barra', [
        'Pies bajo la barra, a la anchura de las caderas; agárrala por fuera de las piernas.',
        'Pecho alto, espalda recta y abdomen firme antes de tirar.',
        'Levanta empujando el suelo con las piernas y la barra pegada al cuerpo; baja igual de controlado.']),
    ('Barbell_Hip_Thrust', 'hinge', [BB, BE], [], 'i', '', None, 'Hip thrust con barra', [
        'Apoya la parte alta de la espalda en un banco, con la barra sobre la cadera (mejor con almohadilla).',
        'Pies apoyados y rodillas dobladas.',
        'Sube la cadera hasta alinear hombros, cadera y rodillas, aprieta los glúteos y baja con control.']),

    # ── Espalda baja (también sustituye al tirón cuando no hay con qué tirar) ──
    ('Superman', 'back', [], [], 'b', '', None, 'Superman', [
        'Túmbate boca abajo con los brazos estirados por delante.',
        'Levanta a la vez brazos, pecho y piernas unos centímetros, mirando al suelo.',
        'Aguanta un par de segundos y baja despacio.']),
    ('Hyperextensions_Back_Extensions', 'back', [M], [], 'b', '', 'Back extension', 'Extensiones lumbares en banco', [
        'Ajusta el banco para que la cadera quede justo por encima del apoyo.',
        'Baja el tronco con la espalda recta.',
        'Sube hasta alinear el cuerpo, sin arquear de más la zona lumbar.']),

    # ── Accesorios de pierna ──
    ('Lying_Leg_Curls', 'hamstrings', [M], [], 'b', '', 'Lying leg curl', 'Curl femoral tumbado', [
        'Túmbate boca abajo con el rodillo justo por encima de los talones.',
        'Dobla las rodillas llevando los talones hacia los glúteos.',
        'Baja despacio, sin dejar caer el peso.']),
    ('Seated_Leg_Curl', 'hamstrings', [M], [], 'b', '', None, 'Curl femoral sentado', [
        'Siéntate con el rodillo detrás de los tobillos y la espalda apoyada.',
        'Dobla las rodillas llevando los talones hacia abajo y atrás.',
        'Vuelve despacio a estirar las piernas.']),
    ('Leg_Extensions', 'quads', [M], [], 'b', '', 'Leg extension', 'Extensión de cuádriceps', [
        'Siéntate con el rodillo sobre los tobillos y las rodillas en el borde del asiento.',
        'Estira las piernas hasta arriba sin bloquear las rodillas.',
        'Baja despacio.']),
    ('Glute_Kickback', 'glutes', [], [], 'b', 'side', None, 'Patada de glúteo en cuadrupedia', [
        'A cuatro patas, con las manos bajo los hombros y las rodillas bajo la cadera.',
        'Sube una pierna con la rodilla doblada hasta que el muslo quede alineado con la espalda.',
        'Baja sin arquear la zona lumbar. Termina las repeticiones y cambia de pierna.']),
    ('Monster_Walk', 'glutes', [BA], [], 'b', '', 'Band side walk', 'Pasos laterales con banda', [
        'Coloca una banda alrededor de las piernas, por encima de las rodillas o en los tobillos.',
        'Semiflexiona las rodillas y la cadera, con el tronco erguido.',
        'Da pasos cortos hacia un lado sin dejar que se junten los pies; luego vuelve hacia el otro.']),
    ('Standing_Dumbbell_Calf_Raise', 'calves', [D], [], 'b', '', 'Dumbbell calf raise', 'Elevación de talones con mancuernas', [
        'De pie, con una mancuerna en cada mano.',
        'Sube los talones lo más alto que puedas.',
        'Aguanta un segundo arriba y baja despacio.']),
    ('Calf_Raises_-_With_Bands', 'calves', [BA], [], 'b', '', 'Band calf raise', 'Elevación de talones con banda', [
        'Pisa la banda con la parte delantera de los pies y sujeta los extremos a la altura de los hombros.',
        'Sube los talones lo más alto que puedas.',
        'Baja despacio.']),
    ('Standing_Calf_Raises', 'calves', [M], [], 'b', '', 'Machine calf raise', 'Elevación de talones en máquina', [
        'Hombros bajo los apoyos y la parte delantera de los pies en el escalón.',
        'Sube los talones lo más alto que puedas.',
        'Baja despacio hasta notar el estiramiento del gemelo.']),

    # ── Empuje horizontal ──
    ('Incline_Push-Up', 'push_h', [], [], 'b', '', 'Incline push-up', 'Flexiones inclinadas', [
        'Apoya las manos en un banco, una mesa firme o la pared, algo más abiertas que los hombros.',
        'Cuerpo recto de la cabeza a los talones.',
        'Baja el pecho hacia el apoyo y empuja para volver.']),
    ('Pushups', 'push_h', [], [], 'b', '', 'Push-up', 'Flexiones', [
        'Manos algo más abiertas que los hombros y el cuerpo recto de la cabeza a los talones.',
        'Baja el pecho hasta casi rozar el suelo, con los codos a unos 45 grados del cuerpo.',
        'Empuja para subir. Si te cuesta, apoya las rodillas.']),
    ('Decline_Push-Up', 'push_h', [BE], [], 'i', '', 'Decline push-up', 'Flexiones con los pies en alto', [
        'Apoya los pies en un banco o escalón y las manos en el suelo.',
        'Cuerpo recto y abdomen firme.',
        'Baja el pecho hacia el suelo y empuja para volver.']),
    ('Dumbbell_Floor_Press', 'push_h', [D], [], 'b', '', None, 'Press de pecho en el suelo con mancuernas', [
        'Túmbate boca arriba con las rodillas dobladas y una mancuerna en cada mano.',
        'Baja las pesas hasta que los brazos toquen el suelo.',
        'Empuja hacia arriba hasta estirar los brazos.']),
    ('Dumbbell_Bench_Press', 'push_h', [D, BE], [], 'b', '', None, 'Press de banca con mancuernas', [
        'Túmbate en el banco con una mancuerna en cada mano, a la altura del pecho.',
        'Empuja hacia arriba hasta estirar los brazos, sin chocar las pesas.',
        'Baja despacio hasta notar el estiramiento en el pecho.']),
    ('Incline_Dumbbell_Press', 'push_h', [D, BE], [], 'b', '', None, 'Press inclinado con mancuernas', [
        'Banco inclinado unos 30 grados y una mancuerna en cada mano.',
        'Empuja las pesas hacia arriba por encima del pecho.',
        'Baja con control hasta la altura de los hombros.']),
    ('One-Arm_Kettlebell_Floor_Press', 'push_h', [K], [], 'i', 'side', 'One-arm kettlebell floor press', 'Press en el suelo con pesa rusa', [
        'Túmbate boca arriba con la pesa en una mano, a la altura del pecho y el codo en el suelo.',
        'Empuja hasta estirar el brazo, con la muñeca recta.',
        'Baja despacio. Termina las repeticiones y cambia de brazo.']),
    ('Barbell_Bench_Press_-_Medium_Grip', 'push_h', [BB, BE], [], 'i', '', 'Barbell bench press', 'Press de banca con barra', [
        'Túmbate con los ojos bajo la barra y agárrala algo más abierta que los hombros.',
        'Baja la barra con control hasta la parte baja del pecho.',
        'Empuja hasta estirar los brazos. Mejor con alguien que te ayude o con topes de seguridad.']),
    ('Machine_Bench_Press', 'push_h', [M], [], 'b', '', 'Machine chest press', 'Press de pecho en máquina', [
        'Ajusta el asiento para que las asas queden a la altura del pecho.',
        'Empuja hasta casi estirar los brazos.',
        'Vuelve despacio sin dejar que el peso choque.']),
    ('Cable_Chest_Press', 'push_h', [M], [], 'b', '', None, 'Press de pecho en polea', [
        'De espaldas a las poleas, con un asa en cada mano a la altura del pecho y un pie adelantado.',
        'Empuja las manos al frente hasta estirar los brazos.',
        'Vuelve despacio sin perder la postura.']),

    # ── Pecho (accesorio) ──
    ('Dumbbell_Flyes', 'chest', [D, BE], [], 'b', '', 'Dumbbell fly', 'Aperturas con mancuernas', [
        'Túmbate en el banco con las mancuernas arriba y los codos un poco doblados.',
        'Abre los brazos en arco hasta notar el estiramiento en el pecho.',
        'Vuelve a cerrar con el mismo recorrido.']),
    ('Cross_Over_-_With_Bands', 'chest', [BA], [], 'b', '', 'Band chest fly', 'Cruce de pecho con banda', [
        'Ancla la banda a un punto firme a la altura del pecho y ponte de espaldas.',
        'Con los brazos abiertos y los codos un poco doblados, junta las manos por delante.',
        'Vuelve a abrir despacio.']),
    ('Butterfly', 'chest', [M], [], 'b', '', 'Pec deck', 'Contractora de pecho', [
        'Siéntate con la espalda apoyada y los brazos a la altura de los hombros.',
        'Junta las asas delante del pecho.',
        'Vuelve a abrir despacio, sin pasar de la línea de los hombros.']),

    # ── Empuje vertical ──
    ('Standing_Dumbbell_Press', 'push_v', [D], [], 'b', '', 'Standing dumbbell shoulder press', 'Press de hombros de pie con mancuernas', [
        'De pie, con las mancuernas a la altura de los hombros.',
        'Empuja hacia arriba hasta estirar los brazos, sin arquear la espalda.',
        'Baja con control hasta los hombros.']),
    ('Seated_Dumbbell_Press', 'push_v', [D, BE], [], 'b', '', 'Seated dumbbell shoulder press', 'Press de hombros sentado con mancuernas', [
        'Sentado en un banco con respaldo y las mancuernas a la altura de los hombros.',
        'Empuja hacia arriba hasta estirar los brazos.',
        'Baja con control hasta los hombros.']),
    ('Arnold_Dumbbell_Press', 'push_v', [D], [], 'i', '', 'Arnold press', 'Press Arnold', [
        'Empieza con las mancuernas delante de la cara y las palmas hacia ti.',
        'Mientras subes, gira las palmas hacia delante hasta estirar los brazos.',
        'Baja deshaciendo el giro.']),
    ('Two-Arm_Kettlebell_Military_Press', 'push_v', [K], [], 'i', '', 'Double kettlebell press', 'Press de hombros con dos pesas rusas', [
        'Sube las pesas a los hombros, con las muñecas rectas.',
        'Empuja hacia arriba hasta estirar los brazos, con el abdomen firme.',
        'Baja con control a los hombros.']),
    ('Shoulder_Press_-_With_Bands', 'push_v', [BA], [], 'b', '', 'Band shoulder press', 'Press de hombros con banda', [
        'Pisa la banda y sujeta los extremos a la altura de los hombros.',
        'Empuja hacia arriba hasta estirar los brazos.',
        'Baja despacio a los hombros.']),
    ('Standing_Military_Press', 'push_v', [BB], [], 'i', '', 'Barbell overhead press', 'Press militar con barra', [
        'De pie, con la barra apoyada delante de los hombros y agarre algo más abierto que estos.',
        'Empuja la barra por encima de la cabeza, apartando la cara al subir.',
        'Baja con control a los hombros, sin arquear la espalda.']),
    ('Machine_Shoulder_Military_Press', 'push_v', [M], [], 'b', '', 'Machine shoulder press', 'Press de hombros en máquina', [
        'Ajusta el asiento para que las asas queden a la altura de los hombros.',
        'Empuja hacia arriba hasta casi estirar los brazos.',
        'Baja despacio.']),

    # ── Hombros (accesorio) ──
    ('Side_Lateral_Raise', 'shoulders', [D], [], 'b', '', 'Lateral raise', 'Elevaciones laterales', [
        'De pie, con una mancuerna en cada mano a los lados.',
        'Sube los brazos hacia los lados hasta la altura de los hombros, con los codos un poco doblados.',
        'Baja despacio.']),
    ('Lateral_Raise_-_With_Bands', 'shoulders', [BA], [], 'b', '', 'Band lateral raise', 'Elevaciones laterales con banda', [
        'Pisa la banda y sujeta un extremo en cada mano.',
        'Sube los brazos hacia los lados hasta la altura de los hombros.',
        'Baja despacio.']),
    ('Reverse_Flyes', 'shoulders', [D], [], 'b', '', 'Rear delt fly', 'Pájaros con mancuernas', [
        'Inclínate hacia delante desde la cadera con la espalda recta y una mancuerna en cada mano.',
        'Abre los brazos hacia los lados juntando las escápulas.',
        'Baja despacio.']),
    ('Band_Pull_Apart', 'shoulders', [BA], [], 'b', '', None, 'Aperturas con banda', [
        'Sujeta la banda delante del pecho con los brazos estirados.',
        'Separa las manos hacia los lados juntando las escápulas.',
        'Vuelve despacio.']),
    ('Face_Pull', 'shoulders', [M], [], 'b', '', None, 'Face pull en polea', [
        'Polea alta con cuerda: sujétala con las dos manos.',
        'Tira hacia la cara separando las manos, con los codos altos.',
        'Vuelve despacio.']),
    ('External_Rotation_with_Band', 'shoulders', [BA], [], 'b', 'side', 'Band external rotation', 'Rotación externa con banda', [
        'Ancla la banda a la altura del codo y sujétala con la mano más lejana.',
        'Con el codo pegado al cuerpo y doblado a 90 grados, gira el antebrazo hacia fuera.',
        'Vuelve despacio. Termina las repeticiones y cambia de brazo.']),

    # ── Tirón horizontal ──
    ('Bent_Over_Two-Dumbbell_Row', 'pull_h', [D], [], 'b', '', 'Bent-over dumbbell row', 'Remo inclinado con mancuernas', [
        'Inclínate desde la cadera con la espalda recta y una mancuerna en cada mano.',
        'Tira de las pesas hacia la cadera juntando las escápulas.',
        'Baja con control.']),
    ('One-Arm_Dumbbell_Row', 'pull_h', [D, BE], [], 'b', 'side', 'One-arm dumbbell row', 'Remo a una mano con mancuerna', [
        'Apoya una rodilla y una mano en el banco, con la espalda recta.',
        'Tira de la mancuerna hacia la cadera, con el codo cerca del cuerpo.',
        'Baja despacio. Termina las repeticiones y cambia de lado.']),
    ('Dumbbell_Incline_Row', 'pull_h', [D, BE], [], 'b', '', 'Chest-supported dumbbell row', 'Remo con el pecho apoyado', [
        'Túmbate boca abajo en un banco inclinado, con una mancuerna en cada mano.',
        'Tira de las pesas hacia atrás juntando las escápulas.',
        'Baja con control hasta estirar los brazos.']),
    ('Two-Arm_Kettlebell_Row', 'pull_h', [K], [], 'i', '', 'Double kettlebell row', 'Remo con dos pesas rusas', [
        'Inclínate desde la cadera con la espalda recta y una pesa en cada mano.',
        'Tira de las pesas hacia la cadera juntando las escápulas.',
        'Baja con control.']),
    ('Inverted_Row', 'pull_h', [], [BB, M], 'b', '', None, 'Remo invertido', [
        'Barra a la altura de la cintura en un rack o máquina Smith: cuélgate debajo con el cuerpo recto.',
        'Tira del pecho hacia la barra juntando las escápulas.',
        'Baja con control. Cuanto más vertical estés, más fácil.']),
    ('Bent_Over_Barbell_Row', 'pull_h', [BB], [], 'i', '', 'Barbell row', 'Remo con barra', [
        'Inclínate desde la cadera con la espalda recta y la barra colgando a la altura de las rodillas.',
        'Tira de la barra hacia el ombligo juntando las escápulas.',
        'Baja con control.']),
    ('Seated_Cable_Rows', 'pull_h', [M], [], 'b', '', 'Seated cable row', 'Remo sentado en polea', [
        'Sentado, con los pies apoyados y las rodillas un poco dobladas.',
        'Tira del asa hacia el abdomen con el pecho alto, juntando las escápulas.',
        'Vuelve despacio hasta estirar los brazos, sin redondear la espalda.']),
    ('Leverage_Iso_Row', 'pull_h', [M], [], 'b', '', 'Machine row', 'Remo en máquina', [
        'Ajusta el asiento para que las asas queden a la altura del pecho, con el pecho apoyado.',
        'Tira hacia atrás juntando las escápulas.',
        'Vuelve despacio.']),

    # ── Tirón vertical ──
    ('Scapular_Pull-Up', 'pull_v', [BAR], [], 'b', '', None, 'Activación escapular en barra', [
        'Cuélgate de una barra de dominadas con los brazos estirados.',
        'Sin doblar los codos, baja los hombros y sube el cuerpo unos centímetros.',
        'Vuelve despacio a colgar.']),
    ('Band_Assisted_Pull-Up', 'pull_v', [BAR, BA], [], 'b', '', None, 'Dominadas asistidas con banda', [
        'Engancha una banda a la barra y apoya en ella una rodilla o un pie.',
        'Tira hasta que la barbilla pase la barra, juntando las escápulas.',
        'Baja con control hasta estirar los brazos.']),
    ('Pullups', 'pull_v', [BAR], [], 'i', '', 'Pull-up', 'Dominadas', [
        'Agarre algo más abierto que los hombros, con las palmas hacia delante.',
        'Tira hasta que la barbilla pase la barra, sin balancearte.',
        'Baja con control hasta estirar los brazos.']),
    ('Chin-Up', 'pull_v', [BAR], [], 'i', '', None, 'Dominadas supinas', [
        'Agarre a la anchura de los hombros, con las palmas hacia ti.',
        'Tira hasta que la barbilla pase la barra, con los codos hacia abajo.',
        'Baja con control hasta estirar los brazos.']),
    ('Wide-Grip_Lat_Pulldown', 'pull_v', [M], [], 'b', '', 'Lat pulldown', 'Jalón al pecho', [
        'Siéntate con los muslos bajo los apoyos y agarra la barra algo más abierta que los hombros.',
        'Tira de la barra hacia la parte alta del pecho, llevando los codos hacia abajo.',
        'Sube despacio hasta estirar los brazos.']),
    ('Close-Grip_Front_Lat_Pulldown', 'pull_v', [M], [], 'b', '', 'Close-grip lat pulldown', 'Jalón con agarre estrecho', [
        'Siéntate con los muslos bajo los apoyos y agarra la barra con las manos cerca.',
        'Tira hacia la parte alta del pecho con el tronco un poco inclinado atrás.',
        'Sube despacio hasta estirar los brazos.']),
    ('Straight-Arm_Pulldown', 'pull_v', [M], [], 'b', '', None, 'Jalón con brazos rectos', [
        'De pie frente a una polea alta, con la barra o la cuerda a la altura de los ojos.',
        'Con los brazos casi rectos, baja la barra en arco hasta los muslos.',
        'Vuelve despacio arriba.']),

    # ── Abdomen y tronco ──
    ('Plank', 'core', [], [], 'b', 'time', None, 'Plancha', [
        'Apoya los antebrazos y las puntas de los pies, con los codos bajo los hombros.',
        'Cuerpo recto de la cabeza a los talones: aprieta abdomen y glúteos.',
        'Respira con normalidad y no dejes caer la cadera.']),
    ('Side_Bridge', 'core', [], [], 'b', 'time,side', 'Side plank', 'Plancha lateral', [
        'Túmbate de lado apoyado en un antebrazo, con el codo bajo el hombro.',
        'Sube la cadera hasta alinear el cuerpo.',
        'Aguanta sin dejar caer la cadera y cambia de lado.']),
    ('Dead_Bug', 'core', [], [], 'b', '', 'Dead bug', 'Bicho muerto', [
        'Túmbate boca arriba con los brazos hacia el techo y las rodillas dobladas en el aire.',
        'Estira a la vez un brazo hacia atrás y la pierna contraria hacia delante, con la zona lumbar pegada al suelo.',
        'Vuelve y alterna los lados.']),
    ('Reverse_Crunch', 'core', [], [], 'b', '', None, 'Encogimiento inverso', [
        'Túmbate boca arriba con las rodillas dobladas en el aire y las manos a los lados.',
        'Lleva las rodillas hacia el pecho despegando un poco la cadera del suelo.',
        'Baja despacio sin arquear la espalda.']),
    ('Crunches', 'core', [], [], 'b', '', 'Crunch', 'Encogimientos abdominales', [
        'Túmbate boca arriba con las rodillas dobladas y las manos junto a las sienes.',
        'Despega los hombros del suelo contrayendo el abdomen, sin tirar del cuello.',
        'Baja despacio.']),
    ('Air_Bike', 'core', [], [], 'b', '', 'Bicycle crunch', 'Bicicleta abdominal', [
        'Túmbate boca arriba con las manos junto a la cabeza y las piernas en el aire.',
        'Acerca un codo a la rodilla contraria mientras estiras la otra pierna.',
        'Alterna los lados despacio, como si pedalearas.']),
    ('Russian_Twist', 'core', [], [], 'i', '', None, 'Giro ruso', [
        'Siéntate con las rodillas dobladas y el tronco inclinado hacia atrás, con la espalda recta.',
        'Gira el tronco a un lado y al otro, llevando las manos junto a la cadera.',
        'Para hacerlo más difícil, levanta los pies o sujeta un peso.']),
    ('Flutter_Kicks', 'core', [], [], 'b', '', None, 'Tijeras', [
        'Túmbate boca arriba con las manos bajo los glúteos.',
        'Levanta las piernas estiradas unos centímetros del suelo.',
        'Sube y baja las piernas alternándolas, sin despegar la zona lumbar.']),
    ('Pallof_Press', 'core', [], [M, BA], 'b', 'side', None, 'Press Pallof', [
        'De lado a una polea o a una banda anclada a la altura del pecho.',
        'Sujeta el asa con las dos manos junto al pecho y estira los brazos al frente sin dejar que el tronco gire.',
        'Vuelve despacio. Termina las repeticiones y cambia de lado.']),
    ('Hanging_Leg_Raise', 'core', [BAR], [], 'a', '', None, 'Elevación de piernas colgado', [
        'Cuélgate de la barra con los brazos estirados.',
        'Sube las piernas hasta la altura de la cadera sin balancearte.',
        'Baja despacio.']),
    ('Standing_Cable_Wood_Chop', 'core', [M], [], 'b', 'side', 'Cable wood chop', 'Leñador en polea', [
        'De lado a una polea alta, con el asa en las dos manos por encima del hombro.',
        'Tira en diagonal hacia la cadera contraria girando el tronco, con los brazos estirados.',
        'Vuelve despacio. Termina las repeticiones y cambia de lado.']),

    # ── Acarreo ──
    ('Farmers_Walk', 'carry', [], [D, K], 'b', 'time', "Farmer's walk", 'Paseo del granjero', [
        'Coge una pesa pesada en cada mano.',
        'Camina con pasos cortos, el tronco erguido y los hombros abajo.',
        'Respira con normalidad y no dejes que el cuerpo se incline.']),

    # ── Cardio y circuito ──
    ('Mountain_Climbers', 'conditioning', [], [], 'b', 'time', 'Mountain climbers', 'Escaladores', [
        'En posición de flexión, con las manos bajo los hombros.',
        'Lleva una rodilla hacia el pecho y vuelve, alternando las piernas a buen ritmo.',
        'Mantén la cadera baja y el abdomen firme.']),
    ('Star_Jump', 'conditioning', [], [], 'b', 'time,impact', None, 'Saltos de estrella', [
        'De pie, con los pies a la anchura de los hombros.',
        'Haz media sentadilla y salta abriendo brazos y piernas.',
        'Aterriza suave, con las rodillas flexionadas, y repite.']),
    ('Freehand_Jump_Squat', 'conditioning', [], [], 'i', 'impact', 'Jump squat', 'Sentadilla con salto', [
        'Baja a una sentadilla con el pecho alto.',
        'Salta con fuerza estirando todo el cuerpo.',
        'Aterriza suave, flexionando las rodillas, y enlaza con la siguiente.']),
    ('Split_Jump', 'conditioning', [], [], 'i', 'impact', None, 'Zancadas con salto', [
        'Colócate en posición de zancada.',
        'Salta y cambia las piernas en el aire.',
        'Aterriza suave, en zancada con la otra pierna delante.']),
    ('Fast_Skipping', 'conditioning', [], [], 'b', 'time,impact', 'Skipping', 'Saltitos alternos (skipping)', [
        'Avanza con un patrón de paso y saltito: derecha-derecha, izquierda-izquierda.',
        'Apoyos cortos y rápidos, cerca del suelo.',
        'Mueve los brazos al ritmo de las piernas.']),
    ('Rowing_Stationary', 'conditioning', [C], [], 'b', 'time', 'Rowing machine', 'Remo (máquina)', [
        'Empuja primero con las piernas, luego inclina el tronco y al final tira con los brazos.',
        'Vuelve en orden inverso: brazos, tronco y piernas.',
        'Ritmo cómodo: puedes hablar con frases cortas.']),
    ('Bicycling_Stationary', 'conditioning', [C], [], 'b', 'time', 'Stationary bike', 'Bicicleta estática', [
        'Ajusta el sillín para que la rodilla quede casi estirada abajo.',
        'Pedalea a un ritmo que te deje hablar con frases cortas.',
        'Sube la resistencia en los tramos más intensos.']),
    ('Elliptical_Trainer', 'conditioning', [C], [], 'b', 'time', 'Elliptical', 'Elíptica', [
        'Cuerpo erguido y manos en las asas móviles.',
        'Mueve brazos y piernas a la vez, sin impacto.',
        'Ritmo cómodo: puedes hablar con frases cortas.']),
    ('Walking_Treadmill', 'conditioning', [C], [], 'b', 'time', 'Incline treadmill walk', 'Caminar en cinta con inclinación', [
        'Elige una velocidad de paso vivo y algo de inclinación.',
        'Camina sin agarrarte a las barras.',
        'Ritmo en el que puedas hablar, pero no cantar.']),
    ('Jogging_Treadmill', 'conditioning', [C], [], 'b', 'time,impact', 'Treadmill jog', 'Trotar en cinta', [
        'Empieza caminando y sube la velocidad poco a poco.',
        'Pasos cortos y ligeros, con el tronco erguido.',
        'Ritmo en el que puedas hablar con frases cortas.']),

    # ── Brazos ──
    ('Dumbbell_Bicep_Curl', 'biceps', [D], [], 'b', '', 'Dumbbell biceps curl', 'Curl de bíceps con mancuernas', [
        'De pie, con una mancuerna en cada mano y las palmas hacia delante.',
        'Dobla los codos subiendo las pesas, con los codos pegados al cuerpo.',
        'Baja despacio hasta estirar los brazos.']),
    ('Hammer_Curls', 'biceps', [D], [], 'b', '', 'Hammer curl', 'Curl martillo', [
        'De pie, con las mancuernas a los lados y las palmas mirándose.',
        'Sube las pesas doblando los codos, sin balancear el cuerpo.',
        'Baja despacio.']),
    ('Standing_Biceps_Cable_Curl', 'biceps', [M], [], 'b', '', 'Cable biceps curl', 'Curl de bíceps en polea', [
        'De pie frente a una polea baja, con la barra en las manos y las palmas hacia arriba.',
        'Sube la barra doblando los codos, pegados al cuerpo.',
        'Baja despacio.']),
    ('Bench_Dips', 'triceps', [BE], [], 'b', '', 'Bench dip', 'Fondos en banco', [
        'Apoya las manos en el borde de un banco o una silla estable, con los dedos hacia delante.',
        'Baja doblando los codos hacia atrás hasta unos 90 grados.',
        'Empuja para subir. Con las rodillas dobladas es más fácil.']),
    ('Tricep_Dumbbell_Kickback', 'triceps', [D], [], 'b', '', 'Triceps kickback', 'Patada de tríceps', [
        'Inclínate hacia delante con la espalda recta y el brazo pegado al cuerpo, codo doblado.',
        'Estira el codo llevando la mancuerna hacia atrás.',
        'Vuelve despacio sin mover el brazo.']),
    ('Standing_Dumbbell_Triceps_Extension', 'triceps', [D], [], 'b', '', 'Overhead triceps extension', 'Extensión de tríceps sobre la cabeza', [
        'De pie, con una mancuerna sujeta con las dos manos por encima de la cabeza.',
        'Baja la pesa detrás de la cabeza doblando los codos, que apuntan al techo.',
        'Estira los brazos para volver.']),
    ('Triceps_Pushdown_-_Rope_Attachment', 'triceps', [M], [], 'b', '', 'Rope triceps pushdown', 'Extensión de tríceps en polea', [
        'De pie frente a una polea alta con cuerda, los codos pegados al cuerpo.',
        'Empuja la cuerda hacia abajo hasta estirar los brazos, separando las manos al final.',
        'Vuelve despacio sin mover los codos.']),
    ('Push-Ups_-_Close_Triceps_Position', 'triceps', [], [], 'i', '', 'Close-grip push-up', 'Flexiones cerradas', [
        'Manos bajo los hombros o un poco más juntas.',
        'Baja con los codos pegados al cuerpo.',
        'Empuja para subir. Si te cuesta, apoya las rodillas.']),

    # ── Calentamiento y movilidad ──
    ('Arm_Circles', 'mobility', [], [], 'b', 'time', None, 'Círculos de brazos', [
        'De pie, con los brazos estirados a los lados a la altura de los hombros.',
        'Haz círculos pequeños hacia delante que vayan creciendo.',
        'A mitad de tiempo, cambia el sentido.']),
    ('Standing_Hip_Circles', 'mobility', [], [], 'b', 'side', 'Hip circles', 'Círculos de cadera', [
        'De pie sobre una pierna, apoyado en una pared o un respaldo.',
        'Sube la otra rodilla y dibuja con ella un círculo grande hacia fuera.',
        'Haz varios en cada sentido y cambia de pierna.']),
    ('Ankle_Circles', 'mobility', [], [], 'b', 'side', None, 'Círculos de tobillo', [
        'De pie, apoyado en algo estable, levanta un pie un poco del suelo.',
        'Dibuja círculos con la punta del pie.',
        'Cambia de sentido y luego de pie.']),
    ('Inchworm', 'mobility', [], [], 'b', '', None, 'Gusano', [
        'De pie, baja las manos al suelo doblando las rodillas lo que haga falta.',
        'Camina con las manos hacia delante hasta la posición de flexión.',
        'Vuelve caminando con las manos hacia los pies y sube despacio.']),
    ('Worlds_Greatest_Stretch', 'mobility', [], [], 'b', 'side', "World's greatest stretch", 'El mejor estiramiento del mundo', [
        'Da una zancada larga y apoya las dos manos en el suelo, por dentro del pie de delante.',
        'Lleva el codo del mismo lado hacia el tobillo y luego gira el tronco abriendo ese brazo al techo.',
        'Vuelve, cambia de pierna y repite.']),
    ('Cat_Stretch', 'mobility', [], [], 'b', '', 'Cat stretch', 'Estiramiento del gato', [
        'A cuatro patas, con las manos bajo los hombros y las rodillas bajo la cadera.',
        'Mete el abdomen y redondea la espalda dejando caer la cabeza.',
        'Vuelve a la espalda neutra despacio y repite.']),

    # ── Vuelta a la calma: estiramientos ──
    ('Childs_Pose', 'stretch', [], [], 'b', 'time', "Child's pose", 'Postura del niño', [
        'De rodillas, siéntate sobre los talones.',
        'Lleva el tronco hacia delante con los brazos estirados en el suelo.',
        'Respira despacio y deja que se relaje la espalda.']),
    ('Hamstring_Stretch', 'stretch', [], [], 'b', 'time,side', None, 'Estiramiento de isquiotibiales tumbado', [
        'Túmbate boca arriba y sube una pierna estirada.',
        'Pasa una toalla o una banda por la planta del pie y tira suave.',
        'Mantén sin rebotes y cambia de pierna.']),
    ('Seated_Floor_Hamstring_Stretch', 'stretch', [], [], 'b', 'time,side', None, 'Estiramiento de isquiotibiales sentado', [
        'Sentado, con una pierna estirada y la planta del otro pie junto a su muslo.',
        'Inclínate desde la cadera hacia el tobillo de la pierna estirada.',
        'Mantén sin rebotes y cambia de pierna.']),
    ('Kneeling_Hip_Flexor', 'stretch', [], [], 'b', 'time,side', 'Kneeling hip flexor stretch', 'Estiramiento de flexores de cadera', [
        'Con una rodilla en el suelo y el otro pie delante, como en una zancada.',
        'Lleva la cadera hacia delante con el tronco erguido hasta notar el estiramiento delante de la cadera.',
        'Mantén y cambia de lado.']),
    ('On_Your_Side_Quad_Stretch', 'stretch', [], [], 'b', 'time,side', 'Side-lying quad stretch', 'Estiramiento de cuádriceps de lado', [
        'Túmbate de lado.',
        'Dobla la rodilla de arriba y coge el pie con la mano, llevando el talón hacia el glúteo.',
        'Mantén las rodillas juntas y cambia de lado.']),
    ('Calf_Stretch_Hands_Against_Wall', 'stretch', [], [], 'b', 'time,side', 'Wall calf stretch', 'Estiramiento de gemelo en la pared', [
        'Manos en la pared, una pierna adelantada y la otra estirada detrás.',
        'Mantén el talón de atrás en el suelo e inclínate hacia la pared.',
        'Mantén y cambia de pierna.']),
    ('Chest_And_Front_Of_Shoulder_Stretch', 'stretch', [], [], 'b', 'time', 'Chest and shoulder stretch', 'Estiramiento de pecho con palo', [
        'Sujeta un palo de escoba con los brazos estirados y las manos bastante separadas.',
        'Súbelo despacio por encima de la cabeza y llévalo un poco hacia atrás, sin forzar.',
        'Mantén y vuelve despacio.']),
    ('Triceps_Stretch', 'stretch', [], [], 'b', 'time,side', None, 'Estiramiento de tríceps', [
        'Sube un brazo y dobla el codo para llevar la mano a la espalda.',
        'Con la otra mano, empuja suave el codo hacia abajo.',
        'Mantén y cambia de brazo.']),
    ('Upper_Back_Stretch', 'stretch', [], [], 'b', 'time', None, 'Estiramiento de espalda alta', [
        'Entrelaza los dedos con los brazos estirados delante.',
        'Redondea los hombros y empuja las manos hacia delante.',
        'Mantén respirando despacio.']),
    ('Knee_Across_The_Body', 'stretch', [], [], 'b', 'time,side', 'Lying spinal twist', 'Torsión tumbado', [
        'Túmbate boca arriba con una pierna estirada.',
        'Dobla la otra y llévala cruzada por encima del cuerpo hacia el suelo.',
        'Gira la cabeza hacia el lado contrario, mantén y cambia de lado.']),
    ('Ankle_On_The_Knee', 'stretch', [], [], 'b', 'time,side', 'Figure-four stretch', 'Estiramiento de glúteo en figura 4', [
        'Túmbate boca arriba con las rodillas dobladas.',
        'Apoya un tobillo sobre la rodilla contraria.',
        'Lleva las dos piernas hacia el pecho cogiendo el muslo de abajo. Mantén y cambia de lado.']),
    ('Standing_Lateral_Stretch', 'stretch', [], [], 'b', 'time,side', None, 'Estiramiento lateral de pie', [
        'De pie, con los pies algo separados y una mano en la cadera.',
        'Sube el otro brazo e inclínate hacia el lado contrario.',
        'Mantén y cambia de lado.']),
    ('Hug_Knees_To_Chest', 'stretch', [], [], 'b', 'time', None, 'Rodillas al pecho', [
        'Túmbate boca arriba.',
        'Abraza las rodillas por debajo y llévalas hacia el pecho.',
        'Mantén respirando despacio.']),
]

LEVEL = {'b': 'beginner', 'i': 'intermediate', 'a': 'advanced'}

# La base no trae instrucciones para estos
EN_STEPS = {
    'One-Arm_Kettlebell_Swings': [
        'Stand with your feet a little wider than your shoulders and hold the kettlebell in one hand.',
        'Swing it back between your legs by hinging at the hips, not by bending the knees.',
        'Drive the hips forward hard so the kettlebell floats up to chest height; the arm only guides it. Switch hands halfway.'],
    'Side_Bridge': [
        'Lie on your side, propped up on one forearm with the elbow under the shoulder.',
        'Lift your hips until your body forms a straight line.',
        'Hold without letting the hips drop, then switch sides.'],
}
BOILERPLATE = re.compile(
    r'\s*(This will be your starting position\.?|Repeat for the recommended amount of repetitions\.?|'
    r'Repeat for the recommended number of repetitions\.?)\s*', re.I)


def clean_steps(steps):
    out = []
    for s in steps:
        s = BOILERPLATE.sub(' ', s.replace('�', '-')).strip()
        s = re.sub(r'\s{2,}', ' ', s)
        if s:
            out.append(s)
    return out[:5]


def ts(v):
    return json.dumps(v, ensure_ascii=False)


def main():
    if len(sys.argv) > 1:
        data = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    else:
        with urllib.request.urlopen(DATA_URL) as r:
            data = json.loads(r.read().decode('utf-8'))
    by_id = {d['id']: d for d in data}
    seen = set()
    lines = []
    for (eid, pattern, needs, any_of, level, flags, en_name, es_name, es_steps) in ROWS:
        if eid in seen:
            sys.exit(f'Repetido: {eid}')
        seen.add(eid)
        d = by_id.get(eid)
        if not d:
            sys.exit(f'No está en la base: {eid}')
        if len(d['images']) < 2:
            sys.exit(f'Sin las dos fotos (inicio y final): {eid}')
        f = set(x for x in flags.split(',') if x)
        rec = {
            'id': eid,
            'pattern': pattern,
            'needs': needs,
            **({'anyOf': any_of} if any_of else {}),
            'level': LEVEL[level],
            **({'timed': True} if 'time' in f else {}),
            **({'perSide': True} if 'side' in f else {}),
            **({'impact': True} if 'impact' in f else {}),
            'compound': d.get('mechanic') == 'compound',
            'primary': d['primaryMuscles'],
            'secondary': d['secondaryMuscles'],
            'name': {'en': en_name or d['name'], 'es': es_name},
            'steps': {'en': EN_STEPS.get(eid) or clean_steps(d['instructions']), 'es': es_steps},
            'frames': d['images'][:2],
        }
        lines.append('  ' + ts(rec) + ',')
    head = (
        '// GENERADO por scripts/exercise-catalog.py: no editar a mano (cambia la tabla del script y vuelve a\n'
        '// ejecutarlo). Base provisional: free-exercise-db, commit fijado. Las fotos son provisionales: ver\n'
        '// exerciseMedia en ./catalog.ts antes de enseñarlas a usuarios reales.\n'
        "import type { CatalogExercise } from './types';\n\n"
        f"export const EXERCISE_DATA_COMMIT = '{COMMIT}';\n\n"
        'export const EXERCISE_DATA: CatalogExercise[] = [\n'
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(head + '\n'.join(lines) + '\n];\n', encoding='utf-8')
    print(f'{len(lines)} ejercicios -> {OUT}')


if __name__ == '__main__':
    main()
