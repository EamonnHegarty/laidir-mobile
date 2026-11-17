import { ScrollView, Share, StyleSheet, View } from "react-native";

import { RowGroup } from "@/components/glas";
import { Icon } from "@/components/icon";
import { Label, Row, Screen, SectionHeader } from "@/components/ui";
import { CLAUDE_CLIENT_ID, MCP_URL } from "@/auth/config";
import { Spacing } from "@/constants/theme";

const STEPS = [
  "In Claude, open Settings → Connectors and choose Add custom connector.",
  "Name it Láidir and paste the connector URL below.",
  "Open Advanced settings and paste the client ID below. Leave the client secret empty.",
  "Choose Add, then Connect, and sign in with your Láidir account.",
];

const PROMPTS = [
  "What routines do I have in Láidir?",
  "How has my bench press gone over the last two months?",
  "Summarise my workouts this week.",
  "Which muscles have I trained least lately?",
];

/**
 * How to connect Claude to Láidir (the MCP custom connector). Optional: the app never needs it.
 * Values are shared through the system share sheet, which has Copy.
 */
export default function ConnectClaudeScreen() {
  const share = (message: string) => void Share.share({ message });
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Label tone="secondary" style={styles.pad}>
          Connect Láidir to Claude to ask about your training in plain language. Claude reads the
          same data as this app, from your backup, so sign in to Back up &amp; sync first.
        </Label>

        <SectionHeader>Steps</SectionHeader>
        <View style={styles.steps}>
          {STEPS.map((step, i) => (
            <View key={step} style={styles.step}>
              <Label tone="tint">{i + 1}.</Label>
              <Label style={styles.flex}>{step}</Label>
            </View>
          ))}
        </View>

        <SectionHeader>Copy these</SectionHeader>
        <RowGroup style={styles.group}>
          <Row
            title="Connector URL"
            subtitle={MCP_URL}
            onPress={() => share(MCP_URL)}
            accessibilityLabel="Share or copy the connector URL"
            right={<Icon name="content_copy" />}
          />
          <Row
            title="Client ID (Advanced settings)"
            subtitle={CLAUDE_CLIENT_ID}
            onPress={() => share(CLAUDE_CLIENT_ID)}
            accessibilityLabel="Share or copy the client ID"
            right={<Icon name="content_copy" />}
          />
        </RowGroup>

        <SectionHeader>Try asking</SectionHeader>
        <View style={styles.steps}>
          {PROMPTS.map((prompt) => (
            <Label key={prompt} tone="secondary">
              “{prompt}”
            </Label>
          ))}
        </View>

        <Label tone="secondary" size="small" style={styles.pad}>
          Claude only sees your data while the connector is connected. Remove it any time in
          Claude&apos;s Connectors settings.
        </Label>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: Spacing.three, paddingBottom: Spacing.five * 2, gap: Spacing.two },
  pad: { paddingHorizontal: Spacing.three },
  group: { marginHorizontal: Spacing.three, marginTop: Spacing.two },
  steps: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  step: { flexDirection: "row", gap: Spacing.two },
  flex: { flex: 1 },
});
