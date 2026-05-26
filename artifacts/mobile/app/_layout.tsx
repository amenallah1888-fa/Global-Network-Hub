import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View } from "react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { configureApiClient } from "@/lib/apiClient";
import { AIAssistant } from "@/components/AIAssistant";

SplashScreen.preventAutoHideAsync();
configureApiClient();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function RootLayoutNav() {
  const { token, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace("/login");
    } else if (!isLoading && token) {
      router.replace("/(tabs)");
    }
  }, [isLoading, token]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerBackTitle: "Back", headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen name="inbox" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[userId]" options={{ headerShown: false }} />
        <Stack.Screen name="pitch/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="profile/[userId]" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="circle/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="service/[id]" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="my-campaigns" options={{ headerShown: false, animation: "slide_from_right" }} />
        <Stack.Screen name="admin" options={{ headerShown: false, animation: "slide_from_right" }} />
      </Stack>
      {token ? <AIAssistant /> : null}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <StatusBar style="auto" />
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </AppProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
