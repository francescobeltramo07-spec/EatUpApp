import { Href, router } from "expo-router";
import { SymbolView } from "expo-symbols";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const tabs = [
  {
    key: "home",
    label: "Home",
    route: "/",
    iosIcon: "house.fill",
    androidIcon: "home",
  },
  {
    key: "program",
    label: "Programma",
    route: "/week-program",
    iosIcon: "calendar",
    androidIcon: "calendar_month",
  },
  {
    key: "recipes",
    label: "Ricette",
    route: "/ingredients-recipes",
    iosIcon: "fork.knife",
    androidIcon: "restaurant_menu",
  },
  {
    key: "shopping",
    label: "Spesa",
    route: "/lista-spesa",
    iosIcon: "cart.fill",
    androidIcon: "shopping_cart",
  },
] as const;

type ServiceTab = (typeof tabs)[number];
type ServiceTabKey = ServiceTab["key"];

// Persist the indicator position across screen replacements to animate tab changes.
const indicatorTranslateX = new Animated.Value(0);
let lastSelectedTab: ServiceTabKey | null = null;
let lastTabWidth = 0;

function routeFor(tab: ServiceTab, signedIn: boolean): Href {
  return signedIn
    ? (`${tab.route}?signedIn=true` as Href)
    : tab.key === "home"
      ? ("/" as Href)
      : ("/login" as Href);
}

type ServiceTabBarProps = {
  activeTab: ServiceTabKey;
  signedIn: boolean;
};

export function ServiceTabBar({ activeTab, signedIn }: ServiceTabBarProps) {
  const [barWidth, setBarWidth] = useState(0);
  const tabWidth = Math.max(0, (barWidth - 14) / tabs.length);

  useEffect(() => {
    if (tabWidth === 0) {
      return;
    }

    const activeIndex = tabs.findIndex((tab) => tab.key === activeTab);
    const nextPosition = activeIndex * tabWidth;

    if (lastSelectedTab === null) {
      indicatorTranslateX.setValue(nextPosition);
    } else if (lastTabWidth !== tabWidth) {
      indicatorTranslateX.setValue(nextPosition);
    } else if (lastSelectedTab !== activeTab) {
      Animated.spring(indicatorTranslateX, {
        toValue: nextPosition,
        damping: 22,
        stiffness: 180,
        mass: 0.9,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }

    lastSelectedTab = activeTab;
    lastTabWidth = tabWidth;
  }, [activeTab, tabWidth]);

  const [previewKey, setPreviewKey] = useState<ServiceTabKey | null>(null);
  const latest = useRef({ activeTab, tabWidth, signedIn });
  latest.current = { activeTab, tabWidth, signedIn };
  const dragStart = useRef(0);
  const lastX = useRef(0);

  function finishDrag() {
    const { activeTab, tabWidth, signedIn } = latest.current;
    setPreviewKey(null);
    if (tabWidth === 0) return;
    const index = Math.round(lastX.current / tabWidth);
    const target = tabs[index];
    Animated.spring(indicatorTranslateX, {
      toValue: index * tabWidth,
      damping: 22,
      stiffness: 180,
      mass: 0.9,
      useNativeDriver: Platform.OS !== "web",
    }).start();
    if (target.key !== activeTab) {
      router.replace(routeFor(target, signedIn));
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: () => {
        indicatorTranslateX.stopAnimation();
        const { activeTab, tabWidth } = latest.current;
        dragStart.current =
          tabs.findIndex((t) => t.key === activeTab) * tabWidth;
        lastX.current = dragStart.current;
      },
      onPanResponderMove: (_, g) => {
        const { tabWidth } = latest.current;
        if (tabWidth === 0) return;
        const max = (tabs.length - 1) * tabWidth;
        const x = Math.min(max, Math.max(0, dragStart.current + g.dx));
        lastX.current = x;
        indicatorTranslateX.setValue(x);
        setPreviewKey(tabs[Math.round(x / tabWidth)].key);
      },
      onPanResponderRelease: finishDrag,
      onPanResponderTerminate: finishDrag,
    })
  ).current;

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      style={styles.bar}
      {...panResponder.panHandlers}
    >
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.selectionIndicator,
            {
              transform: [{ translateX: indicatorTranslateX }],
              width: tabWidth,
            },
          ]}
        />
      ) : null}
      {tabs.map((tab) => {
        const selected = tab.key === activeTab;
        const highlighted = tab.key === (previewKey ?? activeTab);

        return (
          <Pressable
            accessibilityLabel={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={tab.key}
            onPress={() => {
              if (!selected) {
                router.replace(routeFor(tab, signedIn))
              }
            }}
            style={({ pressed }) => [
              styles.tab,
              pressed && styles.pressed,
            ]}
          >
            <SymbolView
              name={{
                ios: tab.iosIcon,
                android: tab.androidIcon,
                web: tab.androidIcon,
              }}
              size={25}
              tintColor={highlighted ? "#38BDF8" : "#F8FAFC"}
              weight="semibold"
            />
            <Text style={[styles.label, selected && styles.selectedLabel]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    right: 16,
    bottom: 8,
    left: 16,
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 44,
    backgroundColor: "rgba(38, 38, 42, 0.94)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 12,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 68,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 38,
  },
  selectionIndicator: {
    position: "absolute",
    top: 7,
    bottom: 7,
    left: 7,
    borderRadius: 38,
    backgroundColor: "rgba(0, 0, 0, 0.26)",
  },
  label: {
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: "600",
  },
  selectedLabel: {
    color: "#38BDF8",
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
});
