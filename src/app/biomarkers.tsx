import { MyDataScreen } from '@/screens/MyDataScreen';

// «Ver todas» las mediciones (Hoy) y «Ver todos» los biomarcadores (Análisis): lo que era Mis datos
export default function Screen() {
  return <MyDataScreen part="biomarkers" />;
}
