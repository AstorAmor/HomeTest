// Las imágenes del mapa de músculos (MuscleMap): por cada figura (hombre y mujer, de frente y de espaldas), la base
// (el cuerpo entero en un solo tono) y, por cada grupo muscular, su capa en dos tonos: principal (rojo, -p) y
// secundario (violeta azulado, -s). Todas del mismo tamaño (320 × 790) y con el fondo transparente. Salen de la
// imagen del fundador, recortada por capas separando cada grupo por su color y cambiándole luego el tono (fundador,
// 2026-11-17: «que sea rojo el músculo principal, y luego violeta/azul los secundarios»); desde el 2026-11-18, de su
// segunda imagen («unas figuras menos sexuales»). Están en assets/images/muscles. GENERADO junto con las imágenes:
// para cambiarlas, volver a recortarlas con los mismos nombres (musc-<m|f>-<front|back>[-<capa>-<p|s>].webp) y, si
// cambia la lista de capas, VIEW_LAYERS en src/logic/muscleMap.ts. El script que las recorta (v2/layers2.py) y la
// imagen de partida están fuera del repositorio, en proyectos/borradores/musculos-capas.
import type { FigureSex } from '@/logic/bodyFigure';
import type { MuscleLayer, MuscleLevel, MuscleView } from '@/logic/muscleMap';

export const MUSCLE_ART_SIZE = { w: 320, h: 790 };

interface MuscleArt {
  base: number;
  layers: Partial<Record<MuscleLayer, Record<MuscleLevel, number>>>;
}

export const MUSCLE_ART: Record<FigureSex, Record<MuscleView, MuscleArt>> = {
  male: {
    front: {
      base: require('@/assets/images/muscles/musc-m-front.webp'),
      layers: {
        chest: {
          primary: require('@/assets/images/muscles/musc-m-front-chest-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-front-chest-s.webp'),
        },
        shoulders: {
          primary: require('@/assets/images/muscles/musc-m-front-shoulders-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-front-shoulders-s.webp'),
        },
        biceps: {
          primary: require('@/assets/images/muscles/musc-m-front-biceps-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-front-biceps-s.webp'),
        },
        forearms: {
          primary: require('@/assets/images/muscles/musc-m-front-forearms-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-front-forearms-s.webp'),
        },
        abs: {
          primary: require('@/assets/images/muscles/musc-m-front-abs-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-front-abs-s.webp'),
        },
        obliques: {
          primary: require('@/assets/images/muscles/musc-m-front-obliques-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-front-obliques-s.webp'),
        },
        abductors: {
          primary: require('@/assets/images/muscles/musc-m-front-abductors-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-front-abductors-s.webp'),
        },
        quadriceps: {
          primary: require('@/assets/images/muscles/musc-m-front-quadriceps-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-front-quadriceps-s.webp'),
        },
        adductors: {
          primary: require('@/assets/images/muscles/musc-m-front-adductors-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-front-adductors-s.webp'),
        },
        calves: {
          primary: require('@/assets/images/muscles/musc-m-front-calves-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-front-calves-s.webp'),
        },
      },
    },
    back: {
      base: require('@/assets/images/muscles/musc-m-back.webp'),
      layers: {
        traps: {
          primary: require('@/assets/images/muscles/musc-m-back-traps-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-back-traps-s.webp'),
        },
        shoulders: {
          primary: require('@/assets/images/muscles/musc-m-back-shoulders-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-back-shoulders-s.webp'),
        },
        triceps: {
          primary: require('@/assets/images/muscles/musc-m-back-triceps-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-back-triceps-s.webp'),
        },
        lats: {
          primary: require('@/assets/images/muscles/musc-m-back-lats-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-back-lats-s.webp'),
        },
        lowerback: {
          primary: require('@/assets/images/muscles/musc-m-back-lowerback-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-back-lowerback-s.webp'),
        },
        forearms: {
          primary: require('@/assets/images/muscles/musc-m-back-forearms-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-back-forearms-s.webp'),
        },
        glutes: {
          primary: require('@/assets/images/muscles/musc-m-back-glutes-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-back-glutes-s.webp'),
        },
        hamstrings: {
          primary: require('@/assets/images/muscles/musc-m-back-hamstrings-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-back-hamstrings-s.webp'),
        },
        calves: {
          primary: require('@/assets/images/muscles/musc-m-back-calves-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-back-calves-s.webp'),
        },
        abductors: {
          primary: require('@/assets/images/muscles/musc-m-back-abductors-p.webp'),
          secondary: require('@/assets/images/muscles/musc-m-back-abductors-s.webp'),
        },
      },
    },
  },
  female: {
    front: {
      base: require('@/assets/images/muscles/musc-f-front.webp'),
      layers: {
        chest: {
          primary: require('@/assets/images/muscles/musc-f-front-chest-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-front-chest-s.webp'),
        },
        shoulders: {
          primary: require('@/assets/images/muscles/musc-f-front-shoulders-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-front-shoulders-s.webp'),
        },
        biceps: {
          primary: require('@/assets/images/muscles/musc-f-front-biceps-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-front-biceps-s.webp'),
        },
        forearms: {
          primary: require('@/assets/images/muscles/musc-f-front-forearms-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-front-forearms-s.webp'),
        },
        abs: {
          primary: require('@/assets/images/muscles/musc-f-front-abs-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-front-abs-s.webp'),
        },
        obliques: {
          primary: require('@/assets/images/muscles/musc-f-front-obliques-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-front-obliques-s.webp'),
        },
        abductors: {
          primary: require('@/assets/images/muscles/musc-f-front-abductors-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-front-abductors-s.webp'),
        },
        quadriceps: {
          primary: require('@/assets/images/muscles/musc-f-front-quadriceps-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-front-quadriceps-s.webp'),
        },
        adductors: {
          primary: require('@/assets/images/muscles/musc-f-front-adductors-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-front-adductors-s.webp'),
        },
        calves: {
          primary: require('@/assets/images/muscles/musc-f-front-calves-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-front-calves-s.webp'),
        },
      },
    },
    back: {
      base: require('@/assets/images/muscles/musc-f-back.webp'),
      layers: {
        traps: {
          primary: require('@/assets/images/muscles/musc-f-back-traps-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-back-traps-s.webp'),
        },
        shoulders: {
          primary: require('@/assets/images/muscles/musc-f-back-shoulders-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-back-shoulders-s.webp'),
        },
        triceps: {
          primary: require('@/assets/images/muscles/musc-f-back-triceps-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-back-triceps-s.webp'),
        },
        lats: {
          primary: require('@/assets/images/muscles/musc-f-back-lats-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-back-lats-s.webp'),
        },
        lowerback: {
          primary: require('@/assets/images/muscles/musc-f-back-lowerback-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-back-lowerback-s.webp'),
        },
        forearms: {
          primary: require('@/assets/images/muscles/musc-f-back-forearms-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-back-forearms-s.webp'),
        },
        glutes: {
          primary: require('@/assets/images/muscles/musc-f-back-glutes-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-back-glutes-s.webp'),
        },
        hamstrings: {
          primary: require('@/assets/images/muscles/musc-f-back-hamstrings-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-back-hamstrings-s.webp'),
        },
        calves: {
          primary: require('@/assets/images/muscles/musc-f-back-calves-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-back-calves-s.webp'),
        },
        abductors: {
          primary: require('@/assets/images/muscles/musc-f-back-abductors-p.webp'),
          secondary: require('@/assets/images/muscles/musc-f-back-abductors-s.webp'),
        },
      },
    },
  },
};
