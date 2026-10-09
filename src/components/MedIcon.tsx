import React from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';
import { medIcon } from '@/logic/medication';
import { MedKind } from '@/types/medication';

// Icono redondo de un medicamento o suplemento: el propio si lo conocemos (sol, pez, mariposa…),
// si no una hoja (suplemento) o una cápsula (medicamento). Verde para suplementos, dorado para
// medicamentos.
export const MedIcon = ({ name, kind, size = 18 }: { name: string; kind: MedKind; size?: number }) => {
  const color = kind === 'supplement' ? Colors.green : Colors.gold;
  return (
    <View
      style={{
        width: size + 18,
        height: size + 18,
        borderRadius: (size + 18) / 2,
        backgroundColor: withAlpha(color, 0.14),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialCommunityIcons name={medIcon(name, kind).name as any} size={size} color={color} />
    </View>
  );
};
