import { useRouter } from "expo-router";

import { IconAction, PageHeader } from "@/components/glas";
import { Screen } from "@/components/ui";
import { useLiveQuery } from "@/data/database-provider";
import { ExerciseBrowser } from "@/features/exercises/exercise-browser";
import { exerciseListItems } from "@/features/exercises/model";

export default function ExercisesScreen() {
  const router = useRouter();
  const custom = useLiveQuery((r) => r.exercises.listActive(), []);
  const items = exerciseListItems(custom.data ?? []);

  return (
    <Screen>
      <PageHeader
        title="Exercises"
        right={
          <IconAction
            icon="add"
            label="New exercise"
            tone="tint"
            onPress={() => router.push("/exercises/form")}
          />
        }
      />
      <ExerciseBrowser
        items={items}
        onSelect={(item) =>
          router.push({ pathname: "/exercises/[ref]", params: { ref: item.ref } })
        }
      />
    </Screen>
  );
}
