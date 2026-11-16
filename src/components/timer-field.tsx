import { useState } from "react";
import type { TextInputProps } from "react-native";

import { durationInput, formatTimerDigits, timerDigits, timerSeconds } from "@/lib/parse";

import { Field } from "./ui";

/**
 * A time field that works like a phone timer: type digits and they fill from the right, shown as
 * a time while you type ("2", "20", "200" reads 0:02, 0:20, 2:00). It reports the seconds when
 * editing ends; leaving it without typing keeps the old value, and deleting everything clears it.
 * `commit` returns false to reject a value (the field then shows the old one).
 */
export function TimerField({
  seconds,
  commit,
  placeholder,
  ...props
}: Omit<TextInputProps, "value" | "onChangeText" | "onEndEditing" | "keyboardType"> & {
  seconds: number | undefined;
  commit: (seconds: number | undefined) => boolean;
}) {
  const [digits, setDigits] = useState("");
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState(false);
  const shown = editing ? (digits === "" ? "" : formatTimerDigits(digits)) : durationInput(seconds);

  return (
    <Field
      {...props}
      value={shown}
      placeholder={editing && seconds !== undefined ? durationInput(seconds) : placeholder}
      keyboardType="number-pad"
      // Keep the cursor at the end so digits always go in on the right.
      selection={{ start: shown.length, end: shown.length }}
      onFocus={(e) => {
        setDigits("");
        setTyped(false);
        setEditing(true);
        props.onFocus?.(e);
      }}
      onChangeText={(text) => {
        setTyped(true);
        setDigits(timerDigits(text));
      }}
      onEndEditing={() => {
        setEditing(false);
        if (!typed) return;
        const next = timerSeconds(digits);
        if (next !== seconds) commit(next);
      }}
    />
  );
}
