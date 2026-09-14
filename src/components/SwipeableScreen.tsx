import React, { useRef } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, SlideInRight, SlideInLeft } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

const TAB_ROUTES = ['today', 'my-data', 'lab', 'more'] as const;

type TabRoute = (typeof TAB_ROUTES)[number];

// Módulo compartido: recuerda el último tab mostrado para saber la dirección de entrada
let lastTabIndex = 0;

interface SwipeableScreenProps {
  current: TabRoute;
  children: React.ReactNode;
}

export const SwipeableScreen = ({ current, children }: SwipeableScreenProps) => {
  const router = useRouter();
  const currentIndex = TAB_ROUTES.indexOf(current);

  // Se calcula una sola vez por montaje (no en cada re-render)
  const movingForward = useRef(currentIndex > lastTabIndex).current;
  lastTabIndex = currentIndex;

  const navigateToIndex = (index: number) => {
    if (index < 0 || index >= TAB_ROUTES.length) return;
    router.navigate(`/(tabs)/${TAB_ROUTES[index]}` as any);
  };

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((event) => {
      'worklet';
      if (event.translationX < -50 && event.velocityX < -200) {
        runOnJS(navigateToIndex)(currentIndex + 1);
      } else if (event.translationX > 50 && event.velocityX > 200) {
        runOnJS(navigateToIndex)(currentIndex - 1);
      }
    });

  const EnteringAnimation = (movingForward ? SlideInRight : SlideInLeft).duration(240);

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View style={styles.flex} entering={EnteringAnimation}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
