import React, { useEffect } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { PairTagScreen } from '../screens/PairTagScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AlarmScreen } from '../screens/AlarmScreen';
import { useAppState } from '../state/AppStateContext';

export type RootStackParamList = {
  Home: undefined;
  PairTag: undefined;
  Settings: undefined;
  Alarm: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const { isAlarmActive } = useAppState();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  // Global listener: Auto-navigate to Alarm screen if alarm is triggered
  useEffect(() => {
    if (navigationRef.isReady()) {
      if (isAlarmActive) {
        navigationRef.navigate('Alarm');
      } else {
        const currentRoute = navigationRef.getCurrentRoute();
        if (currentRoute?.name === 'Alarm') {
          navigationRef.navigate('Home');
        }
      }
    }
  }, [isAlarmActive, navigationRef]);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
        }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="PairTag" component={PairTagScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen
          name="Alarm"
          component={AlarmScreen}
          options={{
            gestureEnabled: false,
            animation: 'none',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

