import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { Button, Chip, ChipGrid, Field, Label } from "@/components/ui";
import { Spacing } from "@/constants/theme";
import type { Equipment, MuscleGroup, Tracking } from "@/data/contract";
import type { ExerciseInput } from "@/data/exercises";
import {
  EQUIPMENT,
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
  MUSCLES,
  TRACKING,
  TRACKING_LABELS,
} from "@/lib/labels";

type Draft = {
  name: string;
  equipment?: Equipment;
  primary_muscle?: MuscleGroup;
  secondary_muscles: MuscleGroup[];
  tracking: Tracking;
  notes: string;
};

/** Turns the form state into repository input, or explains what's missing. */
export function draftToInput(draft: Draft): { input?: ExerciseInput; problem?: string } {
  if (!draft.name.trim()) return { problem: "Give the exercise a name." };
  if (!draft.equipment) return { problem: "Pick the equipment." };
  if (!draft.primary_muscle) return { problem: "Pick the main muscle worked." };
  return {
    input: {
      name: draft.name,
      equipment: draft.equipment,
      primary_muscle: draft.primary_muscle,
      secondary_muscles: draft.secondary_muscles.filter((m) => m !== draft.primary_muscle),
      tracking: draft.tracking,
      notes: draft.notes,
    },
  };
}

/** Create or edit a custom exercise. */
export function ExerciseForm({
  initial,
  submitLabel,
  onSubmit,
  onDelete,
}: {
  initial?: ExerciseInput;
  submitLabel: string;
  onSubmit: (input: ExerciseInput) => Promise<void>;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>({
    name: initial?.name ?? "",
    equipment: initial?.equipment,
    primary_muscle: initial?.primary_muscle,
    secondary_muscles: [...(initial?.secondary_muscles ?? [])],
    tracking: initial?.tracking ?? "weight_reps",
    notes: initial?.notes ?? "",
  });
  const [problem, setProblem] = useState<string>();
  const [saving, setSaving] = useState(false);
  const update = (changes: Partial<Draft>) => setDraft((d) => ({ ...d, ...changes }));

  async function submit() {
    const { input, problem: missing } = draftToInput(draft);
    setProblem(missing);
    if (!input) return;
    setSaving(true);
    try {
      await onSubmit(input);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
      setSaving(false);
    }
  }

  const toggleSecondary = (m: MuscleGroup) =>
    update({
      secondary_muscles: draft.secondary_muscles.includes(m)
        ? draft.secondary_muscles.filter((x) => x !== m)
        : [...draft.secondary_muscles, m],
    });

  return (
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Section title="Name">
        <Field
          value={draft.name}
          onChangeText={(name) => update({ name })}
          placeholder="e.g. Landmine Press"
          accessibilityLabel="Exercise name"
          maxLength={100}
          autoFocus={!initial}
        />
      </Section>

      <Section title="Equipment">
        <ChipGrid>
          {EQUIPMENT.map((e) => (
            <Chip
              key={e}
              label={EQUIPMENT_LABELS[e]}
              selected={draft.equipment === e}
              onPress={() => update({ equipment: e })}
            />
          ))}
        </ChipGrid>
      </Section>

      <Section title="Main muscle">
        <ChipGrid>
          {MUSCLES.map((m) => (
            <Chip
              key={m}
              label={MUSCLE_LABELS[m]}
              selected={draft.primary_muscle === m}
              onPress={() => update({ primary_muscle: m })}
            />
          ))}
        </ChipGrid>
      </Section>

      <Section title="Other muscles (optional)">
        <ChipGrid>
          {MUSCLES.filter((m) => m !== draft.primary_muscle).map((m) => (
            <Chip
              key={m}
              label={MUSCLE_LABELS[m]}
              selected={draft.secondary_muscles.includes(m)}
              onPress={() => toggleSecondary(m)}
            />
          ))}
        </ChipGrid>
      </Section>

      <Section title="What you log">
        <ChipGrid>
          {TRACKING.map((t) => (
            <Chip
              key={t}
              label={TRACKING_LABELS[t]}
              selected={draft.tracking === t}
              onPress={() => update({ tracking: t })}
            />
          ))}
        </ChipGrid>
      </Section>

      <Section title="Notes (optional)">
        <Field
          value={draft.notes}
          onChangeText={(notes) => update({ notes })}
          placeholder="Setup, cues…"
          accessibilityLabel="Notes"
          multiline
          maxLength={2000}
          style={styles.notes}
        />
      </Section>

      {problem ? (
        <Label tone="danger" accessibilityLiveRegion="polite">
          {problem}
        </Label>
      ) : null}
      <Button title={submitLabel} onPress={submit} disabled={saving} />
      {onDelete ? <Button title="Delete exercise" tone="danger" onPress={onDelete} /> : null}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Label tone="secondary" size="small">
        {title}
      </Label>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.five * 2 },
  section: { gap: Spacing.two },
  notes: { minHeight: 80, textAlignVertical: "top" },
});
