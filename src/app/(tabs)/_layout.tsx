import { NativeTabs } from "expo-router/unstable-native-tabs";
import React from "react";

export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md={{ default: "home", selected: "home_filled" }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="week-program">
        <NativeTabs.Trigger.Label>Programma</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "calendar", selected: "calendar" }}
          md={{ default: "calendar_month", selected: "calendar_month" }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ingredients-recipes">
        <NativeTabs.Trigger.Label>Ricette</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "fork.knife", selected: "fork.knife" }}
          md={{ default: "restaurant_menu", selected: "restaurant_menu" }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="lista-spesa">
        <NativeTabs.Trigger.Label>Spesa</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "cart", selected: "cart.fill" }}
          md={{ default: "shopping_cart", selected: "shopping_cart" }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
